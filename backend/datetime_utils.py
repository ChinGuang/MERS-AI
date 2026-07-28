"""
Centralized UTC datetime helpers.

Every timestamp in this backend was being created via bare `datetime.now()`
(schema.py's column defaults, websocket.py, twilio_api.py, livekit_agent) -
naive SERVER-LOCAL time with no timezone marker. That silently broke the
moment it got serialized for the frontend with a "Z" (UTC) suffix in
incident_module.py's occurDateTime field: the frontend then re-applied the
browser's local timezone offset on top of a value that was already local
time, double-shifting it. Route every timestamp through these two functions
instead so "naive datetime" always actually means UTC, and every serialized
value is honest about that.
"""

from datetime import datetime, timezone


def now_utc() -> datetime:
    """Naive datetime that is genuinely UTC wall-clock time - safe to store
    in a plain (non-timezone-aware) DateTime column."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_iso_utc(dt: datetime | None) -> str | None:
    """Serializes a now_utc()-produced value for the frontend with an
    explicit UTC marker, so `new Date(...)` on the other end doesn't apply
    an extra, incorrect timezone shift."""
    if dt is None:
        return None
    return dt.isoformat() + "Z"
