from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ReasoningReportDTO(BaseModel):
    content: str = Field(..., description="Summary of AI reasoning and rationale for dispatch recommendation.")
    sopUsed: List[str] = Field(default_factory=list, description="List of SOP rule IDs referenced.")


class EmotionalAnalysisDTO(BaseModel):
    panicLevel: str = Field(..., description="Estimated caller panic level (e.g. High, Moderate, Low).")
    distressScore: float = Field(..., description="Distress score between 0.0 and 1.0.")
    speechRate: str = Field(..., description="Speech rate descriptor (e.g. Fast, Normal).")
    tremorDetected: bool = Field(..., description="Whether voice tremor was detected.")
    volumeTrend: str = Field(..., description="Volume trend (e.g. Escalating, Stable, Declining).")
    aiConfidence: float = Field(..., description="Confidence score of emotion analysis between 0.0 and 1.0.")
    contradiction: Optional[str] = Field(None, description="Any detected caller contradiction statement.")


class HumanInterventionDTO(BaseModel):
    required: bool = Field(..., description="Whether human dispatcher intervention was required.")
    interventionBy: Optional[str] = Field(None, description="Name or ID of dispatcher who intervened.")
    role: Optional[str] = Field(None, description="Role of the operator during intervention.")
    action: Optional[str] = Field(None, description="Action taken (e.g. OVERRIDE, APPROVE).")
    reason: Optional[str] = Field(None, description="Reason for operator intervention.")
    timestampLabel: Optional[str] = Field(None, description="Timestamp label when intervention occurred.")


class SupervisingReleaseDTO(BaseModel):
    inspector: str = Field(..., description="Name or badge number of supervising inspector.")
    status: int = Field(..., description="Release status code (e.g., 0 for confirmed, 1 for non-confirmed).")


class ClosingReportDTO(BaseModel):
    closedBy: str = Field(..., description="User or agent who closed the incident report.")
    closedAt: str = Field(..., description="ISO timestamp string when incident was closed.")
    outcome: str = Field(..., description="Final outcome summary of the closed incident.")
    caseStatus: str = Field(..., description="Status of closed case (e.g. CLOSED, PENDING_REVIEW, ESCALATED).")


class EventTimelineItemDTO(BaseModel):
    time: str = Field(..., description="Time marker for event.")
    event: str = Field(..., description="Description of event.")
    type: Optional[str] = Field(None, description="Category of event (system, ai, human, dispatch, close).")


class TranscriptItemDTO(BaseModel):
    time: str = Field(..., description="Timestamp marker for call transcript entry.")
    speaker: str = Field(..., description="Speaker label (e.g. Dispatcher, Caller, AI).")
    text: str = Field(..., description="Transcribed dialogue text.")


class HistoricalReportDTO(BaseModel):
    id: str
    title: str
    outcome: str
    incident_type: str
    severity: str
    location: str
    caller: str
    caller_number: Optional[str] = None
    spoken_dialects: List[str] = Field(default_factory=list)
    call_duration: str
    dispatch_confidence: float
    response_time_seconds: Optional[int] = None
    call_received_at: datetime
    dispatched_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    operator_verdict: str
    notes: Optional[str] = None
    incident_sha: str
    reasoning_report: ReasoningReportDTO
    sop_actions: List[str] = Field(default_factory=list)
    emotional_analysis: EmotionalAnalysisDTO
    human_intervention: Optional[HumanInterventionDTO] = None
    supervising_release: SupervisingReleaseDTO
    closing_report: ClosingReportDTO
    event_timeline: List[EventTimelineItemDTO] = Field(default_factory=list)
    transcript: List[TranscriptItemDTO] = Field(default_factory=list)
