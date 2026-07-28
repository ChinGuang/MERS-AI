import { z } from "zod";

// --- Enums ---
export const IncidentTypeSchema = z.enum([
  "medical",
  "fire",
  "crime",
  "accident",
  "flood",
]);
export type IncidentType = z.infer<typeof IncidentTypeSchema>;

export const SeverityTypeSchema = z.preprocess(
  // 1. Grab the incoming value and transform it
  (val) => (typeof val === "string" ? val.toUpperCase() : val),
  // 2. Pass it to your strict enum
  z.enum(["CRITICAL", "URGENT", "MODERATE", "RESOLVED"]),
);
export type SeverityType = z.infer<typeof SeverityTypeSchema>;

// --- Nested Sub-Schemas ---
export const ResponderSchema = z.object({
  name: z.string().nullish(),
  type: z.string().nullish(),
  distance: z.string().nullish(),
  eta: z.string().nullish(),
  status: z.string().nullish(),
  paramedic: z.string().optional(),
});

export const TimelineItemSchema = z.object({
  time: z.string(), // e.g., "14:22:00"
  event: z.string(),
  isAlert: z.boolean().optional(),
});

export const TranscriptItemSchema = z.object({
  id: z.uuid(),
  transcript: z.string(),
  created_at: z.transform((i: string) => new Date(i)),
  start_duration: z.int().nonnegative(),
  end_duration: z.int().nonnegative(),
  call_id: z.uuidv7(),
  role: z.string(),
  language: z.string().nullish(),
  translated_text: z.string().nullish(),
});

export type TranscriptItem = z.infer<typeof TranscriptItemSchema>;

export const CoordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const DispatchCenterSchema = z.object({
  id: z.string().optional(),
  name: z.string().nullish(),
  lat: z.number(),
  lng: z.number(),
});

export const StatusSchema = z.object({
  location: z.string().optional(),
  transcription: z.string().optional(),
  triage: z.string().optional(),
  sop: z.string().optional(),
  dispatch: z.string().optional(),
});

// --- Main Incident Schema ---
export const IncidentDtoSchema = z.object({
  id: z.string().uuid().or(z.string()), // Accepts standard string keys or strict UUID strings
  type: IncidentTypeSchema.nullish(),
  title: z.string(),
  location: z.string().nullish(),
  severity: SeverityTypeSchema.nullish(),
  priority: z.number().int().nullish(),
  lang: z.string().nullish(),
  caller: z.string().nullish(),
  duration: z.string().default("00:00"),
  reason: z.string().nullish(),
  confidence: z.number(),
  contradiction: z.string().nullable().optional(),
  callId: z.string(),
  // CamelCase properties received from backend DTO
  callStartedAt: z.string().nullish(),
  occurDateTime: z.string().nullish(), // Validates strict ISO 8601 string format (ends with Z)
  distressScore: z.number().nullish(),
  panicLevel: z.string().nullish(),
  sopCitation: z.string().nullish(),
  sopProcedure: z.array(z.string()),

  // Nested Structures
  entities: z.array(z.string()),
  responder: ResponderSchema.nullish(),
  timeline: z.array(TimelineItemSchema),
  transcript: z.array(TranscriptItemSchema),
  coordinates: CoordinatesSchema,
  dispatchCenter: DispatchCenterSchema.nullish(),
  status: StatusSchema,
});

// Infer TypeScript interface directly from Zod Schema
export type IncidentDto = z.infer<typeof IncidentDtoSchema>;
