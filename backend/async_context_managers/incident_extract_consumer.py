import asyncio
import logging
import time

from constants.redis_key import INCIDENT_EXTRACT_QUEUE_KEY
from async_context_managers import base
from agents.transcript_incident_agent.agent import run_incident_extraction
from modules.redis_module import redis_client

logger = logging.getLogger(__name__)


async def incident_extract_consumer():
    while base.keep_running:
        try:
            # brpop is a blocking network call - direct (non-threaded) use inside an
            # `async def` freezes the whole single-threaded event loop for its duration,
            # starving every other consumer sharing it. Safe to thread (no DB access).
            #
            # run_incident_extraction is NOT wrapped in to_thread despite also blocking
            # (Gemini + geocoding calls inside it) - it does extensive base.db reads/
            # writes, and base.db is one Session shared by every consumer on the main
            # event-loop thread; running it in a worker thread would mean two different
            # OS threads touching the same non-thread-safe Session concurrently, which is
            # worse than the blocking it would avoid. It only runs once per call (at call
            # end), far less often than the per-second live extractor, so left as-is.
            result = await asyncio.to_thread(redis_client.client.brpop, INCIDENT_EXTRACT_QUEUE_KEY, timeout=1)
            if result is None:
                continue

            _, call_id_str = result
            call_id = call_id_str  # already a string from redis decode_responses=True

            logger.info("Processing incident extraction for call %s", call_id)
            run_incident_extraction(call_id, base.db)
        except Exception as e:
            logger.error("Incident extract consumer error: %s", e)
            # base.db is one Session shared by every background consumer - an error here
            # left uncommitted/unrolled-back poisons it for all of them (every subsequent
            # query on the same Session raises PendingRollbackError until someone rolls
            # back). Confirmed via a 23-item backlog stuck in this exact queue.
            try:
                base.db.rollback()
            except Exception as rollback_err:
                logger.error("Failed to roll back shared session: %s", rollback_err)
            await asyncio.sleep(0.5)