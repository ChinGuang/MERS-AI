"""
LiveKit Agents worker entrypoint for the MERS-AI fallback voice channel.

Run (from inside backend/, same convention as `fastapi run main.py`):

    pip install livekit-agents livekit-plugins-google
    python -m livekit_agent.worker dev

This is a SEPARATE process from the main FastAPI app (`main.py`). It connects
to your LiveKit server/cloud project, and LiveKit dispatches it into a room
whenever a caller joins one created via room_service.py / api.py. It never
imports from or edits main.py, apis/*, or async_context_managers/* - it only
imports data-layer modules (DB, Redis, the SOP retriever) that are safe to
reuse read-only.

NOTE: the exact plugin/event names below (livekit.plugins.*, `AgentSession`,
`conversation_item_added`) match the livekit-agents 1.x API at time of
writing. If your installed version differs, check the LiveKit Agents docs
for the current `Agent`/`AgentSession` surface - the pipeline.py functions
this file calls do not need to change either way.

STT/TTS history: this originally used Deepgram (STT) + Cartesia (TTS).
Deepgram's `language="multi"` code-switch mode turned out to only cover
English+Spanish in practice - a Mandarin test came back transcribed as
garbled Spanish. Switched to Gemini's realtime voice model below instead,
since it handles STT+LLM+TTS in one pass using the SAME Gemini key already
in .env (no new accounts), and Gemini is broadly strong across English/
Malay/Chinese/Tamil. CAVEAT, stated plainly: I have not been able to verify
this exact class name/parameters against live docs (this API moves fast).
If `python -m livekit_agent.worker dev` fails on the import or on
`google.beta.realtime.RealtimeModel(...)`, paste me the error - the fix is
localized to this one block, nothing else in the file needs to change.
"""

import logging

from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import google

from livekit_agent.agent_prompts import ARIA_INSTRUCTIONS
from livekit_agent.config import GEMINI_API_KEY, LIVEKIT_LLM_MODEL
from livekit_agent.pipeline import (
    end_call,
    enqueue_transcript,
    get_or_create_call,
    mark_call_active,
    new_db_session,
)
from livekit_agent.sop_tool import sop_search
from models.dto.retell import RetellRoleType

logger = logging.getLogger("livekit_agent.worker")


class AriaFallbackAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=ARIA_INSTRUCTIONS, tools=[sop_search])


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    room_name = ctx.room.name
    db = new_db_session()
    internal_call_id, incident_id = get_or_create_call(room_name, db)
    mark_call_active(internal_call_id)
    logger.info(
        "[livekit_agent] room=%s call_id=%s incident_id=%s - session starting",
        room_name, internal_call_id, incident_id,
    )

    # Single realtime model handles STT+LLM+TTS in one pass - no separate VAD/STT/TTS
    # plugins needed, and no separate language config: Gemini detects and responds in
    # whatever language it hears (English/Malay/Chinese/Tamil) based on ARIA_INSTRUCTIONS,
    # rather than us pinning it to a fixed candidate list like a classic STT product would.
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model=LIVEKIT_LLM_MODEL,
            api_key=GEMINI_API_KEY,
        ),
    )

    @session.on("conversation_item_added")
    def _on_conversation_item(event: agents.ConversationItemAddedEvent) -> None:
        # conversation_item_added also fires for non-chat items (e.g. AgentHandoff),
        # which have no `.role` - confirmed via a real AttributeError in testing.
        item_role = getattr(event.item, "role", None)
        if item_role is None:
            return
        role = RetellRoleType.AGENT if item_role == "assistant" else RetellRoleType.USER
        text = getattr(event.item, "text_content", None) or ""
        enqueue_transcript(internal_call_id, role, text)

    async def _on_shutdown() -> None:
        logger.info("[livekit_agent] room=%s call_id=%s - session ending", room_name, internal_call_id)
        end_call(internal_call_id, db)
        db.close()

    ctx.add_shutdown_callback(_on_shutdown)

    await session.start(agent=AriaFallbackAgent(), room=ctx.room)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
