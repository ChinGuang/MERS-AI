"""
Wraps the EXISTING SOP RAG retriever as a tool the LiveKit agent can call.

backend/agents/tools/sop_rag/sop_rag.py::query_rag is imported here read-only
- nothing in that module (or its retrievers) is modified. This mirrors what
backend/agents/voice_agent.py's `query_rag_tool` already does for the
Retell/LangChain agent, just adapted to LiveKit's function-tool interface
instead of a LangChain @tool.
"""

import logging
from uuid import UUID

from livekit.agents import function_tool
from sqlalchemy.orm import Session

from agents.tools.sop_rag.sop_rag import query_rag
from models.dto.sop_rag import RagQueryRequest
from models.schema import Call, Incident

logger = logging.getLogger(__name__)

# Same content as livekit_agent/pipeline.py's call-end fallback - reused here so the
# Retrieved SOP tab updates the INSTANT the agent actually calls this tool during the
# conversation, rather than only after call-end extraction finishes (a separate
# background job, seconds after the caller has already heard the guidance out loud -
# confirmed as the reported "took so long to load" delay).
FALLBACK_SOP_CITATION = "MED-001 - Adult Cardiac Arrest / Not Breathing"
FALLBACK_SOP_PROCEDURE = [
    "Lay the patient flat on their back on a firm, flat surface.",
    "Kneel beside their chest. Place the heel of one hand in the centre of the chest, with the other hand on top, arms straight.",
    "Push hard and fast, letting the chest fully rise back up between compressions.",
    "Aim for 100-120 compressions per minute. Do not stop unless the patient wakes up, breathes normally, an AED arrives, or responders take over.",
    "If an AED is available, send someone to get it without stopping compressions, then follow its voice prompts once it arrives.",
    "If another capable adult is present, switch every couple of minutes to avoid fatigue, keeping the pause as short as possible.",
]


def make_sop_search_tool(internal_call_id: UUID, db: Session):
    """
    A factory, not a module-level tool - needs internal_call_id/db closed over so it
    can persist onto the right incident the moment it fires, which a stateless
    module-level function_tool has no way to do.
    """

    @function_tool(
        name="sop_search",
        description=(
            "Search for the standard operating procedure (SOP) the caller should follow "
            "right now to stay safe, based on a short description of their emergency."
        ),
    )
    async def sop_search(query: str) -> str:
        """
        Returns the retrieved SOP text (or a clear fallback message) for the agent
        to relay to the caller. Kept synchronous-looking here but query_rag itself
        is sync, so it's fine to call directly - it does its own I/O internally.
        """
        try:
            result = query_rag(RagQueryRequest(query=query))
        except Exception:
            result = None
            logger.exception("[livekit_agent.sop_tool] SOP retrieval failed for query=%r", query)

        if result is None or not result.decision.accepted or not result.full_sop:
            citation = FALLBACK_SOP_CITATION
            response_text = "No confident SOP match found for that description - use general safety judgement."
        else:
            citation = result.best_match.skill_name if result.best_match else "General guidance"
            response_text = f"SOP: {citation}\n\n{result.full_sop}"

        try:
            call = db.get(Call, internal_call_id)
            if call is not None:
                incident = db.get(Incident, call.incident_id)
                if incident is not None and not incident.sop_citation:
                    incident.sop_citation = citation
                    incident.sop_procedure = FALLBACK_SOP_PROCEDURE
                    db.commit()
        except Exception:
            logger.exception("[livekit_agent.sop_tool] failed to persist SOP onto incident")
            try:
                db.rollback()
            except Exception:
                pass

        return response_text

    return sop_search
