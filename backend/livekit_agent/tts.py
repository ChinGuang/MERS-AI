from functools import lru_cache

from livekit.agents.tts import tts
from livekit.plugins import cartesia, elevenlabs

from environment import CARTESIA_API_KEY, TTS_PLUGIN_USED, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL, \
    CARTESIA_MODEL, CARTESIA_VOICE_ID


@lru_cache()
def get_tts() -> tts.TTS:
    tts_used: tts.TTS | None = None
    match TTS_PLUGIN_USED.upper():
        case "ELEVENLABS":
            if ELEVENLABS_API_KEY and ELEVENLABS_MODEL and ELEVENLABS_VOICE_ID:
                tts_used = elevenlabs.TTS(
                    model=ELEVENLABS_MODEL,
                    voice_id=ELEVENLABS_VOICE_ID,
                    api_key=ELEVENLABS_API_KEY,
                )
            else:
                print("ELEVENLABS_API_KEY, ELEVENLABS_MODEL, or ELEVENLABS_VOICE_ID is not set, please set it in environment variable")
        case "CARTESIA", _:
            if TTS_PLUGIN_USED.upper() != "CARTESIA":
                print("TTS_PLUGIN_USED is not set, using default TTS")
            if CARTESIA_API_KEY and CARTESIA_VOICE_ID and CARTESIA_MODEL:
                tts_used = cartesia.TTS(
                    model=CARTESIA_MODEL,
                    voice=CARTESIA_VOICE_ID,
                    api_key=CARTESIA_API_KEY
                )
            else:
                print("CARTESIA_API_KEY, CARTESIA_MODEL, or CARTESIA_VOICE_ID is not set, please set it in environment variable")
    if tts_used is None:
        print("TTS is not set, please set it in environment variable")
        raise ValueError("TTS is not set, please set it in environment variable")
    return tts_used