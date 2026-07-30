"""
Location Detection Agent (LangChain + Gemini)
----------------------------------------------------------------------------
Triggered directly from apis/websocket.py's Retell LLM websocket handler,
on the "update_only" event — reads straight from event.transcript (Retell's
live utterance list), NOT from the call_transcripts table. DB is only used
to look up/update the Incident row, not to source the transcript text.

Requires env vars: GEMINI_API_KEY, MAPBOX_TOKEN
Requires packages: langchain-google-genai, langchain-core, requests, rapidfuzz
"""

import asyncio
from math import atan2, cos, radians, sin, sqrt
from uuid import UUID
from typing import Optional, Iterable, List

import requests
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from rapidfuzz import fuzz

from environment import GEMINI_API_KEY, MAPBOX_TOKEN
from models.schema import Incident, Call, EmergencyDispatchServiceLocation
from models.dto.retell import RetellRoleType

MODEL = "gemini-2.5-flash"
MIN_CONFIDENCE = 0.70          # Gemini's own confidence that a location was mentioned at all
CONFIDENT_MATCH_SCORE = 0.90   # above this: treat the geocode match as solid, no flag needed
MIN_SAVE_SCORE = 0.30          # absolute floor — below this, don't save anything, too unreliable
MIN_NEW_CHARS = 25             # don't re-check on every tiny partial update

# Known landmarks: a small, exact-coordinate shortcut for locations worth bypassing
# Mapbox's own fuzzy geocoding for entirely. Motivating case, confirmed via real
# transcripts across several test calls: STT mishears this specific name differently
# almost every time - "PJ" has come back as "Biji" and "PGA", and even the
# distinctive "Gamuda" itself came back as "Mudah" once. No single keyword survives
# every variant, so this matches on overall phrase similarity (rapidfuzz
# token_sort_ratio against the full canonical name) instead of any one substring -
# confirmed via direct testing that every garbled variant seen so far scores
# 65+, while unrelated locations score well under that.
_KNOWN_LANDMARKS = [
    {
        "match_phrase": "menara gamuda pj trade centre",
        "canonical_name": "Menara Gamuda, PJ Trade Centre, Damansara Perdana, Petaling Jaya, Selangor",
        "lat": 3.099973,
        "lng": 101.64656,
    },
]
_LANDMARK_FUZZY_THRESHOLD = 65


def _match_known_landmark(query_text: str) -> Optional[dict]:
    if not query_text:
        return None
    query_lower = query_text.lower()
    best_landmark, best_score = None, 0
    for landmark in _KNOWN_LANDMARKS:
        score = fuzz.token_sort_ratio(query_lower, landmark["match_phrase"])
        if score > best_score:
            best_landmark, best_score = landmark, score
    if best_landmark and best_score >= _LANDMARK_FUZZY_THRESHOLD:
        return best_landmark
    return None


class ExtractedLocation(BaseModel):
    found: bool = Field(
        description="Whether a current Malaysian location was detected."
    )

    raw_location: str = Field(
        description="Exactly what the caller said."
    )

    normalized_query: str = Field(
        description=(
            "Best normalized Malaysian search query suitable for Mapbox. "
            "Infer missing locality if confidence is high."
        )
    )

    location_type: str = Field(
        description=(
            "road, address, building, landmark, mall, hospital, school, "
            "petrol_station, apartment, highway, intersection, village, city."
        )
    )

    spoken_fragments: List[str] = Field(default_factory=list)

    confidence: float = Field(
        description="Confidence between 0.0 and 1.0."
    )

    needs_confirmation: bool = Field(
        description="True if location is ambiguous."
    )

    reasoning: str = Field(
        description="Explain briefly why this location was selected."
    )


# --- LLM + prompt + chain, same shape as your translator example ---
llm = ChatGoogleGenerativeAI(
    model=MODEL,
    temperature=0.0,
    api_key=GEMINI_API_KEY,
)

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """ You are a Malaysian Emergency Dispatch Location Extraction Agent.
            Your job is to determine the caller's CURRENT location.
            The caller may only mention:
              - Road names
              - Landmarks
              - Shopping malls
              - Petrol stations
              - Hospitals
              - Schools
              - Apartment names
              - Condominiums
              - Kampung
              - Taman
              - Highways
              - LRT/MRT stations
              - Business names
              - Building names
              
              Always assume the location is inside Malaysia.
              Never extract:
              - destination
              - previous location
              - another person's address
              - historical addresses
              
              Instead of copying the transcript, infer the BEST searchable location.
              Examples:
              Caller:"Saya dekat Sunway Pyramid"
              
              Return:
              normalized_query: Sunway Pyramid Shopping Mall, Bandar Sunway, Selangor

              ----------------------------------
              Caller:"Saya dekat HKL"
              Return: Hospital Kuala Lumpur

              ----------------------------------
              Caller:"Depan Mid Valley"
              Return: Mid Valley Megamall Kuala Lumpur

              ----------------------------------
              Caller:"Jalan Ipoh"
              Return: Jalan Ipoh Kuala Lumpur
              
              If multiple places match:
              - choose the most likely
              - lower confidence
              - set needs_confirmation=true
              
              Confidence guide
              
              1.00
              Complete address
              
              0.98
              Unique building
              
              0.95
              Unique hospital
              
              0.93
              Unique shopping mall

              0.90
              Unique road
 
              0.80
              Known landmark

              0.70
              District only

              0.50
              City only

              0.20
              Unknown

              Return JSON only.
            """,
        ),
        (
            "human",
            "Transcript so far:\n\n{transcript}",
        ),
    ]
)

