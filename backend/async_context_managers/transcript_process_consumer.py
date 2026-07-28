import asyncio
import json
import uuid

from agents.translation_agent import detect_and_translate
from constants.redis_key import TRANSCRIPT_CONSUME_QUEUE_KEY, PENDING_CALL_TRANSCRIPT_MAP_KEY
from datetime_utils import now_utc
from models.dto.retell import Utterance
from models.schema import Call
from modules.redis_module import redis_client
from modules import call_transcript_module
from async_context_managers import base


async def transcript_process_consumer():
    while base.keep_running:
        try:
            result = redis_client.zpopmin(TRANSCRIPT_CONSUME_QUEUE_KEY)
            if not result:
                await asyncio.sleep(0.1)
                continue
            process_call_id = result[0][0]
            print("transcript_process_consumer: Processing call trtranscript_process_consumer.pyanscript for call", process_call_id)

            transcript_json = redis_client.hpop(PENDING_CALL_TRANSCRIPT_MAP_KEY, process_call_id)
            print("transcript_process_consumer: Processing call transcript for call", process_call_id, "with transcript", transcript_json)
            if transcript_json is None:
                continue
            transcript = [Utterance(**u) for u in json.loads(transcript_json)]

            for utterance in transcript:
                default_start_duration: int = 0
                default_end_duration: int = 0
                if utterance.words and len(utterance.words) > 0:
                    if utterance.words[0].start is not None:
                        default_start_duration = int(utterance.words[0].start * 1000)
                    if utterance.words[-1].end is not None:
                        default_end_duration = int(utterance.words[-1].end * 1000)
                else:
                    # No word-level timing (every LiveKit-sourced utterance today,
                    # plus some Retell partial updates) used to fall back to 0,
                    # which made every untimed utterance in a call display the
                    # exact same call-start timestamp on the frontend. Use real
                    # elapsed wall-clock time since the call started instead, so
                    # timestamps still progress through the conversation.
                    call = base.db.get(Call, uuid.UUID(process_call_id))
                    if call and call.received_at:
                        elapsed_ms = max(int((now_utc() - call.received_at).total_seconds() * 1000), 0)
                        default_start_duration = elapsed_ms
                        default_end_duration = elapsed_ms

                # Runs in a worker thread - detect_and_translate makes a blocking
                # Gemini call, and this consumer runs on the main event loop
                # (same pattern as location_agent_module.py's geocoding call).
                translated = await asyncio.to_thread(detect_and_translate, utterance.content)

                call_transcript_module.upsert_call_transcript(
                    call_id=process_call_id,
                    role=utterance.role,
                    content=utterance.content,
                    start_duration=default_start_duration,
                    end_duration=default_end_duration,
                    db=base.db,
                    language=translated.language if translated else None,
                    translated_text=(
                        translated.english_translation
                        if translated and not translated.is_english
                        else None
                    ),
                )

            base.db.commit()
        except Exception as e:
            print(f"transcript_process_consumer error: {e}")
            await asyncio.sleep(0.5)
