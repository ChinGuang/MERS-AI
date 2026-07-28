import asyncio
import json
from uuid import UUID

from pydantic import BaseModel
from fastapi.responses import StreamingResponse

from datetime_utils import to_iso_utc
from main import app
from modules.broadcaster_module import call_transcript_broadcaster

class Payload(BaseModel):
    call_id: UUID

def serialize_transcript(transcript):
    if isinstance(transcript, dict):
        return transcript
    return {
        "id": str(transcript.id),
        "start_duration": transcript.start_duration,
        "end_duration": transcript.end_duration,
        "call_id": str(transcript.call_id),
        "transcript": transcript.transcript,
        "role": transcript.role,
        "language": transcript.language,
        "translated_text": transcript.translated_text,
        "created_at": to_iso_utc(getattr(transcript, "created_at", None)),
        "updated_at": to_iso_utc(getattr(transcript, "updated_at", None)),
    }


@app.get("/transcripts/stream")
async def read_transcripts() -> StreamingResponse:
    async def event_stream():
        # Create a private queue just for this specific connected client
        client_queue = call_transcript_broadcaster.subscribe()
        print(
            f"Client subscribed to transcript stream; listeners={len(call_transcript_broadcaster._listeners)}",
            flush=True,
        )
        try:
            while True:
                # Blocks until the background worker broadcasts a new call_id
                transcripts = await client_queue.get()
                payload = [serialize_transcript(transcript) for transcript in transcripts]
                print(f"streaming {json.dumps(payload, default=str)}", flush=True)
                yield f"data: {json.dumps(payload, default=str)}\n\n"
        except asyncio.CancelledError:
            # Triggered automatically when the frontend client disconnects
            print("Client disconnected from SSE", flush=True)
        finally:
            # Clean up so we don't leak memory
            call_transcript_broadcaster.unsubscribe(client_queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
