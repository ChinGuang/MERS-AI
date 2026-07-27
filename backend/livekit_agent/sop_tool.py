"""
Wraps the EXISTING SOP RAG retriever as a tool the LiveKit agent can call.

backend/agents/tools/sop_rag/sop_rag.py::query_rag is imported here read-only
- nothing in that module (or its retrievers) is modified. This mirrors what
backend/agents/voice_agent.py's `query_rag_tool` already does for the
Retell/LangChain agent, just adapted to LiveKit's function-tool interface
instead of a LangChain @tool.
"""

import logging

from livekit.agents import function_tool

from agents.tools.sop_rag.sop_rag import query_rag
from models.dto.sop_rag import RagQueryRequest

logger = logging.getLogger(__name__)


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
        logger.exception("[livekit_agent.sop_tool] SOP retrieval failed for query=%r", query)
        return "No specific SOP could be retrieved right now - use general safety judgement."

    if result is None or not result.decision.accepted or not result.full_sop:
        return "No confident SOP match found for that description - use general safety judgement."

    citation = result.best_match.skill_name if result.best_match else "General guidance"
    return f"SOP: {citation}\n\n{result.full_sop}"
