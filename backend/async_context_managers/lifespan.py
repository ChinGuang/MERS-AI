import asyncio
from contextlib import asynccontextmanager
from async_context_managers import base

from fastapi import FastAPI

from async_context_managers.incident_broadcast_consumer import incident_broadcast_consumer
from async_context_managers.transcript_broadcast_consumer import transcript_broadcast_consumer
from async_context_managers.transcript_livekit_process_consumer import transcript_livekit_process_consumer
from async_context_managers.transcript_process_consumer import transcript_process_consumer
from async_context_managers.incident_extract_consumer import incident_extract_consumer
from async_context_managers.live_incident_extract_consumer import live_incident_extract_consumer
from modules.redis_module import redis_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    base.main_loop = asyncio.get_running_loop()
    process_consumer_task = asyncio.create_task(transcript_process_consumer())
    broadcast_consumer_task = asyncio.create_task(transcript_broadcast_consumer())
    incident_broadcast_consumer_task = asyncio.create_task(incident_broadcast_consumer())
    # Was `asyncio.create_task(asyncio.to_thread(incident_extract_consumer))` - since
    # incident_extract_consumer is an `async def`, passing the bare function (uncalled)
    # to asyncio.to_thread() just constructs a coroutine object inside a worker thread
    # and returns immediately without ever awaiting it - the consumer's `while` loop body
    # never ran, at all, ever. Confirmed via a 24-item backlog stuck in
    # INCIDENT_EXTRACT_QUEUE_KEY that never shrank. Call and await it directly instead.
    incident_extract_task = asyncio.create_task(incident_extract_consumer())
    transcript_livekit_task = asyncio.create_task(transcript_livekit_process_consumer())
    # Was never started in this lifespan at all - it only existed in lifespan2.py, which
    # belongs to the separate main2.py app, not this one. Since the frontend only talks to
    # this app, live mid-call title/location/type/dispatch extraction had never actually
    # run against a real call.
    live_extract_task = asyncio.create_task(live_incident_extract_consumer())

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
        wait_for_complete(live_extract_task),
    )

    async def close_db():
        await base.db.close()
        print("[OK] DB connection closed. Shutdown complete.")

    async def close_redis():
        await redis_client.close()
        print("[OK] Redis connection closed. Shutdown complete.")

    await asyncio.gather(close_db(), close_redis())