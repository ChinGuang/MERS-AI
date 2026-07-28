import asyncio
import json
import time

from async_context_managers import base
from datetime_utils import now_utc
from models.database.call import InitCallPayload
from models.database.incident import InitIncidentPayload, UpdateIncidentPayload
from models.schema import Call
from fastapi import WebSocketDisconnect

from agents.voice_agent import prompting_to_voice_agent
from modules import location_agent_module
from constants.redis_key import PENDING_CALL_TRANSCRIPT_MAP_KEY, TRANSCRIPT_CONSUME_QUEUE_KEY, INCIDENT_EXTRACT_QUEUE_KEY, ACTIVE_CALLS_SET_KEY
from main import app
from database import db_dependency
from fastapi import WebSocket

from modules.redis_module import redis_client

from models.dto.retell import ConfigResponse, inbound_event_adapter, RetellInboundEvent, \
    RetellInteractionType, ResponseRequiredRequest, ResponseResponseEvent, RetellResponseType
from modules import call_module, db_module, incident_module
from concurrent.futures import TimeoutError as ConnectionTimeoutError


@app.websocket("/media-stream")
async def media_stream(websocket: WebSocket, db: db_dependency):
    await websocket.accept()
    print("Websocket connected")
    try:
        while True:
            msg = await websocket.receive_json()
            # TODO: Validate msg before after logic

            match msg["event"]:
                case "connected":
                    print("📞 Twilio Stream connected")
                case "start":
                    stream_sid = msg["start"]["streamSid"]
                    websocket.session.update({"sid": stream_sid})
                    call_id = call_module.get_call_id_by_sid(stream_sid, db=db)
                    websocket.session.update({"call_id": call_id})
                    print(f"🎙️ Call started - StreamSid: {stream_sid}")
                case "media":
                    # raw audio encoded in base64
                    call_id = websocket.session.get("call_id")
                    if call_id is None:
                        print("Call id is not initialized")
                        return
                    raw_voice = msg["media"]["payload"]
                    # audio_bytes = base64.b64decode(raw_voice)
                    # file_name = to_voice_file_name(str(call_id))

                    # download_response = storage_module.download_file(file_name)
                    # bytes_buffer = io.BytesIO()
                    # if download_response is not None:
                    #     bytes_buffer.write(download_response)
                    # bytes_buffer.write(audio_bytes)
                    # storage_module.upload_file(file_name, bytes_buffer.getvalue())
                    # app.pika_emotion_analyse_publisher.publish({
                    #     "call_id": str(call_id),
                    #     "is_done": False,
                    # })

                case "stop":
                    print("⏹️ Call ended ")
                    call_id = websocket.session.get("call_id")
                    # app.pika_emotion_analyse_publisher.publish({
                    #     "call_id": str(call_id),
                    #     "is_done": True,
                    # })
                case _:
                    print(f"Unknown event: {msg['event']}")
    except WebSocketDisconnect:
        print("Websocket connection disconnected")

pipeline = None

@app.websocket("/llm-socket/{call_id}")
async def llm_websocket_for_retell(websocket: WebSocket, db: db_dependency, call_id: str):
    internal_call_id = None

    try:
        await websocket.accept()
        print(f"Connected call ID: {call_id}")
        # ref code
        # llm_client = LlmClient()
        config = ConfigResponse(
            response_type="config",
            config={
                "auto_reconnect": True,
                "call_details": False,
            },
            response_id=1
        )
        await websocket.send_json(config.__dict__)
        response_id = 0
        id_result = call_module.get_call_id_and_incident_id_by_sid(call_id, db=db)

        # If call_id is not in the database yet, initialize a new Incident and Call
        if id_result is None:
            print(f"Call ID {call_id} not found in DB. Creating new incident and call record...")
            init_incident_payload = InitIncidentPayload(title="DRAFT INCIDENT")
            new_incident = incident_module.init_incident(init_incident_payload, db)
            init_call_payload = InitCallPayload(
                received_at=now_utc(),
                caller_number="UNKNOWN",
                provider_sid=call_id,
                incident_id=new_incident.id
            )
            call_module.init_call(init_call_payload, db)
            db.commit()
            id_result = call_module.get_call_id_and_incident_id_by_sid(call_id, db=db)

        if id_result is None:
            print("Failed to initialize call id in database")
            await websocket.close(1011, "Server error")
            return

        internal_call_id, incident_id = id_result
        loop = base.main_loop
        if loop is not None and loop.is_running():
           loop.call_soon_threadsafe(
                redis_client.sadd, ACTIVE_CALLS_SET_KEY, str(internal_call_id))
           print(f"Added call {internal_call_id} to active calls set")

        # Send first message to signal ready of server
        response_id = 0
        async def handle_message(event: RetellInboundEvent):
            nonlocal response_id

            if hasattr(event, "transcript") and event.transcript:
                transcript = event.transcript
                loop = base.main_loop
                if loop is not None and loop.is_running():
                    loop.call_soon_threadsafe(
                        redis_client.hset, PENDING_CALL_TRANSCRIPT_MAP_KEY, str(internal_call_id), json.dumps([utterance.model_dump() for utterance in transcript])
                    )
                    loop.call_soon_threadsafe(
                        redis_client.zadd, TRANSCRIPT_CONSUME_QUEUE_KEY, {str(internal_call_id): time.time()}
                    )

            match event.interaction_type:
                case RetellInteractionType.PING_PONG:
                    await websocket.send_json(
                        {
                            "response_type": "ping_pong",
                            "timestamp": event.timestamp,
                        }
                    )
                case RetellInteractionType.UPDATE_ONLY:
                    transcript_text = location_agent_module.flatten_utterances(event.transcript)
                    if location_agent_module.should_check_location(str(internal_call_id), transcript_text):
                        asyncio.create_task(
                            location_agent_module.extract_and_update_incident_location_from_text(
                                internal_call_id, transcript_text, db
                            )
                        )
                case RetellInteractionType.RESPONSE_REQUIRED | RetellInteractionType.REMINDER_REQUIRED:
                    response_id = event.response_id
                    transcript = event.transcript
                    print(
                        f"""Received interaction_type={event.interaction_type}, response_id={response_id}, last_transcript={event.transcript[-1].content}"""
                    )
                    result_stream = prompting_to_voice_agent(call_id=str(internal_call_id), transcripts=transcript)
                    async for chunk in result_stream:
                        response_response_event = ResponseResponseEvent(
                            response_id=response_id,
                            content=chunk,
                            content_complete=False
                        )
                        await websocket.send_json(response_response_event.__dict__)
        async for data in websocket.iter_text():
            event = inbound_event_adapter.validate_json(data)
            asyncio.create_task(handle_message(event))
    except WebSocketDisconnect:
        print(f"LLM WebSocket disconnected for {call_id}")
    except ConnectionTimeoutError as e:
        print(f"Connection timeout error for {call_id}")
    except Exception as e:
        await websocket.close(1011, "Server error")
        raise e
    finally:
        print(f"LLM WebSocket connection closed for {call_id}")
        if internal_call_id is not None:
            redis_client.srem(ACTIVE_CALLS_SET_KEY, str(internal_call_id))
            call = db.get(Call, internal_call_id)
            if call and call.ended_at is None:
                call.ended_at = now_utc()
                db.commit()
                loop = base.main_loop
                if loop is not None and loop.is_running():
                    loop.call_soon_threadsafe(
                        redis_client.lpush, INCIDENT_EXTRACT_QUEUE_KEY, str(internal_call_id))
                print(f"Enqueued incident extraction for call {internal_call_id}")

