import asyncio
from contextlib import asynccontextmanager
from async_context_managers import base

from fastapi import FastAPI

from async_context_managers.incident_broadcast_consumer import incident_broadcast_consumer
from async_context_managers.transcript_broadcast_consumer import transcript_broadcast_consumer
from async_context_managers.transcript_livekit_process_consumer import transcript_livekit_process_consumer
from async_context_managers.transcript_process_consumer import transcript_process_consumer
from async_context_managers.incident_extract_consumer import incident_extract_consumer
from modules.redis_module import redis_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    base.main_loop = asyncio.get_running_loop()
    process_consumer_task = asyncio.create_task(transcript_process_consumer())
    broadcast_consumer_task = asyncio.create_task(transcript_broadcast_consumer())
    incident_broadcast_consumer_task = asyncio.create_task(incident_broadcast_consumer())
    incident_extract_task = asyncio.create_task(asyncio.to_thread(incident_extract_consumer))
    transcript_livekit_task = asyncio.create_task(transcript_livekit_process_consumer())

    yield
    base.keep_running = False
    async def wait_for_complete(task):
        try:
            await asyncio.wait_for(task, timeout=5.0)
        except asyncio.TimeoutError:
            task.cancel()

    await asyncio.gather(
        wait_for_complete(process_consumer_task),
        wait_for_complete(broadcast_consumer_task),
        wait_for_complete(incident_extract_task),
        wait_for_complete(incident_broadcast_consumer_task),
        wait_for_complete(transcript_livekit_task),
    )

    async def close_db():
        await base.db.close()
        print("[✓] DB connection closed. Shutdown complete.")

    async def close_redis():
        await redis_client.close()
        print("[✓] Redis connection closed. Shutdown complete.")

    await asyncio.gather(close_db(), close_redis())