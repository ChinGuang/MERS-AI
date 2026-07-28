import asyncio

class Broadcaster:
    def __init__(self):
        self._listeners = set()

    def subscribe(self):
        queue = asyncio.Queue()
        self._listeners.add(queue)
        return queue

    def unsubscribe(self, queue):
        self._listeners.discard(queue)

    async def broadcast(self, transcript_payload):
        # Send the update to every single connected client queue
        for queue in list(self._listeners):
            await queue.put(transcript_payload)

call_transcript_broadcaster = Broadcaster()
incident_update_broadcaster = Broadcaster()
dispatch_request_update_broadcaster = Broadcaster()