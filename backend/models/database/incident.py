from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel

from models.enum.index import SeverityType


class InitIncidentPayload(BaseModel):
    title: str
    case_number: Optional[str] = None

class InitIncidentLogPayload(BaseModel):
    incident_id: UUID
    payload: InitIncidentPayload

class QueryIncidentPayload(BaseModel):
    page: int
    size: int
    pattern: str | None

class UpdateIncidentPayload(BaseModel):
    title: Optional[str]
    ai_summary: Optional[str]
    severity: Optional[SeverityType]
    priority: Optional[int]
    sop_citation: Optional[str]
    sop_procedure: Optional[dict[str, Any]]