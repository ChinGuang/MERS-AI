import asyncio
import json
import uuid


from agents.translation_agent import detect_and_translate
from async_context_managers.base import db
from constants.redis_key import PENDING_CALL_TRANSCRIPT_MAP_LIVE_AGENT_KEY
from datetime_utils import now_utc
from models.database.call_transcript import CreateCallTranscriptPayload
from models.schema import Call
from modules.redis_module import redis_client
from modules import call_transcript_module
from async_context_managers import base


async def transcript_livekit_process_consumer():
    while base.keep_running:
        try:
            # brpop is a blocking network call - direct (non-threaded) use inside an
            # `async def` freezes the whole single-threaded event loop for up to the
            # timeout, starving every other consumer sharing it whenever this queue is
            # empty (which is most of the time between calls).
            result = await asyncio.to_thread(redis_client.brpop, PENDING_CALL_TRANSCRIPT_MAP_LIVE_AGENT_KEY, 3)
            if not result:
                await asyncio.sleep(0.1)
                continue
            print("result getting")
            print(f"result: {result[1]}")
            json_result = json.loads(result[1])
            if json_result is None:
                continue
            process_call_id = uuid.UUID(json_result["call_id"])
            call = base.db.get(Call, process_call_id)
            if call and call.received_at:
                elapsed_ms = max(int((now_utc() - call.received_at).total_seconds() * 1000), 0)
                default_start_duration = elapsed_ms
                default_end_duration = elapsed_ms

                translated = await asyncio.to_thread(detect_and_translate, json_result["content"])
                call_transcript_module.create_call_transcript(
                    CreateCallTranscriptPayload(
                        call_id=process_call_id,
                        role=json_result["role"],
                        transcript=json_result["content"],
                        start_duration=default_start_duration,
                        end_duration=default_end_duration,
                        language=translated.language if translated else None,
                        translated_text=(
                            translated.english_translation
                            if translated and not translated.is_english
                            else None
                        ),
                    ), db=db
                )
                base.db.commit()
            else:
                print(f"Call {json_result["process_call_id"]} not found")
        except Exception as e:
            print(f"transcript_livekit_process_consumer error: {e}")
            # base.db is shared across every background consumer - roll back so one
            # failure here doesn't poison it (PendingRollbackError) for the others.
            try:
                base.db.rollback()
            except Exception as rollback_err:
                print(f"transcript_livekit_process_consumer: failed to roll back: {rollback_err}")
            await asyncio.sleep(0.5)
