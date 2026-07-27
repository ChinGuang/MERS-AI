"""
LiveKit Agents worker entrypoint for the MERS-AI fallback voice channel.

Run (from inside backend/, same convention as `fastapi run main.py`):

    pip install livekit-agents livekit-plugins-deepgram livekit-plugins-cartesia \
                livekit-plugins-silero livekit-plugins-google
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
"""

import logging

from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import cartesia, deepgram, google, silero

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

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(),
        llm=google.LLM(model=LIVEKIT_LLM_MODEL, api_key=GEMINI_API_KEY),
        tts=cartesia.TTS(),
    )

    @session.on("conversation_item_added")
    def _on_conversation_item(event: agents.ConversationItemAddedEvent) -> None:
        role = RetellRoleType.AGENT if event.item.role == "assistant" else RetellRoleType.USER
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
