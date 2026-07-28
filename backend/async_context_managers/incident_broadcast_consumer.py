import asyncio
from async_context_managers import base
from modules.broadcaster_module import incident_update_broadcaster

job_queue = asyncio.Queue()

async def incident_broadcast_consumer():
    while base.keep_running:
        incident_payload = await job_queue.get()
        try:
            print(f"Background incident worker processing: {incident_payload}")
            # Notify any active SSE clients that this call_id is ready
            await incident_update_broadcaster.broadcast(incident_payload)
        finally:
            job_queue.task_done()