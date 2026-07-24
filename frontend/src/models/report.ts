import z from "zod";

export type ReportFilterType =
  | "ALL"
  | OutcomeType.ACCEPT
  | OutcomeType.OVERRIDE
  | OutcomeType.REJECT;

export enum SeverityType {
  CRITICAL = "CRITICAL",
  URGENT = "URGENT",
  MODERATE = "MODERATE",
}

export enum IncidentType {
  UNKNOWN = "UNKNOWN",
  MEDICAL = "MEDICAL",
  FIRE = "FIRE",
  CRIME = "CRIME",
  ACCIDENT = "ACCIDENT",
  FLOOD = "FLOOD",
}

export enum OutcomeType {
  ACCEPT = "Accept",
  OVERRIDE = "Override",
  REJECT = "Reject",
}

export enum ReleaseType {
  CONFIRMED,
  NON_CONFIRMED,
}

const ReportBase = z.object({
  id: z.string(),
  title: z.string(),
  outcome: z.nativeEnum(OutcomeType),
  createAt: z.date(),
  location: z.string(),
  incidentType: z.enum(IncidentType),
  severity: z.enum(SeverityType),
});

const SupervisingReleaseInfoSchema = z.object({
  inspector: z.string(),
  status: z.enum(ReleaseType),
});

export type SupervisingReleaseInfo = z.infer<typeof SupervisingReleaseInfoSchema>;

export const OperatorNoteSchema = z.object({
  operatorVerdict: z.string(),
  notes: z.string(),
});

export type OperatorNote = z.infer<typeof OperatorNoteSchema>;

export const ArchivedReportSchema = ReportBase.extend(
  OperatorNoteSchema.shape,
).extend({
  reasoningReport: z.object({
    content: z.string(),
    sopUsed: z.array(z.string()),
  }),
  sopActions: z.array(z.string()),
  supervisingRelease: SupervisingReleaseInfoSchema,
  incidentSHA: z.string(),
  caller: z.string(),
  callerNumber: z.string().optional(),
  spokenDialects: z.array(z.string()),
  dispatchConfindece: z.number(),

  // Call metadata
  callDuration: z.string(),
  callReceivedAt: z.date(),
  dispatchedAt: z.date().optional(),
  arrivedAt: z.date().optional(),
  resolvedAt: z.date().optional(),
  responseTimeSeconds: z.number().nullable().optional(),

  // Emotional analysis
  emotionalAnalysis: z.object({
    panicLevel: z.string(),
    distressScore: z.number(),
    speechRate: z.string(),
    tremorDetected: z.boolean(),
    volumeTrend: z.enum(["Escalating", "Stable", "Declining"]),
    aiConfidence: z.number(),
    contradiction: z.string().optional(),
  }),

  // Call transcript
  transcript: z.array(
    z.object({
      time: z.string(),
      speaker: z.string(),
      text: z.string(),
    })
  ),

  // Human intervention
  humanIntervention: z
    .object({
      required: z.boolean(),
      interventionBy: z.string().optional(),
      role: z.string().optional(),
      action: z.string().optional(),
      reason: z.string().optional(),
      timestampLabel: z.string().optional(),
    })
    .optional(),

  // Closing report
  closingReport: z.object({
    closedBy: z.string(),
    closedAt: z.date(),
    outcome: z.string(),
    caseStatus: z.enum(["CLOSED", "PENDING_REVIEW", "ESCALATED"]),
  }),

  // Full event timeline
  eventTimeline: z.array(
    z.object({
      time: z.string(),
      event: z.string(),
      type: z
        .enum(["system", "ai", "human", "dispatch", "close"])
        .optional(),
    })
  ),
});

export type ArchivedReport = z.infer<typeof ArchivedReportSchema>;
