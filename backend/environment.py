import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(override=True)

DATABASE_URL = os.getenv("POSTGRES_CONNECTION_STRING")
NGROK_URL = os.getenv("NGROK_URL", "")
MY_PHONE_NUMBER=os.getenv("MY_PHONE_NUMBER")
RETELL_API_KEY=os.getenv("RETELL_API_KEY")
RETELL_AGENT_ID=os.getenv("RETELL_AGENT_ID")
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_EXPIRE_DURATION_IN_SECONDS= os.getenv("REDIS_EXPIRE_DURATION_IN_SECONDS", "300")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
ALLOW_ORIGINS = os.getenv("ALLOW_ORIGINS").split(",") if os.getenv("ALLOW_ORIGINS") is not None else None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
LLM_MODEL_USED=os.getenv("LLM_MODEL_USED")


PROJECT_DIR = Path(__file__).parent
DATA_DIR = PROJECT_DIR / "data"
RETRIEVAL_SIGNALS_PATH= DATA_DIR / "retrieval_signals.json"
SKILL_CARDS_PATH = DATA_DIR / "sop_skill_cards.jsonl"
FULL_SOPS_PATH = DATA_DIR / "full_sops"


# TTS Layer
TTS_PLUGIN_USED = os.getenv("TTS_PLUGIN_USED", '')

## Elevenlabs
ELEVENLABS_API_KEY= os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID=os.getenv("ELEVENLABS_VOICE_ID")
ELEVENLABS_MODEL=os.getenv("ELEVENLABS_MODEL")

## Cartesia
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY")
CARTESIA_VOICE_ID = os.getenv("CARTESIA_VOICE_ID")
CARTESIA_MODEL = os.getenv("CARTESIA_MODEL")