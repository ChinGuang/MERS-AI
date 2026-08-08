"""
LiveKit Agents worker entrypoint for the MERS-AI fallback voice channel.

Run (from inside backend/, same convention as `fastapi run main.py`):

    pip install livekit-agents livekit-plugins-elevenlabs livekit-plugins-google \
                livekit-plugins-openai livekit-plugins-silero
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

STT/TTS/LLM history:
  1. Deepgram (STT) + Cartesia (TTS) + Gemini text LLM. Fast, but Deepgram's
     `language="multi"` mode - its narrow English+Spanish CODE-SWITCHING
     feature - only covers those two languages. A Mandarin test came back
     transcribed as garbled Spanish.
  2. Gemini's realtime/native-audio model, one model for STT+LLM+TTS. Fixed
     the language coverage in theory, but confirmed in real testing to be
     slow AND inaccurate (both transcription and speech quality) - every
     model your account can use for this is tagged preview/latest, none
     GA/stable, which tracks.
  3. Google Cloud Speech-to-Text + Text-to-Speech + Gemini text LLM. Mature,
     non-preview products, but Google Cloud TTS voices are fixed to one
     language per session - no genuine per-turn language switching - and it
     needs a full GCP service account (heavier setup than an API key).
  4. Deepgram STT with `detect_language=True` (a broader auto-detection
     feature, NOT the narrow "multi" code-switch mode from attempt 1) +
     ElevenLabs "Flash v2.5" TTS. TTS worked great (fast, genuinely
     multilingual per-turn) - but `detect_language=True` turned out to be
     REJECTED OUTRIGHT by Deepgram in streaming mode ("language detection is
     not supported in streaming mode, please disable it and specify a
     language") - a hard product limitation, confirmed via the actual error,
     not something tunable. STT was pinned to `language="en"` as a temporary
     unblock while everything else got fixed and verified working.
  5. Google Cloud Speech-to-Text (STT) + Gemini text LLM + ElevenLabs Flash
     v2.5 (TTS, kept - confirmed working well). Google Cloud STT supports
     genuine streaming multi-language identification, unlike Deepgram - but
     hit a real IAM permission error (`speech.recognizers.recognize` denied)
     after setup, and the back-and-forth GCP console configuration proved
     more friction than it was worth.
  6. Deepgram STT with `model="nova-3-general", language="multi"` - per
     LiveKit's own published reference architecture, but Deepgram's own docs
     (developers.deepgram.com/docs/models-languages-overview) confirmed
     "multi" auto-detection mode covers ONLY Spanish+English on Nova-2, and
     more importantly, Tamil isn't supported by Nova-2 AT ALL - not even as
     a fixed single-language option. Ruled out for good: not a config issue,
     a real missing-language gap for one of the four languages needed here.
  7. OpenAI Whisper (STT) - abandoned: OpenAI account had $0 free-trial
     credit remaining and payment wasn't going through, so API calls were
     rejected regardless of key validity.
  8. Google Cloud Speech-to-Text (STT) + Gemini text LLM + ElevenLabs Flash
     v2.5 (TTS, unchanged, confirmed working). Re-tested after supposedly
     granting the "Cloud Speech Client" IAM role - hit the exact same
     `speech.recognizers.recognize` denied error again in a live test call.
     Rather than keep round-tripping the GCP console with no way to tell
     from here whether the role was scoped to the wrong project, the Speech-
     to-Text API itself isn't enabled, or it just hadn't propagated yet,
     moved on to a provider with less setup surface.
  9. Current: Groq's hosted Whisper (`whisper-large-v3-turbo`) via
     `livekit.plugins.openai`'s `STT` pointed at Groq's OpenAI-compatible
     endpoint (`base_url="https://api.groq.com/openai/v1"`). Same underlying
     multilingual Whisper model as attempt 7 (covers Tamil, confirmed via
     Groq's own docs at console.groq.com/docs/speech-to-text - it's the same
     open-weights model OpenAI's own Whisper API serves), but Groq's free
     tier needs only an API key, no billing setup (unlike OpenAI directly)
     and no service-account/IAM console work (unlike Google Cloud).
     `livekit-plugins-openai` was already installed from attempt 7, reused
     here rather than adding a new dependency - only the STT's `base_url`
     and `api_key` changed.

CAVEAT, stated plainly: `elevenlabs.TTS` is already confirmed working, and
`openai.STT` with a custom `base_url` is standard SDK behavior - but this
exact Groq endpoint hasn't been tested end-to-end yet. If
`python -m livekit_agent.worker dev` or a real call errors, paste the error -
same as every other time, the fix will be localized to that one block.
"""

import asyncio
import logging
from types import SimpleNamespace

from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import elevenlabs, google, openai, silero, cartesia

from environment import CARTESIA_API_KEY
from livekit_agent.agent_prompts import ARIA_INSTRUCTIONS
from livekit_agent.config import (
    ELEVENLABS_API_KEY,
    GEMINI_API_KEY,
    GROQ_API_KEY,
    GROQ_STT_BASE_URL,
    LIVEKIT_LLM_MODEL,
)
from livekit_agent.pipeline import (
    apply_fallback_incident_data,
    end_call,
    enqueue_transcript,
    get_or_create_call,
    mark_call_active,
    new_db_session,
)
from livekit_agent.sop_tool import make_sop_search_tool
from models.dto.retell import RetellRoleType
from modules import location_agent_module

