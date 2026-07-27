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

# LLM: reuse the same Gemini key the rest of the project already uses (read-only env access,
# no import from backend/environment.py needed since it's a single os.getenv call).
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LIVEKIT_LLM_MODEL = os.getenv("LIVEKIT_LLM_MODEL", "gemini-2.5-flash")

# STT/TTS provider keys - only required once you pick providers in worker.py.
# Left as plain env reads so swapping providers never means changing this file's shape.
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
