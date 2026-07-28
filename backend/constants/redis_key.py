def get_redis_emotional_analysis_key(call_id) -> str:
    return f'emotional_analysis:{call_id}'

PENDING_CALL_TRANSCRIPT_MAP_KEY = "pending_call_transcript_map"
PENDING_CALL_TRANSCRIPT_MAP_LIVE_AGENT_KEY = "pending_call_transcript_map_live_agent"
TRANSCRIPT_CONSUME_QUEUE_KEY = "transcript_consume_queue"
INCIDENT_EXTRACT_QUEUE_KEY = "incident_extract_queue"
ACTIVE_CALLS_SET_KEY: str = "active_calls"

def get_transcript_utterance_set_key(call_id):
    return f"transcript_utterance_set:{call_id}"