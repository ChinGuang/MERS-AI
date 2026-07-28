import { ArchivedReport as ArchivedReportModel } from "./models/report";
export interface Incident {
  id: string;
  case_number: string;
  type?: "medical" | "fire" | "crime" | "accident" | "flood";
  title: string;
  location: string;
  severity:
    | SeverityType.CRITICAL
    | SeverityType.URGENT
    | SeverityType.MODERATE
    | SeverityType.RESOLVED;
  priority: number;
  lang: string;
  occurDateTime: string;
  caller: string;
  callId: string;
  /** Real call-start timestamp (ISO, UTC) - use this, not a decoded UUID, for any duration/elapsed-time math. */
  callStartedAt?: string;
  callerAge?: string;
  callerGender?: string;
  duration: string;
  distressScore: number;
  panicLevel: string;
  entities: string[];
  reason: string;
  confidence: number;
  contradiction?: string;
  sopCitation: string;
  sopProcedure: string[];
  responder: {
    name: string;
    type: string;
    distance: string;
    eta: string;
    status: string;
    paramedic?: string;
  };
  timeline: { time: string; event: string; isAlert?: boolean }[];
  transcript: {
    time: string;
    speaker: string;
    text: string;
    highlight?: boolean;
    /** ISO 639-1 code detected by the backend, e.g. "en", "ms", "zh", "ta". */
    language?: string;
    /** English translation, present only when language isn't already English. */
    translatedText?: string;
  }[];
  coordinates?: { lat: number; lng: number };
  /** Nearest emergency service location computed by the backend's location/dispatcher agent. */
  dispatchCenter?: { lat: number; lng: number; name?: string };
  status: {
    location?: string;
    transcription?: string;
    triage?: string;
    sop?: string;
    dispatch?: string;
  };
}

export type ArchivedReport = ArchivedReportModel;

export type Theme = "dark" | "light";

export enum SeverityType {
  ALL = "all",
  CRITICAL = "critical",
  URGENT = "urgent",
  MODERATE = "moderate",
  RESOLVED = "resolved",
}

export enum TabName {
  DASHBOARD = "dashboard",
  OPERATIONS = "operations",
  HISTORY = "history",
  SIMULATION = "simulation",
}

export interface UserProfile {
  avatar_url?: string;
  full_name: string;
  role: string;
  unit: string;
}
