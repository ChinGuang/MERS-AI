from uuid import UUID

from pydantic import BaseModel


class CreateCallTranscriptPayload(BaseModel):
    start_duration: int
    end_duration: int
    call_id: UUID
    transcript: str
    role: str
    language: str | None = None
    translated_text: str | None = None

class UtteranceExistsPayload(BaseModel):
    call_id: UUID
    start_duration: int
    end_duration: int
    transcript: str | None = None
    role: str | None = None