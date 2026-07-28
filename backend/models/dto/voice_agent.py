from typing import Optional, Any

from pydantic import BaseModel

from models.enum.index import SeverityType

class IncidentUpdatePayload(BaseModel):
    title: Optional[str]
    ai_summary: Optional[str]
    severity: Optional[SeverityType]
    priority: Optional[int]
    sop_citation: Optional[str]
    sop_procedure: Optional[dict[str, Any]]


class VoiceAgentResponse(BaseModel):
    content: str
    incident_update:IncidentUpdatePayload

class DispatchInputPayload(BaseModel):
    incident_location: str
    incident_type: str