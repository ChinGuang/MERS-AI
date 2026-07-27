"""
Standalone FastAPI app for the LiveKit fallback voice channel.

Deliberately its OWN `FastAPI()` instance, run on its own port, rather than a
router mounted into backend/main.py - so testing this phase requires zero
edits to the existing app (no new import line in main.py, no shared CORS
config to touch). Once this is proven out, mounting it under the main app is
a one-line, explicit follow-up - not done silently here.

Run (from inside backend/):

    pip install fastapi uvicorn
    uvicorn livekit_agent.api:app --port 8010 --reload
"""

import uuid
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from livekit_agent.room_service import build_caller_token, ensure_room_exists

logger = logging.getLogger("livekit_agent.api")

app = FastAPI(title="MERS-AI LiveKit Fallback API")

# Permissive during local testing of this isolated phase; tighten (or drop
# entirely in favor of main.py's own CORS config) once this is merged into
# the main app.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartFallbackCallResponse(BaseModel):
    room_name: str
    livekit_url: str | None
    token: str


@app.post("/livekit/session", response_model=StartFallbackCallResponse)
async def start_fallback_call() -> StartFallbackCallResponse:
    """
    Mints a fresh room + caller token for a manually-triggered fallback call.
    The LiveKit worker (worker.py) is dispatched into the room automatically
    once the caller's client joins with this token.
    """
    from livekit_agent.config import LIVEKIT_URL  # local import: keep config errors scoped to the call

    room_name = f"fallback-{uuid.uuid4().hex[:12]}"
    caller_identity = f"caller-{uuid.uuid4().hex[:8]}"

    await ensure_room_exists(room_name)
    token = build_caller_token(room_name, caller_identity)

    logger.info("[livekit_agent.api] issued fallback room=%s", room_name)
    return StartFallbackCallResponse(room_name=room_name, livekit_url=LIVEKIT_URL, token=token)


@app.get("/livekit/health")
async def health() -> dict:
    return {"status": "ok"}
