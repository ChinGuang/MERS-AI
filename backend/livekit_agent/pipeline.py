"""
Bridges a LiveKit call into the EXISTING real-time pipeline.

This file exists so that a call arriving through LiveKit ends up in the same
place a Twilio/Retell call does - written into the same Redis queues, read by
the same background consumers (transcript_process_consumer.py,
transcript_broadcast_consumer.py, incident_extract_consumer.py, ...),
persisted with the same DB tables - WITHOUT any of those existing files being
edited. Everything below only *imports* existing modules read-only.

Runs inside worker.py's process, which is separate from the main FastAPI
app's process. Because of that:
  - It uses its OWN SQLAlchemy session (via database.py::SessionLocal),
    not the shared session in async_context_managers/base.py, which only
    exists inside the main app's process.
  - It does NOT need base.main_loop.call_soon_threadsafe(...) - that dance
    exists in apis/websocket.py only because sync callback code there needs
    to hop onto the main app's asyncio loop from a different thread within
    the SAME process. A separate process can just talk to Redis directly;
    the main app's already-running background consumers pick up new queue
    entries exactly as they do today.
"""

import json
import logging
import time
from uuid import UUID

from sqlalchemy.orm import Session

from constants.redis_key import (
    ACTIVE_CALLS_SET_KEY,
    INCIDENT_EXTRACT_QUEUE_KEY,
    PENDING_CALL_TRANSCRIPT_MAP_KEY,
    TRANSCRIPT_CONSUME_QUEUE_KEY,
)
from database import SessionLocal
from datetime_utils import now_utc
from models.database.call import InitCallPayload
from models.database.incident import InitIncidentPayload
from models.dto.retell import RetellRoleType, Utterance
from models.schema import Call
from modules import call_module, incident_module
from modules.redis_module import redis_client

logger = logging.getLogger(__name__)


def new_db_session() -> Session:
    """One session per LiveKit room/call - opened on join, closed on leave."""
    return SessionLocal()


def get_or_create_call(room_name: str, db: Session) -> tuple[UUID, UUID]:
    """
    Mirrors apis/websocket.py's llm_websocket_for_retell connect-time logic
    exactly, using the LiveKit room name as provider_sid. Returns
    (internal_call_id, incident_id).
    """
    existing = call_module.get_call_id_and_incident_id_by_sid(room_name, db=db)
    if existing is not None:
        return existing

    logger.info("[livekit_agent] room %s not found in DB, creating incident + call", room_name)
    new_incident = incident_module.init_incident(
        InitIncidentPayload(title="DRAFT INCIDENT (LiveKit fallback)"), db
    )
    call_module.init_call(
        InitCallPayload(
            received_at=now_utc(),
            caller_number="UNKNOWN (LiveKit)",
            provider_sid=room_name,
            incident_id=new_incident.id,
        ),
        db,
    )
    db.commit()

    result = call_module.get_call_id_and_incident_id_by_sid(room_name, db=db)
    if result is None:
        raise RuntimeError(f"Failed to initialize call for LiveKit room {room_name}")
    return result


def mark_call_active(internal_call_id: UUID) -> None:
    redis_client.sadd(ACTIVE_CALLS_SET_KEY, str(internal_call_id))


def enqueue_transcript(internal_call_id: UUID, role: RetellRoleType, content: str) -> None:
    """
    Writes one utterance into the SAME Redis shape transcript_process_consumer.py
    already reads (see backend/apis/websocket.py's handle_message for the
    Retell-side equivalent). No word-level timings from LiveKit's STT are
    assumed here - call_transcript_module.upsert_call_transcript already
    handles start_duration == 0 (untimed) utterances via its fuzzy-merge path,
    so this deliberately omits `words` rather than guessing timings.
    """
    if not content.strip():
        return

    utterance = Utterance(role=role, content=content, words=None)
    redis_client.hset(
        PENDING_CALL_TRANSCRIPT_MAP_KEY,
        str(internal_call_id),
        json.dumps([utterance.model_dump()]),
    )
    redis_client.zadd(TRANSCRIPT_CONSUME_QUEUE_KEY, {str(internal_call_id): time.time()})


def end_call(internal_call_id: UUID, db: Session) -> None:
    """
    Mirrors apis/websocket.py's `finally` block: mark the call ended and push
    it onto the SAME incident-extraction queue incident_extract_consumer.py
    already drains - this alone gives LiveKit calls a titled/summarized
    incident for free, via code that already exists and needs no changes.
    """
    redis_client.srem(ACTIVE_CALLS_SET_KEY, str(internal_call_id))

    call = db.get(Call, internal_call_id)
    if call is not None and call.ended_at is None:
        call.ended_at = now_utc()
        db.commit()
        redis_client.lpush(INCIDENT_EXTRACT_QUEUE_KEY, str(internal_call_id))
        logger.info("[livekit_agent] enqueued incident extraction for call %s", internal_call_id)
