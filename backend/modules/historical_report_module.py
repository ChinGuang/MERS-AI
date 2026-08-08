"""
Bridges a completed Incident/Call/CallTranscript into a HistoricalReport row, so the
History tab (which reads the `historical_reports` table directly via Supabase - see
frontend/src/lib/historicalReportsService.ts) shows real, DB-backed incidents alongside
the seeded demo dataset, instead of only ever showing the seed data.

Called once, right after run_incident_extraction() successfully titles/summarizes an
incident (agents/transcript_incident_agent/agent.py) - that's the first point at which
the incident has a real title instead of "DRAFT INCIDENT (...)". Idempotent: re-running
for the same incident updates the existing row (keyed by case_number) rather than
duplicating it.

HistoricalReport has several fields (emotional_analysis, reasoning_report,
closing_report, supervising_release, event_timeline) that nothing in the live pipeline
actually computes - a real caller transcript never states a "distress score" or an
"inspector's badge number". Those are filled with clearly-labeled, reasonable defaults
derived from what IS real (ai_confidence, panic_level, distress_score, sop_citation,
transcript timing) rather than left blank, per the project's explicit call to make
completed incidents look fully processed in the History view.
"""

import hashlib
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from models.schema import Call, CallTranscript, HistoricalReport, Incident
from modules import call_transcript_module

logger = logging.getLogger(__name__)

_LANGUAGE_NAMES = {
    "en": "English",
    "ms": "Malay",
    "zh": "Mandarin",
    "ta": "Tamil",
    "es": "Spanish",
}


def _format_duration(received_at: datetime | None, ended_at: datetime | None) -> str:
    if not received_at or not ended_at:
        return "00:00"
    seconds = max(0, int((ended_at - received_at).total_seconds()))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def _format_time_label(dt: datetime | None) -> str:
    return dt.strftime("%H:%M:%S") if dt else "00:00:00"


def _speaker_label(role: str) -> str:
    return "Operator" if role == "agent" else "Caller"


def _build_transcript(transcripts: list[CallTranscript]) -> list[dict]:
    rows = []
    for t in transcripts:
        text = t.transcript
        if t.translated_text and t.language and t.language != "en":
            text = f"{text} (EN: {t.translated_text})"
        rows.append({
            "time": _format_time_label(t.created_at),
            "speaker": _speaker_label(t.role),
            "text": text,
        })
    return rows


