import { supabase } from "@/lib/supabaseClient";
import { ArchivedReport, OutcomeType, SeverityType, IncidentType } from "@/models/report";

function mapRowToReport(r: any): ArchivedReport {
  return {
    id: r.id,
    title: r.title,
    outcome: r.outcome as OutcomeType,
    createAt: new Date(r.call_received_at || r.created_at),
    location: r.location,
    incidentType: r.incident_type as IncidentType,
    severity: r.severity as SeverityType,
    caller: r.caller,
    callerNumber: r.caller_number ?? undefined,
    spokenDialects: r.spoken_dialects ?? [],
    dispatchConfindece: r.dispatch_confidence ?? 0,
    callDuration: r.call_duration ?? "00:00",
    callReceivedAt: new Date(r.call_received_at),
    dispatchedAt: r.dispatched_at ? new Date(r.dispatched_at) : undefined,
    arrivedAt: r.arrived_at ? new Date(r.arrived_at) : undefined,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at) : undefined,
    responseTimeSeconds: r.response_time_seconds ?? null,
    reasoningReport: r.reasoning_report ?? { content: "", sopUsed: [] },
    sopActions: r.sop_actions ?? [],
    operatorVerdict: r.operator_verdict ?? "",
    notes: r.notes ?? "",
    supervisingRelease: r.supervising_release ?? { inspector: "", status: 0 },
    incidentSHA: r.incident_sha ?? "",
    emotionalAnalysis: r.emotional_analysis ?? {
      panicLevel: "",
      distressScore: 0,
      speechRate: "",
      tremorDetected: false,
      volumeTrend: "Stable",
      aiConfidence: 0,
    },
    transcript: r.transcript ?? [],
    humanIntervention: r.human_intervention ?? { required: false },
    closingReport: {
      closedBy: r.closing_report?.closedBy ?? "",
      closedAt: new Date(r.closing_report?.closedAt || r.resolved_at || Date.now()),
      outcome: r.closing_report?.outcome ?? "",
      caseStatus: r.closing_report?.caseStatus ?? "CLOSED",
    },
    eventTimeline: r.event_timeline ?? [],
  };
}

export async function fetchHistoricalReports(): Promise<ArchivedReport[]> {
  const { data, error } = await supabase
    .from("historical_reports")
    .select("*")
    .order("call_received_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRowToReport);
}

export async function fetchHistoricalReportById(id: string): Promise<ArchivedReport | null> {
  const { data, error } = await supabase
    .from("historical_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRowToReport(data) : null;
}
