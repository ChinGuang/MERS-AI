import logging
from uuid import UUID

from sqlalchemy.orm import Session

from agents.transcript_incident_agent.chain import chain, format_utterances
from models.schema import Call, Incident
from modules import db_module, map_module, call_transcript_module

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
        if extracted.location:
            geocode_details = map_module.get_location_details(extracted.location)
            if geocode_details is not None:
                extracted.location_address = geocode_details.address
                extracted.coordinates = geocode_details.coordinates
        payload = extracted.model_dump(exclude_none=True)

        db_module.update_data_by_id(incident.id, payload, db, Incident)
        db.commit()
        logger.info("Successfully extracted incident %s from call %s", incident.id, call_id)
    except Exception as e:
        logger.error("Extraction failed for call %s: %s", call_id, e)
        db_module.update_data_by_id(incident.id, {
            "status": {"stage": "draft", "extraction_error": str(e)},
            "reason": "Extraction failed, pending manual review",
        }, db, Incident)
        db.commit()