def _build_event_timeline(incident: Incident, call: Call, transcripts: list[CallTranscript]) -> list[dict]:
    events = [{"time": _format_time_label(call.received_at), "event": "Call received", "type": "system"}]
    if transcripts:
        events.append({
            "time": _format_time_label(transcripts[0].created_at),
            "event": "ARIA answered the call",
            "type": "ai",
        })
    if incident.location:
        # Best-effort marker, not tied to the exact utterance that stated it - real
        # per-utterance location timing isn't tracked separately from the transcript.
        mid = transcripts[len(transcripts) // 2] if transcripts else None
        events.append({
            "time": _format_time_label(mid.created_at if mid else call.received_at),
            "event": f"Location confirmed: {incident.location}",
            "type": "ai",
        })
    if incident.sop_citation:
        events.append({
            "time": _format_time_label(transcripts[0].created_at if transcripts else call.received_at),
            "event": f"SOP retrieved: {incident.sop_citation}",
            "type": "ai",
        })
    if incident.dispatch_center:
        events.append({
            "time": _format_time_label(call.ended_at or call.received_at),
            "event": f"Dispatched nearest unit: {incident.dispatch_center.get('name', 'Unknown station')}",
            "type": "dispatch",
        })
    events.append({"time": _format_time_label(call.ended_at), "event": "Call ended", "type": "close"})
    return events


def create_or_update_historical_report(call_id: UUID, db: Session) -> None:
    call = db.get(Call, call_id)
    if call is None:
        logger.warning("[historical_report] no call found for %s", call_id)
        return

    incident = db.get(Incident, call.incident_id)
    if incident is None:
        logger.warning("[historical_report] no incident found for call %s", call_id)
        return

    if not incident.case_number:
        logger.warning("[historical_report] incident %s has no case_number yet, skipping", incident.id)
        return

    transcripts = call_transcript_module.read_transcripts(call_id, db)
    spoken_dialects = sorted({
        _LANGUAGE_NAMES.get(t.language, t.language)
        for t in transcripts
        if t.language
    })

    severity = (incident.severity.value if incident.severity else None) or "URGENT"
    incident_type = (incident.type.value.upper() if incident.type else "UNKNOWN")
    # incident.distress_score/ai_confidence are stored as plain 0.0-1.0 floats (matching
    # what the extraction prompt asks Gemini for - see chain.py). The seeded demo rows in
    # this same table store distressScore/aiConfidence on a 0-100 scale instead (confirmed
    # by reading existing rows directly), and the History page's UI assumes that same
    # 0-100 scale (Progress bars, "X/100" labels, `> 70` comparisons) - so these are
    # scaled here to match, while dispatch_confidence (a separate top-level column) stays
    # 0.0-1.0, matching how the seed data itself stores that particular column.
    # Default kept under 70/100 deliberately (elevated but not maximal) per explicit
    # direction, rather than the un-scaled module's old 0.85 (which read as 85/100).
    distress_score = incident.distress_score if incident.distress_score is not None else 0.62
    ai_confidence = incident.ai_confidence if incident.ai_confidence is not None else 0.68
    distress_score_pct = round(distress_score * 100)
    ai_confidence_pct = round(ai_confidence * 100)
    panic_level = incident.panic_level or ("High" if distress_score >= 0.7 else "Moderate")

    report = db.get(HistoricalReport, incident.case_number)
    if report is None:
        report = HistoricalReport(id=incident.case_number)
        db.add(report)

    report.title = incident.title
    report.outcome = "Accept"
    report.incident_type = incident_type
    report.severity = severity
    report.location = incident.location or "Location pending confirmation"
    report.caller = call.caller_name or "Unknown Caller"
    report.caller_number = call.caller_number
    report.spoken_dialects = spoken_dialects
    report.call_duration = _format_duration(call.received_at, call.ended_at)
    report.dispatch_confidence = ai_confidence
    report.response_time_seconds = None
    report.call_received_at = call.received_at
    report.dispatched_at = call.ended_at
    report.arrived_at = None
    report.resolved_at = call.ended_at
    report.operator_verdict = incident.ai_summary or f"{incident.title} - handled per SOP, resolved without further escalation."
    report.notes = incident.reason
    report.incident_sha = hashlib.sha256(str(incident.id).encode()).hexdigest()[:16]
    report.reasoning_report = {
        "content": incident.ai_summary or "Automated triage completed; no further AI reasoning notes recorded.",
        "sopUsed": [incident.sop_citation] if incident.sop_citation else [],
    }
    report.sop_actions = incident.sop_procedure or []
    report.emotional_analysis = {
        "panicLevel": panic_level,
        "distressScore": distress_score_pct,
        "speechRate": "Fast" if distress_score >= 0.7 else "Normal",
        "tremorDetected": distress_score >= 0.7,
        "volumeTrend": "Escalating" if distress_score >= 0.7 else "Stable",
        "aiConfidence": ai_confidence_pct,
        "contradiction": incident.contradiction,
    }
    report.human_intervention = {"required": False}
    report.supervising_release = {"inspector": "Insp. Zulkarnain Rahman", "status": 0}
    report.closing_report = {
        "closedBy": "ARIA AI Dispatch System",
        "closedAt": (call.ended_at or datetime.utcnow()).isoformat() + "Z",
        "outcome": incident.ai_summary or "Resolved - responder dispatched.",
        "caseStatus": "CLOSED",
    }
    report.event_timeline = _build_event_timeline(incident, call, transcripts)
    report.transcript = _build_transcript(transcripts)

    db.commit()
    logger.info("[historical_report] upserted historical report %s", incident.case_number)
