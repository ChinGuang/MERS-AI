import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { IncidentContext } from './useIncident';
import { Incident, SeverityType } from '@/types';
import { IncidentApi } from '@/apis/incidents';
import { IncidentDto, IncidentDtoSchema, TranscriptItem } from '@/dtos/incidents';
import { INITIAL_INCIDENTS } from '@/data/initialIncidents';
import { useSSE } from '@/hooks/useSSE';
import { CallTranscriptAPI } from '@/apis/call-transcripts';

interface Utterance {
    id: string;
    start_duration: number;
    end_duration: number;
    call_id: string;
    transcript: string;
    role: string;
    created_at: string | null;
    updated_at: string | null;
    language?: string | null;
    translated_text?: string | null;
}

function transcriptItemToUtterance(t: Pick<TranscriptItem, "created_at" | "transcript" | "role" | "language" | "translated_text">): Incident["transcript"][number] {
    // Uses the row's real created_at timestamp directly - NOT a value decoded from the
    // call's UUIDv7, which turned out to embed a bogus timestamp (a bug in the uuid_v7
    // package's encoding, unrelated to timezone handling) and made transcript times
    // display nonsense regardless of any timezone fix.
    const datetime = t.created_at instanceof Date ? t.created_at : new Date(t.created_at);
    return {
        time: datetime.toTimeString(),
        speaker: t.role,
        text: t.transcript,
        highlight: undefined,
        language: t.language ?? undefined,
        translatedText: t.translated_text ?? undefined,
    }
}

