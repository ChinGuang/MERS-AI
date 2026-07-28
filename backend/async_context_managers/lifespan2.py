import asyncio
from contextlib import asynccontextmanager
from async_context_managers import base

from fastapi import FastAPI

from async_context_managers.live_incident_extract_consumer import live_incident_extract_consumer
from modules.redis_module import redis_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    base.main_loop = asyncio.get_running_loop()
    live_extract_task = asyncio.create_task(live_incident_extract_consumer())

    yield
    base.keep_running = False
    async def wait_for_complete(task):
        try:
            await asyncio.wait_for(task, timeout=5.0)
        except asyncio.TimeoutError:
            task.cancel()

    await asyncio.gather(
        wait_for_complete(live_extract_task),
    )

    async def close_db():
        await base.db.close()
        print("[✓] DB connection closed. Shutdown complete.")

    async def close_redis():
        await redis_client.close()
        print("[✓] Redis connection closed. Shutdown complete.")

    await asyncio.gather(close_db(), close_redis())