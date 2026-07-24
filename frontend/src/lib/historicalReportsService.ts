import { supabase } from "@/lib/supabaseClient";
import { ArchivedReport, OutcomeType, SeverityType, IncidentType } from "@/models/report";
import { HISTORICAL_REPORTS } from "@/data/historicalReports";
import { toast } from "sonner";

let cachedReportsPromise: Promise<ArchivedReport[]> | null = null;

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

export function fetchHistoricalReports(): Promise<ArchivedReport[]> {
  if (cachedReportsPromise) {
    return cachedReportsPromise;
  }

  cachedReportsPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("historical_reports")
        .select("*")
        .order("call_received_at", { ascending: false });

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn("Supabase fetch notice:", error.message);
          toast.warning("Supabase unavailable — displaying offline backup records.");
        }
        return HISTORICAL_REPORTS;
      }

      return data.map(mapRowToReport);
    } catch (err) {
      console.warn("Historical reports fetch exception:", err);
      toast.warning("Supabase connection error — displaying offline backup records.");
      return HISTORICAL_REPORTS;
    }
  })();

  return cachedReportsPromise;
}

export function clearHistoricalReportsCache() {
  cachedReportsPromise = null;
}

export async function fetchHistoricalReportById(id: string): Promise<ArchivedReport | null> {
  try {
    const { data, error } = await supabase
      .from("historical_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      if (error) console.warn(`Supabase fetch report ${id} notice:`, error.message);
      const fallback = HISTORICAL_REPORTS.find((r) => r.id === id) || null;
      if (fallback) {
        toast.warning(`Supabase lookup for ${id} failed — showing offline record.`);
      }
      return fallback;
    }

    return mapRowToReport(data);
  } catch (err) {
    console.warn(`Historical report ${id} fetch exception:`, err);
    return HISTORICAL_REPORTS.find((r) => r.id === id) || null;
  }
}
