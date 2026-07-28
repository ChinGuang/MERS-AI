from sqlalchemy import event
from sqlalchemy.orm import Session

from async_context_managers import base
from async_context_managers.transcript_broadcast_consumer import job_queue as transcript_job_queue
from datetime_utils import to_iso_utc
from async_context_managers.incident_broadcast_consumer import job_queue as incident_job_queue
from models.schema import Call, CallTranscript, Incident
from modules import incident_module
from modules.transcripts import call_transcript_module


@event.listens_for(CallTranscript, "after_insert")
def receive_after_insert_call_transcript(mapper, connection, target):
    print(f"sent sse event with whole transcript with {target.call_id}")
    try:
        session = Session(bind=connection)
        try:
            utterances = call_transcript_module.read_transcripts(target.call_id, session)
            print("utterances information getting")
            serialized_utterances = [
                {
                    "id": str(u.id),
                    "start_duration": u.start_duration,
                    "end_duration": u.end_duration,
                    "call_id": str(u.call_id),
                    "transcript": u.transcript,
                    "role": u.role,
                    "language": u.language,
                    "translated_text": u.translated_text,
                    "created_at": to_iso_utc(getattr(u, "created_at", None)),
                    "updated_at": to_iso_utc(getattr(u, "updated_at", None)),
                }
                for u in utterances
            ]
            loop = base.main_loop
            if loop is not None and loop.is_running():
                loop.call_soon_threadsafe(transcript_job_queue.put_nowait, serialized_utterances)
                print("queued transcript broadcast")
            else:
                print("no running event loop available for transcript broadcast")

            call = session.get(Call, target.call_id)
            if call and call.incident_id:
                incident = incident_module.read_incident(call.incident_id, session)
                if incident is not None and loop is not None and loop.is_running():
                    loop.call_soon_threadsafe(incident_job_queue.put_nowait, incident)
        finally:
            session.close()
    except Exception as e:
        print(f"receive_after_insert_call_transcript error: {e}")


@event.listens_for(CallTranscript, "after_update")
def receive_after_update_call_transcript(mapper, connection, target):
    print(f"sent sse event with updated transcript for {target.call_id}")
    try:
        session = Session(bind=connection)
        try:
            utterances = call_transcript_module.read_transcripts(target.call_id, session)
            serialized_utterances = [
                {
                    "id": str(u.id),
                    "start_duration": u.start_duration,
                    "end_duration": u.end_duration,
                    "call_id": str(u.call_id),
                    "transcript": u.transcript,
                    "role": u.role,
                    "language": u.language,
                    "translated_text": u.translated_text,
                    "created_at": to_iso_utc(getattr(u, "created_at", None)),
                    "updated_at": to_iso_utc(getattr(u, "updated_at", None)),
                }
                for u in utterances
            ]
            loop = base.main_loop
            if loop is not None and loop.is_running():
                loop.call_soon_threadsafe(transcript_job_queue.put_nowait, serialized_utterances)

            call = session.get(Call, target.call_id)
            if call and call.incident_id:
                incident = incident_module.read_incident(call.incident_id, session)
                if incident is not None and loop is not None and loop.is_running():
                    loop.call_soon_threadsafe(incident_job_queue.put_nowait, incident)
        finally:
            session.close()
    except Exception as e:
        print(f"receive_after_update_call_transcript error: {e}")


@event.listens_for(Call, "after_insert")
def receive_after_insert_call(mapper, connection, target):
    print(f"sent sse event for call creation on incident {target.incident_id}")
    try:
        session = Session(bind=connection)
        try:
            incident = incident_module.read_incident(target.incident_id, session)
            loop = base.main_loop
            if incident is not None and loop is not None and loop.is_running():
                loop.call_soon_threadsafe(incident_job_queue.put_nowait, incident)
        finally:
            session.close()
    except Exception as e:
        print(f"receive_after_insert_call error: {e}")


@event.listens_for(Call, "after_update")
def receive_after_update_call(mapper, connection, target):
    print(f"sent sse event for call update on incident {target.incident_id}")
    try:
        session = Session(bind=connection)
        try:
            incident = incident_module.read_incident(target.incident_id, session)
            loop = base.main_loop
            if incident is not None and loop is not None and loop.is_running():
                loop.call_soon_threadsafe(incident_job_queue.put_nowait, incident)
        finally:
            session.close()
    except Exception as e:
        print(f"receive_after_update_call error: {e}")


@event.listens_for(Incident, "after_insert")
def receive_after_insert_incident(mapper, connection, target):
    print(f"sent sse event with whole incident with {target.id}")
    try:
        session = Session(bind=connection)
        try:
            incident = incident_module.read_incident(target.id, session)
            loop = base.main_loop
            if incident is not None and loop is not None and loop.is_running():
                loop.call_soon_threadsafe(incident_job_queue.put_nowait, incident)
        finally:
            session.close()
    except Exception as e:
        print(f"receive_after_insert_incident error: {e}")


@event.listens_for(Incident, "after_update")
def receive_after_update_incident(mapper, connection, target):
    print(f"sent sse event with update whole incident with {target.id}")
    try:
        session = Session(bind=connection)
        try:
            incident = incident_module.read_incident(target.id, session)
            loop = base.main_loop
            if incident is not None and loop is not None and loop.is_running():
                loop.call_soon_threadsafe(incident_job_queue.put_nowait, incident)
        finally:
            session.close()
    except Exception as e:
        print(f"receive_after_update_incident error: {e}")