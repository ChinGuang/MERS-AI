"""
Standalone environment loading for the LiveKit fallback voice channel.

Deliberately independent from backend/environment.py so this folder never
requires editing a file other parts of the project depend on. Reuses the
same .env file (python-dotenv looks upward for it) but only reads the keys
this module cares about.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(override=True)

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# Voice model: reuse the same Gemini key the rest of the project already uses (read-only
# env access, no import from backend/environment.py needed since it's a single os.getenv call).
# Realtime/Live models have different names than regular text Gemini models (e.g. the
# gemini-2.5-flash used elsewhere in this project is NOT a realtime-audio model) - verify
# this default against Gemini's current realtime/Live model list if worker.py errors on it.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Confirmed against your actual account via list_gemini_live_models.py - "gemini-2.0-flash-exp"
# (the first guess) doesn't support the Live API at all for direct Gemini API keys.
LIVEKIT_LLM_MODEL = os.getenv("LIVEKIT_LLM_MODEL", "gemini-2.5-flash-native-audio-latest")

# No longer used now that worker.py uses Gemini's realtime model for STT+TTS too - left
# here in case you switch back to a Deepgram/Cartesia pipeline for more control/latency
# tuning later.
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY")

PROJECT_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = PROJECT_DIR / "data"


def require(value: str | None, name: str) -> str:
    """Fail loudly and specifically at startup rather than with a cryptic SDK error later."""
    if not value:
        raise RuntimeError(
            f"{name} is not set. Add it to your .env file before running the LiveKit worker/api."
        )
    return value