# Structured output instead of StrOutputParser — we need JSON fields (found,
# query_text, confidence, ...), not free text like the translator does.
location_chain = prompt | llm.with_structured_output(ExtractedLocation)

# In-memory per-call cache so we don't re-check on every tiny partial transcript
# update Retell sends. Keyed by internal call_id (str) -> last-checked text length.
_last_checked_length: dict[str, int] = {}


def flatten_utterances(utterances: Iterable) -> str:
    """
    Turn Retell's event.transcript (list of utterance objects with .role/.content)
    into plain text for the LLM. Matches the same "Operator:"/"Caller:" convention
    used elsewhere in the project.
    """
    lines = []
    for u in utterances:
        role = getattr(u, "role", None)
        content = getattr(u, "content", None)
        if not content:
            continue
        speaker = "Operator" if role == RetellRoleType.AGENT else "Caller"
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines)


def should_check_location(call_id: str, transcript_text: str) -> bool:
    """
    Cheap gate so we don't fire a Gemini call on every single partial
    transcript update — only once enough new content has accumulated.
    """
    last_len = _last_checked_length.get(call_id, 0)
    if len(transcript_text) - last_len < MIN_NEW_CHARS:
        return False
    _last_checked_length[call_id] = len(transcript_text)
    return True


def _nearest_dispatch_point(db: Session) -> Optional[dict]:
    """
    Used only as a proximity bias for geocoding ambiguous place names, BEFORE
    the caller's location is known - there's nothing to compute "nearest" to
    yet at this point in the flow, so this just grabs a station as a rough
    Malaysia-area anchor for Mapbox. The actual nearest-station lookup that
    matters (used for the dispatch/route origin shown on the map) happens in
    _nearest_service_location() below, once real coordinates exist.
    """
    stmt = select(EmergencyDispatchServiceLocation).limit(1)
    station = db.scalars(stmt).first()
    if not station:
        return None
    return {"lat": station.latitude, "lng": station.longitude}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlambda / 2) ** 2
    return 2 * radius_km * atan2(sqrt(a), sqrt(1 - a))


def _nearest_service_location(lat: float, lng: float, db: Session) -> Optional[dict]:
    """
    Real nearest-neighbor over every known EmergencyDispatchServiceLocation,
    computed once the caller's coordinates are actually resolved. This is
    what gets saved onto incident.dispatch_center - the map's route origin -
    as opposed to _nearest_dispatch_point() above, which only has a rough
    anchor available before the caller's location is known.
    """
    stations = db.scalars(select(EmergencyDispatchServiceLocation)).all()
    if not stations:
        return None

    nearest = min(stations, key=lambda s: _haversine_km(lat, lng, s.latitude, s.longitude))
    return {
        "id": str(nearest.id),
        "name": nearest.station_name,
        "lat": nearest.latitude,
        "lng": nearest.longitude,
    }


def _geocode(query_text: str, proximity: Optional[dict]) -> Optional[dict]:
    """
    Always returns the BEST available match (if Mapbox returned anything at
    all), along with a match_score (0-1, fuzzy similarity between the query
    and the result). It no longer silently discards weak matches — that
    decision now belongs to the caller, which saves weak matches flagged
    as approximate instead of saving nothing.
    """
    if not MAPBOX_TOKEN:
        raise RuntimeError("MAPBOX_TOKEN is not configured.")

    params = {
        "access_token": MAPBOX_TOKEN,
        "limit": 2,
        "country": "MY",
        "language": "en",
        "types": "address,poi,place,locality,neighborhood",
    }

    if proximity:
        params["proximity"] = f"{proximity['lng']},{proximity['lat']}"

    url = (
        "https://api.mapbox.com/geocoding/v5/mapbox.places/"
        f"{requests.utils.quote(query_text)}.json"
    )

    response = requests.get(url, params=params, timeout=10)
    if response.status_code != 200:
        print("[location_agent] Mapbox error:")
        print(response.text)
        return None

    data = response.json()
    features = data.get("features", [])

    if not features:
        return None

    best_feature = None
    best_score = 0

    for feature in features:
        score = (
            fuzz.token_sort_ratio(
                query_text.lower(),
                feature["place_name"].lower()
            ) / 100
        )
        if score > best_score:
            best_score = score
            best_feature = feature

    if best_feature is None:
        return None

    lng, lat = best_feature["center"]

    return {
        "lat": lat,
        "lng": lng,
        "place_name": best_feature["place_name"],
        "match_score": best_score,
    }


