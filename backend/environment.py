import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(override=True)

DATABASE_URL = os.getenv("POSTGRES_CONNECTION_STRING")
NGROK_URL = os.getenv("NGROK_URL", "")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN=os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER=os.getenv("TWILIO_PHONE_NUMBER")
MY_PHONE_NUMBER=os.getenv("MY_PHONE_NUMBER")
RETELL_API_KEY=os.getenv("RETELL_API_KEY")
RETELL_AGENT_ID=os.getenv("RETELL_AGENT_ID")
VOICE_BUCKET_NAME=os.getenv("VOICE_BUCKET_NAME")
SUPABASE_URL=os.getenv("SUPABASE_URL")
SUPABASE_KEY=os.getenv("SUPABASE_KEY")
RABBIT_HOST=os.getenv("RABBIT_HOST")
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_EXPIRE_DURATION_IN_SECONDS= os.getenv("REDIS_EXPIRE_DURATION_IN_SECONDS", "300")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
ALLOW_ORIGINS = os.getenv("ALLOW_ORIGINS").split(",") if os.getenv("ALLOW_ORIGINS") is not None else None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

PROJECT_DIR = Path(__file__).parent
DATA_DIR = PROJECT_DIR / "data"
RETRIEVAL_SIGNALS_PATH= DATA_DIR / "retrieval_signals.json"
SKILL_CARDS_PATH = DATA_DIR / "sop_skill_cards.jsonl"
FULL_SOPS_PATH = DATA_DIR / "full_sops"
GOOGLE_MAPS_API_KEY=os.getenv("GOOGLE_MAPS_API_KEY")