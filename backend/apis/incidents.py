import asyncio
import json

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from database import db_dependency
from models.database.incident import QueryIncidentPayload
from modules import incident_module
from modules.broadcaster_module import incident_update_broadcaster

router = APIRouter(prefix="/incidents", tags=["incidents"])

@router.get('')
async def read_incidents(db: db_dependency, page: int = Query(1, ge=1, description="Page number"),
                         size: int = Query(10, ge=1, le=100, description="Page size"), pattern: str | None = Query(None, description="Search pattern")):
    return incident_module.read_incidents(QueryIncidentPayload(page=int(page), pattern=pattern, size=int(size)), db)

@router.get("/stream")
async def read_incident_updates() -> StreamingResponse:
    async def event_stream():
        client_queue = incident_update_broadcaster.subscribe()
        print(
            f"Client subscribed to incident stream; listeners={len(incident_update_broadcaster._listeners)}",
            flush=True,
        )
        try:
            while True:
                payload = await client_queue.get()
                yield f"data: {json.dumps(payload, default=str)}\n\n"
        except asyncio.CancelledError:
            print("Client disconnected from incident SSE", flush=True)
        finally:
            incident_update_broadcaster.unsubscribe(client_queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")