import asyncio
from async_context_managers import base
from modules.broadcaster_module import call_transcript_broadcaster

job_queue = asyncio.Queue()

async def transcript_broadcast_consumer():
    while base.keep_running:
        # This blocks efficiently until a job arrives (0% CPU usage)
        transcript_payload = await job_queue.get()
        try:
            print(f"Background worker processing: {transcript_payload}")
            # Notify any active SSE clients that this call_id is ready
            await call_transcript_broadcaster.broadcast(transcript_payload)
        finally:
            job_queue.task_done()