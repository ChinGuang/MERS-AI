import logging
from uuid import UUID

from sqlalchemy.orm import Session

from agents.transcript_incident_agent.chain import chain, format_utterances
from models.schema import Call, Incident
from modules import db_module, map_module, call_transcript_module, historical_report_module

logger = logging.getLogger(__name__)


def run_incident_extraction(call_id: UUID, db: Session) -> None:
    call = db.get(Call, call_id)
    if call is None:
        logger.error("Call %s not found", call_id)
        return

    incident = db.get(Incident, call.incident_id)
    if incident is None:
        logger.error("Incident for call %s not found", call_id)
        return

    if incident.ai_summary is not None:
        logger.info("Incident %s already fully extracted, skipping", incident.id)
        return

    utterances = call_transcript_module.read_transcripts(call_id, db)
    if not utterances:
        logger.warning("No transcripts found for call %s", call_id)
        return

    transcript_str = format_utterances(utterances)

    try:
        extracted = chain.invoke({"transcript": transcript_str})
        already_located = bool(incident.coordinates and len(incident.coordinates) == 2)
        if extracted.location and not already_located:
            geocode_details = map_module.get_location_details(extracted.location)
            if geocode_details is not None:
                extracted.location_address = geocode_details.address
                extracted.coordinates = geocode_details.coordinates
        payload = extracted.model_dump(exclude_none=True)
        if already_located:
            # Don't clobber a location set earlier (e.g. a pinned fallback for LiveKit
            # calls, or a confident mid-call extraction) with this final pass's guess.
            payload.pop("location", None)
            payload.pop("location_address", None)
            payload.pop("coordinates", None)

        # caller_name belongs to Call, not Incident (Incident has no such column -
        # setattr on it would silently no-op rather than persist) - route it there,
        # only when the transcript actually stated one.
        caller_name = payload.pop("caller_name", None)
        if caller_name and not call.caller_name:
            call.caller_name = caller_name

        # responder.distance/eta/name/paramedic are computed deterministically
        # elsewhere (real haversine distance to the actual matched dispatch station -
        # see livekit_agent/pipeline.py's apply_fallback_incident_data, which runs at
        # call end BEFORE this extraction). This chain's own `responder` field only
        # reflects what the transcript literally said (e.g. type/status), and a
        # transcript has no way to state a real distance/ETA - db_module.update_data_by_id
        # does a blind column overwrite, so without this, a real, complete responder
        # set moments earlier gets clobbered down to whatever partial dict the LLM
        # returned (confirmed: a real case ended up with just {"type", "status"},
        # losing its already-computed distance/ETA/unit/lead).
        extracted_responder = payload.get("responder")
        if extracted_responder is not None and incident.responder:
            for key in ("name", "distance", "eta", "paramedic"):
                if incident.responder.get(key):
                    extracted_responder[key] = incident.responder[key]

        db_module.update_data_by_id(incident.id, payload, db, Incident)
        db.commit()
        logger.info("Successfully extracted incident %s from call %s", incident.id, call_id)

        try:
            historical_report_module.create_or_update_historical_report(call_id, db)
        except Exception:
            logger.exception("Failed to create historical report for call %s", call_id)
            db.rollback()
    except Exception as e:
        logger.error("Extraction failed for call %s: %s", call_id, e)
        db_module.update_data_by_id(incident.id, {
            "status": {"stage": "draft", "extraction_error": str(e)},
            "reason": "Extraction failed, pending manual review",
        }, db, Incident)
        db.commit()
