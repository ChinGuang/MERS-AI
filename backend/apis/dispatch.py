import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from agents.dispatch_agent import DispatchInputPayload
from database import db_dependency
from modules.broadcaster_module import dispatch_request_update_broadcaster

router = APIRouter(prefix="/dispatch", tags=["dispatch"])

@router.post('')
async def get_dispatch(db: db_dependency, input_payload: DispatchInputPayload):
    return get_dispatch(db, input_payload)

@router.get("/stream")
async def read_dispatch_create() -> StreamingResponse:
    async def event_stream():
        client_queue = dispatch_request_update_broadcaster.subscribe()
        print(
            f"Client subscribed to dispatch request stream; listeners={len(dispatch_request_update_broadcaster._listeners)}",
            flush=True,
        )
        try:
            while True:
                payload = await client_queue.get()
                yield f"data: {json.dumps(payload, default=str)}\n\n"
        except asyncio.CancelledError:
            print("Client disconnected from incident SSE", flush=True)
        finally:
            dispatch_request_update_broadcaster.unsubscribe(client_queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")