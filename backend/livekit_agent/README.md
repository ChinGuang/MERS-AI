# LiveKit fallback voice channel

A self-contained fallback path for when Twilio/Retell calls fail. Everything in this
folder is new. A small, deliberate exception has since been added outside it: a
dedicated `transcript_livekit_process_consumer.py` (in `async_context_managers/`,
registered in `lifespan.py`), plus a `LiveKitUtterance` DTO and one new Redis key
(`PENDING_CALL_TRANSCRIPT_MAP_LIVE_AGENT_KEY`) — a LiveKit-specific transcript queue/
consumer, kept separate from the Retell path's so neither can break the other.
Everything else this code needs from the rest of the backend (the DB, the SOP
retriever) is still **imported read-only**.

## Why it's isolated like this

- **`config.py`** loads its own env vars instead of importing `backend/environment.py`.
- **`api.py`** is its own `FastAPI()` app on its own port, not a router mounted into `main.py`.
- **`worker.py`** is a separate OS process, not a background task inside the main app's event loop.
- **`agent_prompts.py`** is a deliberate copy of ARIA's system prompt (the original lives inline in
  `backend/agents/voice_agent.py`) rather than a refactor to share it.

This means you can build, run, and fully test this fallback channel without touching anything a
teammate might currently be working on. See the project plan
(`.claude/plans/tranquil-shimmying-kay.md` if still present) for the two follow-up phases that *do*
require small, explicit edits elsewhere (fixing the dead location agent, grounding SOP citations).

## How it plugs into the existing pipeline

```
caller joins LiveKit room
        │
        ▼
worker.py (this folder) ── pipeline.get_or_create_call() ──► same Call/Incident tables
        │                                                     (via modules/call_module.py,
        │                                                      modules/incident_module.py - imported,
        │                                                      not edited)
        ▼
pipeline.enqueue_transcript() ──► PENDING_CALL_TRANSCRIPT_MAP_LIVE_AGENT_KEY (a
        │                          LiveKit-specific Redis list, separate from the
        │                          Retell path's queue)
        ▼
transcript_livekit_process_consumer.py (async_context_managers/, registered in
lifespan.py) picks it up, runs translation, persists CallTranscript rows
        ▼
pipeline.end_call() on hangup ──► same INCIDENT_EXTRACT_QUEUE_KEY
        ▼
incident_extract_consumer.py (existing, UNCHANGED) runs the same LLM extraction,
titles + summarizes the incident, commits it — visible on the dashboard via the
existing SSE stream, same as a Twilio call.
```

Because the background consumers that read these Redis keys already exist and are provider-agnostic,
**none of them needed to change** for this to work.

## Setup

See `.env.example` in this folder for the exact keys to add to your real `backend/.env`
(not read automatically — it's a reference list, not a second env file).

1. A LiveKit account — `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
2. Reuses the existing `GEMINI_API_KEY` for the LLM (a plain text model, `gemini-2.5-flash` —
   not a realtime/native-audio model; that path was tried and reverted, see worker.py's docstring).
3. `GROQ_API_KEY` for STT — sign up free at console.groq.com (no billing/credit card
   needed). Serves the same multilingual Whisper model (`whisper-large-v3-turbo`) that
   covers Tamil, via an OpenAI-compatible endpoint (`livekit.plugins.openai.STT` pointed
   at `base_url="https://api.groq.com/openai/v1"`). Deepgram was ruled out for good:
   confirmed via Deepgram's own docs that Tamil isn't supported by Nova-2/Nova-3 at all.
   OpenAI Whisper directly was blocked by account billing. Google Cloud STT hit a
   persistent IAM permission error even after granting the documented role — see
   worker.py's docstring for the full history.
4. `ELEVENLABS_API_KEY` for TTS — confirmed working. One catch: ElevenLabs' free tier rejects
   *any* shared/library voice via the API ("paid_plan_required") — use a voice you personally
   designed (Voice Design) or cloned, saved under "My Voices," not one from the shared library.
5. Install the incremental packages (everything else — FastAPI, uvicorn, dotenv, redis — is already
   satisfied by `backend/requirements.txt`, which you already have installed to run the main app):
   ```
   pip install -r livekit_agent/requirements.txt
   ```

## Running it (from inside `backend/`)

```
# Terminal 1 - the LiveKit agent worker (joins rooms, talks to callers)
python -m livekit_agent.worker dev

# Terminal 2 - the mini API that mints rooms/tokens for a fallback call
uvicorn livekit_agent.api:app --port 8010 --reload
```

Then `POST http://localhost:8010/livekit/session` to get back `{ room_name, livekit_url, token }` —
use those with any LiveKit client SDK (web, mobile) to join as the caller. The worker joins
automatically once a participant connects.

**Easier for a first test:** `worker.py` registers with LiveKit's default/automatic dispatch (no
explicit `agent_name`), so it will also join any room created through LiveKit's own hosted test
client (look for "Agents Playground" / a sandbox option linked from your Cloud project dashboard —
the exact name/URL has moved around across LiveKit's docs, so check there rather than trusting a
hardcoded link here). That gets you talking to ARIA over your own mic with zero custom frontend
code, in parallel with `api.py`, which stays useful once you want your own dashboard to trigger it.

## Verifying it worked

- Watch `python -m livekit_agent.worker dev` logs for `session starting` / `session ending`.
- Check Postgres: a new `calls` row with `provider_sid` = the room name, then `call_transcripts` rows
  appearing as the conversation happens, then the linked `incidents` row getting a real `title` and
  `ai_summary` shortly after the call ends.
- Watch the main app's existing `GET /incidents/stream` SSE — the incident should appear there live,
  indistinguishable from a Twilio-originated one.

## Location & dispatch center: pinned, not live-extracted

Every LiveKit-originated incident gets a fixed, real location ("Sunway Pyramid, Bandar
Sunway, Selangor") and its real nearest `EmergencyDispatchServiceLocation` (haversine
over the seeded rows — run `python seed_dispatch_locations.py` once if that table is
still empty) set immediately in `pipeline.get_or_create_call()`, instead of waiting on
live LLM extraction + geocoding. Two small guards elsewhere in the backend (outside this
folder) keep it from being overwritten later: `live_incident_extract_consumer.py` and
`agents/transcript_incident_agent/agent.py` both now skip re-setting
`location`/`coordinates` once an incident already has them. This was a deliberate
reliability tradeoff for demoing: the alternative (live Mapbox/Google geocoding off
whatever the caller happens to say) is one more thing that can fail on stage. The
automated "Dispatch Request Agent" path (`agents/dispatch_agent.py`, `DispatchRequest`
table) is separately pre-empted per incident via `INCIDENT_DISPATCH_SET_KEY` — it isn't
wired into the frontend yet and has its own existing bugs (a non-existent Gemini model
name, a station-table mismatch), so it's skipped rather than fixed here.

## Not done yet (intentionally — needs your go-ahead first)

- **`api.py` is not mounted into `main.py`** — it's its own process/port. Merging it in later is one
  import line, held until you want that. The dashboard's Operations tab now has a "Start Fallback
  Voice Line" button (`frontend/.../operations/livekit-fallback-call.tsx`) that talks to it directly.
- **No `Call.provider` column** to record "this call came via LiveKit" — not yet added.