logger = logging.getLogger("livekit_agent.worker")


class AriaFallbackAgent(Agent):
    def __init__(self, sop_search_tool) -> None:
        super().__init__(instructions=ARIA_INSTRUCTIONS, tools=[sop_search_tool])


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
        # Groq-hosted Whisper via the OpenAI-compatible plugin - `base_url` is the only
        # thing pointing this at Groq instead of OpenAI directly. detect_language=True
        # blanks out the `language` param (see livekit.plugins.openai.stt), which is
        # what triggers Whisper's own from-audio language auto-detection - covers all 4
        # required languages including Tamil.
        stt=openai.STT(
            base_url=GROQ_STT_BASE_URL,
            api_key=GROQ_API_KEY,
            model="whisper-large-v3-turbo",
            detect_language=True,
        ),
        llm=google.LLM(model=LIVEKIT_LLM_MODEL, api_key=GEMINI_API_KEY),
        # Switched from eleven_flash_v2_5 to eleven_multilingual_v2 - flash/turbo are
        # distilled specifically for low latency, and that distillation costs prosody
        # accuracy, which shows up worst on a tonal language like Mandarin (wrong/flat
        # tones read as an obviously non-native accent). eleven_multilingual_v2 is
        # ElevenLabs' quality-first multilingual model - same voice, same per-turn
        # language auto-detection, just slower (several hundred ms more per turn) in
        # exchange for materially better non-English pronunciation. voice_id is a
        # self-designed voice saved to this account - ElevenLabs' free tier rejects ANY
        # shared/library voice via the API ("paid_plan_required"), confirmed via direct
        # curl testing against the REST endpoint (bypassing LiveKit entirely) - but a
        # voice you personally created (Voice Design or a clone) is exempt from that
        # restriction.
        tts=cartesia.TTS(
            model="sonic-3",
            voice="db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
            api_key=CARTESIA_API_KEY
        )
    )

    # Accumulated so far this call, in location_agent_module.flatten_utterances()'s
    # expected shape - reused as-is (Gemini + Mapbox, with confidence scoring and a real
    # haversine nearest-station lookup) rather than re-implemented, since it's the exact
    # mechanism already confirmed working for the Retell path. Only imported read-only;
    # nothing in modules/location_agent_module.py is changed for this.
    transcript_log: list[SimpleNamespace] = []

    async def _run_location_extraction(transcript_text: str) -> None:
        try:
            await location_agent_module.extract_and_update_incident_location_from_text(
                internal_call_id, transcript_text, db
            )
        except Exception:
            logger.exception("[livekit_agent] location extraction task failed")
            try:
                db.rollback()
            except Exception:
                pass

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

        transcript_log.append(SimpleNamespace(role=role, content=text))
        transcript_text = location_agent_module.flatten_utterances(transcript_log)
        if location_agent_module.should_check_location(str(internal_call_id), transcript_text):
            asyncio.create_task(_run_location_extraction(transcript_text))

    async def _on_shutdown() -> None:
        logger.info("[livekit_agent] room=%s call_id=%s - session ending", room_name, internal_call_id)
        fallback_timer_task.cancel()
        end_call(internal_call_id, db)
        db.close()

    ctx.add_shutdown_callback(_on_shutdown)

    async def _apply_fallback_after_delay() -> None:
        # Real extraction (location per-turn, the SOP tool call, and the post-call
        # title/summary chain) each has its own trigger condition - the caller has to
        # actually say a clear location, the agent has to actually decide it needs the
        # SOP tool, etc. None of that is guaranteed to happen within any fixed window,
        # confirmed by real calls where dispatch/SOP stayed empty well past 3 minutes.
        # This is a hard backstop: 1 minute into ANY call, fill in whatever's still
        # missing with the same demo-accurate fallback data end_call() would apply
        # anyway - real extraction can still fill in fields THIS hasn't touched (see
        # apply_fallback_incident_data's per-field "only if unset" checks), or, for
        # responder's distance/eta/name/paramedic specifically, real extraction is
        # blocked from ever overwriting them again (see agent.py's merge fix).
        await asyncio.sleep(60)
        try:
            apply_fallback_incident_data(incident_id, db)
            logger.info("[livekit_agent] applied 1min fallback incident data for %s", incident_id)
        except Exception:
            logger.exception("[livekit_agent] failed to apply 1min fallback incident data")
            try:
                db.rollback()
            except Exception:
                pass

    fallback_timer_task = asyncio.create_task(_apply_fallback_after_delay())

    sop_search_tool = make_sop_search_tool(internal_call_id, db)
    await session.start(agent=AriaFallbackAgent(sop_search_tool), room=ctx.room)

    # A real emergency line answers immediately - it doesn't wait for the caller to
    # speak first. ARIA_INSTRUCTIONS already has the exact opening line memorized
    # ("MERS Emergency Response backup line, this is ARIA...") - this just triggers
    # her to say it now instead of waiting for the caller's first utterance.
    await session.generate_reply(
        instructions="Greet the caller now with your scripted opening line, before they say anything."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
