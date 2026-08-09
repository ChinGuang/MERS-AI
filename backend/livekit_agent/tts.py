from functools import lru_cache

from livekit.agents.tts import tts
from livekit.plugins import cartesia, elevenlabs

from environment import CARTESIA_API_KEY, TTS_PLUGIN_USED, ELEVENLABS_API_KEY

@lru_cache()
def get_tts() -> tts.TTS:
    tts_used: tts.TTS | None = None
    match TTS_PLUGIN_USED.upper():
        case "ELEVENLABS":
            if ELEVENLABS_API_KEY:
                tts_used = elevenlabs.TTS(
                    model="eleven_multilingual_v2",
                    voice_id="k0ZTnyOK89zNStW2yGnv",
                    api_key=ELEVENLABS_API_KEY,
                )
            else:
                print("ELEVENLABS_API_KEY is not set, please set it in environment variable")
        case "CARTESIA", _:
            if TTS_PLUGIN_USED.upper() != "CARTESIA":
                print("TTS_PLUGIN_USED is not set, using default TTS")
            if CARTESIA_API_KEY:
                tts_used = cartesia.TTS(
                    model="sonic-3",
                    voice="db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
                    api_key=CARTESIA_API_KEY
                )
            else:
                print("CARTESIA_API_KEY is not set, please set it in environment variable")
    if tts_used is None:
        print("TTS is not set, please set it in environment variable")
        raise ValueError("TTS is not set, please set it in environment variable")
    return tts_used