export function IncidentProvider({ children }: { children: ReactNode }) {
    const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
    const [selectedIncidentId, setSelectedIncidentId] = useState<string>('INC-0042');
    const [enabled, setEnabled] = useState<boolean>(false);

    const activeIncident = useMemo(
        () => incidents.find(inc => inc.id === selectedIncidentId) || incidents[0],
        [selectedIncidentId, incidents]
    );

    const { data: callTranscriptData } = useSSE<Utterance[]>(enabled, CallTranscriptAPI.connectTranscriptEventSource)
    useEffect(() => {
        if (callTranscriptData != null && Array.isArray(callTranscriptData) && callTranscriptData.length > 0) {
            const parsedData = callTranscriptData.map<TranscriptItem>((v) => {
                return {
                    ...v,
                    created_at: v.created_at ? new Date(v.created_at) : new Date(),
                    updated_at: v.updated_at ? new Date(v.updated_at) : new Date(),
                }
            })
            const callId = parsedData[0].call_id;
            setIncidents((prev) => {
                // Only merge into an incident that's genuinely this call's (matched by
                // callId). This used to also fall back to "the first incident in the
                // list" whenever nothing matched yet (e.g. this transcript update
                // arriving slightly before the new incident's own creation broadcast) -
                // but position 0 is one of the 3 seed/demo incidents by default, so any
                // such race misattached a real caller's live transcript onto a mock
                // incident's card. If nothing matches yet, drop the update: the
                // incident-creation/update stream below already carries its own
                // transcript embedded, so this is redundant once that arrives.
                if (!prev.some((v) => v.callId === callId)) {
                    return prev
                }
                return prev.map<Incident>((oldV) => {
                    if (oldV.callId === callId) {
                        return {
                            ...oldV,
                            transcript: parsedData.map(transcriptItemToUtterance),
                        }
                    }
                    return oldV
                })
            })
        }
    }, [callTranscriptData])

    const { data: incidentData } = useSSE<IncidentDto>(enabled, IncidentApi.connectIncidentEvenSource)
    useEffect(() => {
        if (!enabled) return;
        if (!!incidentData) {
            console.log("new incident data:", incidentData)
            const parsedData = IncidentDtoSchema.parse(incidentData)
            setIncidents((prev) => {
                const newIncident = {
                    ...parsedData,
                    transcript: parsedData.transcript.map(transcriptItemToUtterance),
                    title: parsedData.title ?? "",
                    location: parsedData.location ?? "",
                    type: parsedData.type ?? undefined,
                    priority: parsedData.priority ?? 0,
                    severity: (parsedData.severity?.toLowerCase() as Incident["severity"]) ?? SeverityType.MODERATE,
                    lang: parsedData.lang ?? '',
                    occurDateTime: parsedData.occurDateTime ?? new Date().toLocaleString(),
                    sopCitation: parsedData.sopCitation ?? '',
                    reason: parsedData.reason ?? '',
                    panicLevel: parsedData.panicLevel ?? "",
                    distressScore: parsedData.distressScore ?? 0,
                    caller: parsedData.caller ?? "",
                    callStartedAt: parsedData.callStartedAt ?? undefined,
                    contradiction: parsedData.contradiction ?? undefined,
                    dispatchCenter: parsedData.dispatchCenter ? {
                        ...parsedData.dispatchCenter,
                        name: parsedData.dispatchCenter.name ?? undefined,
                    } : undefined,
                    responder: {
                        name: parsedData.responder?.name ?? '',
                        distance: parsedData.responder?.distance ?? '',
                        eta: parsedData.responder?.eta ?? '',
                        status: parsedData.responder?.status ?? '',
                        type: parsedData.responder?.type ?? '',
                        paramedic: parsedData.responder?.paramedic
                    },
                }
                if (prev.some((v) => v.id == parsedData.id)) {
                    return prev.map<Incident>((inc) => {
                        if (inc.id == parsedData.id)
                            return newIncident
                        return inc;
                    }
                    )
                } else {
                    return [newIncident, ...prev]
                }
            }
            );
        }
    }, [incidentData])

    function fetchIncidents() {
        IncidentApi.readIncidents({ page: 1, size: 5 })
            .then((result: IncidentDto[]) => {
                if (result.length === 0) return;
                // Keep the 3 seed/demo cases visible at the base of the list rather than
                // replacing them outright - real incidents (backend returns newest-first)
                // sit above them, and a brand new one created via SSE (see the
                // [newIncident, ...prev] branch above) lands above everything, including
                // these, since it prepends onto whatever `prev` already holds.
                setIncidents([...INITIAL_INCIDENTS, ...result.map<Incident>((r) => ({
                    ...r,
                    responder: {
                        name: r.responder?.name ?? '',
                        distance: r.responder?.distance ?? '',
                        eta: r.responder?.eta ?? '',
                        status: r.responder?.status ?? '',
                        type: r.responder?.type ?? '',
                        paramedic: r.responder?.paramedic
                    },
                    sopCitation: r.sopCitation ?? '',
                    reason: r.reason ?? '',
                    panicLevel: r.panicLevel ?? "",
                    distressScore: r.distressScore ?? 0,
                    caller: r.caller ?? "",
                    occurDateTime: r.occurDateTime ?? new Date().toLocaleString(),
                    callStartedAt: r.callStartedAt ?? undefined,
                    lang: r.lang ?? "",
                    priority: r.priority ?? 0,
                    location: r.location ?? '',
                    transcript: r.transcript.map(transcriptItemToUtterance),
                    dispatchCenter: r.dispatchCenter ? {
                        ...r.dispatchCenter,
                        name: r.dispatchCenter.name ?? undefined
                    } : undefined,
                    type: r.type ?? undefined,
                    severity: (r.severity?.toLowerCase() as Exclude<SeverityType, SeverityType.ALL> ?? SeverityType.MODERATE),
                    contradiction: r.contradiction ?? undefined,
                }))]);
            })
            .catch((e) => {
                console.error(e)
            });
    }


    return (
        <IncidentContext value={{
            incidents,
            activeIncident,
            selectedIncidentId,
            setIncidents,
            setSelectedIncidentId,
            fetchIncidents,
            setSSEEnabled: setEnabled
        }}>
            {children}
        </IncidentContext>
    );
}
