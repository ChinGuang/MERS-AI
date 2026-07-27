"""
Thin LiveKit server-SDK wrapper: create a room, mint a caller access token.

Mirrors the simplicity of backend/modules/retell_module.py (one function to
register/kick off a call) but lives here as a new file rather than editing
that module - retell_module.py stays untouched.
"""

from livekit import api

from livekit_agent.config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL, require


def build_caller_token(room_name: str, caller_identity: str) -> str:
    """
    Mint a short-lived access token a caller's browser/app uses to join the
    fallback room. The LiveKit agent worker (worker.py) is dispatched to the
    same room automatically once a participant joins it.
    """
    require(LIVEKIT_API_KEY, "LIVEKIT_API_KEY")
    require(LIVEKIT_API_SECRET, "LIVEKIT_API_SECRET")

    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(caller_identity)
        .with_name(caller_identity)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
    )
    return token.to_jwt()


async def ensure_room_exists(room_name: str) -> None:
    """
    Explicitly creates the room ahead of time so it exists even before the
    caller's client connects (LiveKit will also auto-create it on first join,
    but doing this explicitly lets us fail fast if credentials are wrong).
    """
    require(LIVEKIT_URL, "LIVEKIT_URL")
    require(LIVEKIT_API_KEY, "LIVEKIT_API_KEY")
    require(LIVEKIT_API_SECRET, "LIVEKIT_API_SECRET")

    lk_api = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    try:
        await lk_api.room.create_room(api.CreateRoomRequest(name=room_name))
    finally:
        await lk_api.aclose()
