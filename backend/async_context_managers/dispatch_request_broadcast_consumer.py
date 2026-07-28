import asyncio

from async_context_managers import base
from modules.broadcaster_module import dispatch_request_update_broadcaster

job_queue = asyncio.Queue()

async def dispatch_request_broadcast_consumer():
    while base.keep_running:
        dispatch_request_payload = await job_queue.get()
        try:
            print(f"Background dispatch_request worker processing: {dispatch_request_payload}")
            # Notify any active SSE clients that this call_id is ready
            await dispatch_request_update_broadcaster.broadcast(dispatch_request_payload)
        finally:
            job_queue.task_done()