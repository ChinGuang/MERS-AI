from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import declarative_base, relationship

from models.enum.index import IncidentType, SeverityType

Base = declarative_base()
# --- Models ---

class BaseTable(Base):
    __abstract__ = True
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class Dispatcher(BaseTable):
    __tablename__ = "dispatchers"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False) # Marked as FK in schema, adjust target if you have a Users table
    name = Column(String, nullable=False)
    badge_number = Column(String, nullable=False)
    status = Column(String, nullable=False)


class Incident(BaseTable):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    type = Column(Enum(IncidentType), nullable=True)
    coordinates = Column(ARRAY(Float), nullable=True)
    dispatch_center = Column(JSON, nullable=True)  # {id, name, lat, lng} - nearest EmergencyDispatchServiceLocation
    title= Column(String, nullable=False)
    location = Column(String, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    ai_summary = Column(String, nullable=True)
    dispatcher_id = Column(UUID(as_uuid=True), ForeignKey("dispatchers.id"), nullable=True)
    call= relationship("Call", lazy="joined")
    resolved_at = Column(DateTime, nullable=True)
    severity = Column(Enum(SeverityType), nullable=True)
    priority = Column(Integer, nullable=True)
    occur_date_time = Column(DateTime, nullable=True)
    distress_score = Column(Float, nullable=True)
    panic_level = Column(String, nullable=True)
    entities = Column(JSON, nullable=True)
    reason = Column(String, nullable=True)
    contradiction = Column(String, nullable=True)
    sop_citation = Column(String, nullable=True)
    sop_procedure = Column(JSON, nullable=True)
    responder = Column(JSON, nullable=True)  # Dict / Object
    timeline = Column(JSON, nullable=True)  # List[Dict]
    status = Column(JSON, nullable=True)

class IncidentLog(BaseTable):
    __tablename__ = "incident_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    payload = Column(JSONB, nullable=False)

class Call(BaseTable):
    __tablename__ = "calls"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    provider_sid = Column(String, nullable=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    caller_number = Column(String, nullable=False)
    caller_name = Column(String, nullable=True)
    audio_url = Column(String, nullable=True)
    received_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    lang = Column(String, nullable=True)


class CallTranscript(BaseTable):
    __tablename__ = "call_transcripts"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    start_duration = Column(Integer, nullable=False) # In milliseconds
    end_duration = Column(Integer, nullable=False)   # In milliseconds
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id"), nullable=False)
    transcript = Column(String, nullable=False)
    role = Column(String, nullable=False, server_default="user")  # "agent" or "user"


class AITriageAssessment(BaseTable):
    __tablename__ = "ai_triage_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    severity_score = Column(Integer, nullable=False)
    priority_level = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)


class AIEmotionAnalysis(BaseTable):
    __tablename__ = "ai_emotion_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    call_id = Column(UUID(as_uuid=True), ForeignKey("calls.id"), nullable=False)
    emotion_embeddings = Column(ARRAY(Float), nullable=False)
    start_duration = Column(Float, nullable=False)
    end_duration = Column(Float, nullable=False)
    model_used = Column(String, nullable=False)


class Hospital(BaseTable):
    __tablename__ = "hospitals"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    contact = Column(String, nullable=False)
    specializations = Column(JSONB, nullable=True)


class AIDispatchRecommendation(BaseTable):
    __tablename__ = "ai_dispatch_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    reasoning = Column(Text, nullable=False)
    status = Column(String, nullable=False)
    recommended_unit_ids = Column(JSONB, nullable=False)
    recommended_hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=True)


class DispatcherAction(BaseTable):
    __tablename__ = "dispatcher_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    dispatcher_id = Column(UUID(as_uuid=True), ForeignKey("dispatchers.id"), nullable=False)
    recommendation_id = Column(UUID(as_uuid=True), ForeignKey("ai_dispatch_recommendations.id"), nullable=False)
    action_type = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    age = Column(String, nullable=False)


class ResponseUnit(BaseTable):
    __tablename__ = "response_units"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    unit_number = Column(String, nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)


class Dispatch(BaseTable):
    __tablename__ = "dispatches"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("response_units.id"), nullable=False)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=True)
    dispatcher_id = Column(UUID(as_uuid=True), ForeignKey("dispatchers.id"), nullable=False)
    status = Column(String, nullable=False)
    dispatched_at = Column(DateTime, nullable=False)
    arrived_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class HospitalCapacity(Base):
    __tablename__ = "hospital_capacity"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=False)
    available_beds = Column(Integer, nullable=False)
    icu_beds = Column(Integer, nullable=False)
    er_status = Column(String, nullable=False)


class EmergencyDispatchServiceLocation(Base):
    __tablename__ = "emergency_dispatch_service_location"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    department = Column(Text, nullable=False)
    station_name = Column(Text, nullable=False)
    address = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)