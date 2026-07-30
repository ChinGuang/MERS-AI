import asyncio
import logging
import time
from typing import Set
from uuid import UUID

from agents import dispatch_agent
from constants.redis_key import ACTIVE_CALLS_SET_KEY, INCIDENT_DISPATCH_SET_KEY
from async_context_managers import base
from agents.transcript_incident_agent.live_chain import live_chain
from agents.transcript_incident_agent.chain import format_utterances
from models.dto.dispatch_request import CreateDispatchRequestPayload
from models.dto.voice_agent import DispatchInputPayload
from modules import db_module, map_module, call_transcript_module, dispatch_request_module
from modules.redis_module import redis_client
from models.enum.index import IncidentType
from models.schema import Call, Incident, CallTranscript

logger = logging.getLogger(__name__)

LIVE_EXTRACT_INTERVAL = 10
DEBOUNCE_SECONDS = 3


def _get_active_call_ids() -> Set[str]:
    members = redis_client.smembers(ACTIVE_CALLS_SET_KEY)
    return set(members) if members else set()

def extract_incident_detail(transcript: list[CallTranscript]):
    return live_chain.invoke(format_utterances(transcript))

async def live_incident_extract_consumer():
    last_extracted: dict[str, float] = {}

    while base.keep_running:
        try:
            active_ids = _get_active_call_ids()
            now = time.time()

            for call_id_str in active_ids:
                last_time = last_extracted.get(call_id_str, 0)
                if now - last_time < LIVE_EXTRACT_INTERVAL:
                    continue

                call_id = UUID(call_id_str)
                utterances = call_transcript_module.read_transcripts(call_id, base.db)
                if not utterances:
                    continue

                # check debounce: wait for DEBOUNCE_SECONDS of silence
                last_utterance_time = max(u.created_at.timestamp() if u.created_at else 0 for u in utterances)
                if now - last_utterance_time < DEBOUNCE_SECONDS:
                    continue

                try:
                    # Every call below that hits the network (Gemini, Mapbox/Google
                    # geocoding, Google Maps) was being called directly instead of via
                    # asyncio.to_thread - a blocking call inside an `async def` freezes the
                    # ENTIRE event loop (this is single-threaded asyncio, not real
                    # concurrency) for its whole duration, starving every other consumer
                    # sharing it (transcript_livekit_process_consumer's queue got stuck
                    # again specifically because of this, confirmed once this consumer
                    # started actually running for the first time). Wrapped in to_thread.
                    extracted = await asyncio.to_thread(extract_incident_detail, utterances)
                    call = base.db.get(Call, call_id)
                    if call is None:
                        continue

                    incident = base.db.get(Incident, call.incident_id)
                    already_located = bool(incident and incident.coordinates and len(incident.coordinates) == 2)

                    update_payload = {"title": extracted.title}
                    # Skip re-extracting location once it's set (e.g. a pinned demo
                    # fallback for LiveKit calls, or a prior successful extraction) -
                    # avoids a live geocode call clobbering a known-good location with
                    # every poll.
                    if extracted.location and not already_located:
                        update_payload["location"] = extracted.location
                        geocode_details = await asyncio.to_thread(map_module.get_location_details, extracted.location)
                        if geocode_details is not None:
                            update_payload["location_address"] = geocode_details.address
                            update_payload["coordinates"] = geocode_details.coordinates
                    if extracted.type:
                        try:
                            update_payload["type"] = IncidentType(extracted.type.lower())
                        except ValueError:
                            logger.warning("Invalid incident type: %s", extracted.type)
                    if extracted.location and extracted.type:
                        has_dispatch = redis_client.sismember(INCIDENT_DISPATCH_SET_KEY, str(call.incident_id))
                        if not has_dispatch:
                            try:
                                redis_client.sadd(INCIDENT_DISPATCH_SET_KEY, str(call.incident_id))
                                dispatch_result = await asyncio.to_thread(
                                    dispatch_agent.get_dispatch,
                                    base.db,
                                    DispatchInputPayload(
                                        incident_type=extracted.type,
                                        incident_location=extracted.location
                                    ),
                                )
                                dispatch_request_module.create_dispatch_request(CreateDispatchRequestPayload(
                                    incident_fkid=call.incident_id,
                                    incident_coordinate=list(dispatch_result["incident"]),
                                    incident_location=extracted.location,
                                    nearest_service_station_id=dispatch_result["nearest_service_station_id"],
                                    distance=dispatch_result["distance"],
                                    eta=dispatch_result["ETA"],
                                ),base.db)
                                base.db.commit()
                            except Exception as e:
                                logger.error("Failed to create dispatch request for incident %s: %s", call.incident_id, e)
                                redis_client.srem(INCIDENT_DISPATCH_SET_KEY, str(call.incident_id))
                    db_module.update_data_by_id(call.incident_id, update_payload, base.db, Incident)
                    base.db.commit()

                    last_extracted[call_id_str] = now
                    logger.info("Live extracted: %s — %s", call_id_str, extracted.title)

                except Exception as e:
                    # Was a bare `raise e` - since this whole function is one long-lived
                    # asyncio.create_task() with nothing awaiting/checking its result, an
                    # uncaught exception here doesn't just skip one call, it silently kills
                    # this ENTIRE background consumer forever (confirmed: dispatch_agent's
                    # broken Gemini model name alone would trigger this on the very first
                    # call with both a location and type extracted). Log and keep going.
                    logger.warning("Live extraction failed for %s: %s", call_id_str, e)
                    try:
                        base.db.rollback()
                    except Exception as rollback_err:
                        logger.error("Failed to roll back shared session: %s", rollback_err)

        except Exception as e:
            logger.error("live_incident_extract_consumer loop error: %s", e)
            try:
                base.db.rollback()
            except Exception as rollback_err:
                logger.error("Failed to roll back shared session: %s", rollback_err)

        await asyncio.sleep(1)
