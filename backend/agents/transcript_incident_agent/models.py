from datetime import datetime
from pydantic import BaseModel

from models.enum.index import IncidentType, SeverityType

class ExtractedIncidentResponder(BaseModel):
    name: str | None
    type: str | None
    distance: str | None
    eta: str | None
    status: str | None
    paramedic: str | None

class ExtractedIncidentTimeline(BaseModel):
    time: str
    event: str
    isAlert: bool | None = None

class ExtractedIncident(BaseModel):
    type: IncidentType | None = None
    coordinates: list[float] | None = None
    title: str
    location: str | None = None
    ai_confidence: float | None = None
    ai_summary: str | None = None
    severity: SeverityType | None = None
    priority: int | None = None
    occur_date_time: datetime | None = None
    distress_score: float | None = None
    panic_level: str | None = None
    caller_name: str | None = None
    entities: list[str] | None = None
    reason: str | None = None
    contradiction: str | None = None
    sop_citation: str | None = None
    sop_procedure: list[str] | None = None
    responder: ExtractedIncidentResponder | None = None
    timeline: list[ExtractedIncidentTimeline] | None = None
