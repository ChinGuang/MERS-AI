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

# LLM: reuse the same Gemini key the rest of the project already uses for its regular
# text models (read-only env access, no import from backend/environment.py needed).
# Back to a plain fast text model - the native-audio/realtime model this briefly used
# was confirmed slow and inaccurate in real testing (every variant available is a
# preview/experimental tag, none GA). "gemini-2.5-flash" is the same model already
# proven out elsewhere in this project (location_agent_module.py, incident extraction).
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LIVEKIT_LLM_MODEL = os.getenv("LIVEKIT_LLM_MODEL", "gemini-2.5-flash")

# STT: Groq-hosted Whisper (`whisper-large-v3-turbo`) via `openai.STT` in worker.py,
# pointed at Groq's OpenAI-compatible endpoint instead of OpenAI's. Same multilingual
# Whisper model that covers Tamil (unlike Deepgram), but needs only a free Groq API
# key - no billing (unlike OpenAI directly) and no GCP service account/IAM console
# work (unlike Google Cloud STT, which hit a persistent IAM permission error even
# after supposedly granting the right role - see worker.py's docstring).
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_STT_BASE_URL = "https://api.groq.com/openai/v1"

# TTS: ElevenLabs Flash v2.5 - single multilingual voice, auto-detects the input text's
# language per call, built for low latency. Plain API key, not GCP-style service
# account credentials.
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# No longer used - left in case you revert to a Deepgram/Google/OpenAI-direct STT or
# Cartesia TTS pipeline later.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
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