async def extract_and_update_incident_location_from_text(
    internal_call_id: UUID, transcript_text: str, db: Session
) -> None:
    """
    Main entry point — call this from the websocket handler's "update_only"
    branch, passing event.transcript flattened via flatten_utterances().

    Saves the best available location even when the geocode match is weak,
    flagging it as approximate (prefixes incident.location with "(Approx)"
    and stores the blended confidence in incident.ai_confidence) so a
    dispatcher can see at a glance that it needs manual confirmation —
    rather than showing nothing at all.
    """
    call = db.get(Call, internal_call_id)
    if call is None:
        print(f"[location_agent] No call found for call_id={internal_call_id}")
        return

    incident = db.get(Incident, call.incident_id)
    if incident is None:
        print(f"[location_agent] No incident found for call_id={internal_call_id}")
        return

    # Already located — stop spending API calls for this call.
    if incident.coordinates and len(incident.coordinates) == 2:
        return

    if not transcript_text.strip():
        return

    # NOTE: every print() in this function was previously prefixed with an emoji
    # (search/cross/rocket/etc.). On Windows, the default console encoding is cp1252,
    # which can't encode most emoji - print() would raise UnicodeEncodeError on the
    # very first line below, before ever reaching the actual Gemini/Mapbox call. That
    # silently killed every single invocation of this function when called from a
    # Windows console process (confirmed via a live repro). Plain ASCII only, now.
    print(f"[location_agent] Extracting location from transcript for call_id={internal_call_id}...")
    try:
        extracted: ExtractedLocation = await location_chain.ainvoke({"transcript": transcript_text})
    except Exception as e:
        print(f"[location_agent] extraction failed for call_id={internal_call_id}: {e}")
        return

    print(
        f"[location_agent]    found={extracted.found}, confidence={extracted.confidence}, "
        f"query='{extracted.normalized_query}', needs_confirmation={extracted.needs_confirmation}"
    )

    if not extracted.found or not extracted.normalized_query:
        print("[location_agent] skipped (nothing found)")
        return

    if extracted.confidence < MIN_CONFIDENCE:
        print(f"[location_agent] skipped (Gemini confidence below {MIN_CONFIDENCE})")
        return

    landmark = _match_known_landmark(extracted.normalized_query) or _match_known_landmark(extracted.raw_location)
    if landmark:
        print(f"[location_agent] matched known landmark: {landmark['canonical_name']}")
        incident.coordinates = [landmark["lat"], landmark["lng"]]
        incident.location = landmark["canonical_name"]
        incident.ai_confidence = round(extracted.confidence, 2)
        dispatch_center = _nearest_service_location(landmark["lat"], landmark["lng"], db)
        if dispatch_center:
            incident.dispatch_center = dispatch_center
            print(f"[location_agent] nearest service location: {dispatch_center['name']}")
        db.commit()
        return

    print(f"[location_agent] Geocoding '{extracted.normalized_query}' via Mapbox...")
    try:
        proximity = _nearest_dispatch_point(db)
        coords = await asyncio.to_thread(_geocode, extracted.normalized_query, proximity)
    except Exception as e:
        print(f"[location_agent] geocoding failed for call_id={internal_call_id}: {e}")
        return

    if not coords:
        print(f"[location_agent] geocoding returned no results for '{extracted.normalized_query}'")
        return

    final_score = min(1.0, extracted.confidence * 0.4 + coords["match_score"] * 0.6)

    if final_score < MIN_SAVE_SCORE:
        print(
            f"[location_agent] discarded - final_score too low "
            f"(Gemini={extracted.confidence:.2f}, Mapbox={coords['match_score']:.2f}, "
            f"final={final_score:.2f})"
        )
        return

    is_approximate = final_score < CONFIDENT_MATCH_SCORE or extracted.needs_confirmation

    # Prefer what Gemini understood the caller to actually say (e.g. "Menara Gamuda PJ
    # Trade Centre") over Mapbox's own place_name for the matched pin. Mapbox's fuzzy
    # match often lands on the nearest geocodable point it has an entry for - a road,
    # a district, a nearby landmark - which can be a real match on the map (coordinates
    # are still fine) but a much less specific/recognizable label than the building
    # name the caller actually gave. The "(Approx)" prefix below already communicates
    # when the match was weak; the label itself should stay the caller's own words.
    location_text = extracted.normalized_query or coords.get("place_name") or "Unknown location"
    if is_approximate:
        location_text = f"(Approx) {location_text}"

    incident.coordinates = [coords["lat"], coords["lng"]]
    incident.location = location_text
    incident.ai_confidence = round(final_score, 2)

    dispatch_center = _nearest_service_location(coords["lat"], coords["lng"], db)
    if dispatch_center:
        incident.dispatch_center = dispatch_center
        print(f"[location_agent] nearest service location: {dispatch_center['name']}")

    db.commit()

    status = "APPROXIMATE - needs confirmation" if is_approximate else "confident"
    print(
        f"[location_agent] incident {incident.id} located at "
        f"{{'lat': {coords['lat']}, 'lng': {coords['lng']}}} "
        f"[{status}, final_score={final_score:.2f}] (query: '{extracted.normalized_query}')"
    )