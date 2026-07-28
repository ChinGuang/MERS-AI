from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid_v7.base import uuid7

from database import db_dependency
from models.database.call_transcript import CreateCallTranscriptPayload, UtteranceExistsPayload
from models.schema import CallTranscript
from modules import db_module

def create_call_transcript(payload: CreateCallTranscriptPayload, db: db_dependency) -> CallTranscript:
    call_transcript_payload = (payload.model_dump() | {"id": uuid7()})
    new_call_transcript = db_module.init_data(call_transcript_payload, db, CallTranscript)
    return new_call_transcript

def read_transcripts(call_id: UUID, db: Session) -> list[CallTranscript]:
    stmt = select(CallTranscript).where(CallTranscript.call_id == call_id).order_by(CallTranscript.start_duration, CallTranscript.created_at)
    rows = db.scalars(stmt).unique().all()
    if not rows:
        return []

    deduped: dict[tuple, CallTranscript] = {}
    ordered_list = []
    for r in rows:
        if r.start_duration and r.start_duration > 0:
            key = (r.role, r.start_duration)
            if key not in deduped:
                deduped[key] = r
                ordered_list.append(r)
            else:
                if len(r.transcript) >= len(deduped[key].transcript):
                    idx = ordered_list.index(deduped[key])
                    deduped[key] = r
                    ordered_list[idx] = r
        else:
            ordered_list.append(r)

    return ordered_list

def upsert_call_transcript(
    call_id: UUID,
    role: str,
    content: str,
    start_duration: int,
    end_duration: int,
    db: Session,
    language: str | None = None,
    translated_text: str | None = None,
) -> CallTranscript:
    call_id = UUID(str(call_id)) if not isinstance(call_id, UUID) else call_id
    role_str = str(role)

    existing = None
    if start_duration > 0:
        stmt = select(CallTranscript).where(
            CallTranscript.call_id == call_id,
            CallTranscript.role == role_str,
            CallTranscript.start_duration == start_duration,
        )
        existing = db.scalars(stmt).first()

    if existing is None and start_duration == 0:
        stmt = select(CallTranscript).where(
            CallTranscript.call_id == call_id,
            CallTranscript.role == role_str,
            CallTranscript.start_duration == 0,
        )
        rows = db.scalars(stmt).all()
        for r in rows:
            if r.transcript == content or content.startswith(r.transcript) or r.transcript.startswith(content):
                existing = r
                break

    if existing is not None:
        changed = False
        if existing.transcript != content:
            existing.transcript = content
            changed = True
        if existing.end_duration != end_duration and end_duration > 0:
            existing.end_duration = end_duration
            changed = True
        if language is not None and existing.language != language:
            existing.language = language
            changed = True
        if translated_text is not None and existing.translated_text != translated_text:
            existing.translated_text = translated_text
            changed = True
        if changed:
            db.add(existing)
            db.flush()
        return existing

    payload = CreateCallTranscriptPayload(
        call_id=call_id,
        role=role_str,
        transcript=content,
        start_duration=start_duration,
        end_duration=end_duration,
        language=language,
        translated_text=translated_text,
    )
    return create_call_transcript(payload, db)

def utterance_exists(payload: UtteranceExistsPayload, db: Session)-> bool:
    call_id = payload.call_id
    start_duration = payload.start_duration
    end_duration = payload.end_duration
    conditions = [
        CallTranscript.call_id == call_id,
        CallTranscript.start_duration == start_duration,
        CallTranscript.end_duration == end_duration,
    ]
    if payload.transcript is not None:
        conditions.append(CallTranscript.transcript == payload.transcript)
    if payload.role is not None:
        conditions.append(CallTranscript.role == payload.role)
    stmt = select(CallTranscript).where(*conditions)
    transcript = db.scalars(stmt).first()
    return transcript is not None