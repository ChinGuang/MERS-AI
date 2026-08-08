import { IncidentType, OutcomeType, SeverityType } from "@/models/report";
import { ArchivedReport } from "../types";

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function minutesAfter(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function fmtTime(date: Date) {
  return date.toTimeString().slice(0, 8);
}

/**
 * A handful of cases dated to "right now" so the Today view never renders a
 * bare empty state on a slow day. Dates are computed relative to Date.now()
 * so this stays "today" no matter when the app is opened.
 */
export function getTodaySeedReports(): ArchivedReport[] {
  const call1 = minutesAgo(215); // ~3h35m ago
  const call2 = minutesAgo(95); // ~1h35m ago
  const call3 = minutesAgo(38); // ~38m ago

  return [
    {
      id: "INC-TODAY-01",
      title: "Petaling Street Slip-and-Fall",
      outcome: OutcomeType.ACCEPT,
      createAt: call1,
      location: "Petaling Street, Kuala Lumpur",
      incidentType: IncidentType.MEDICAL,
      severity: SeverityType.MODERATE,
      caller: "MS. TAN",
      callerNumber: "+601X-XXX-5521",
      spokenDialects: ["EN", "Cantonese"],
      dispatchConfindece: 0.9,
      callDuration: "02:05",
      callReceivedAt: call1,
      dispatchedAt: minutesAfter(call1, 2),
      arrivedAt: minutesAfter(call1, 8),
      resolvedAt: minutesAfter(call1, 35),
      responseTimeSeconds: 120,
      reasoningReport: {
        content:
          "Elderly pedestrian slipped on wet tiles near the market, conscious with suspected wrist fracture, no head trauma reported.",
        sopUsed: ["Minor Trauma Response Guideline"],
      },
      sopActions: [
        "Instructed bystander to keep patient still and avoid moving the wrist.",
        "Dispatched standard ambulance unit.",
      ],
      operatorVerdict: "APPROVED & DISPATCHED — Straightforward case, AI recommendation followed as-is.",
      notes: "Patient transported for X-ray, minor fracture confirmed, discharged same day.",
      supervisingRelease: { inspector: "SYSTEM AUTOMATION", status: 1 },
      incidentSHA: "MERS999-SECURE-AUDIT-SESSION-TODAY-001",
      emotionalAnalysis: {
        panicLevel: "Moderate",
        distressScore: 38,
        speechRate: "150 wpm",
        tremorDetected: false,
        volumeTrend: "Stable",
        aiConfidence: 90,
      },
      transcript: [
        { time: "00:05", speaker: "Caller", text: "An elderly lady just slipped near the market, she's holding her wrist." },
        { time: "00:22", speaker: "Operator", text: "Keep her seated and still, please. Ambulance is on the way." },
      ],
      humanIntervention: { required: false },
      closingReport: {
        closedBy: "SYSTEM AUTOMATION",
        closedAt: minutesAfter(call1, 35),
        outcome: "Minor wrist fracture confirmed, patient discharged same day.",
        caseStatus: "CLOSED",
      },
      eventTimeline: [
        { time: fmtTime(call1), event: "Call received — MERS AI Core activated", type: "system" },
        { time: fmtTime(minutesAfter(call1, 0.3)), event: "Incident classified: MEDICAL / MODERATE (confidence 90%)", type: "ai" },
        { time: fmtTime(minutesAfter(call1, 2)), event: "Ambulance dispatched — AI recommendation auto-approved", type: "dispatch" },
        { time: fmtTime(minutesAfter(call1, 35)), event: "Case sealed — minor fracture confirmed", type: "close" },
      ],
    },
    {
      id: "INC-TODAY-02",
      title: "KLCC Park Suspected Chest Pain",
      outcome: OutcomeType.OVERRIDE,
      createAt: call2,
      location: "KLCC Park, Kuala Lumpur",
      incidentType: IncidentType.MEDICAL,
      severity: SeverityType.URGENT,
      caller: "MR. LIM",
      callerNumber: "+601X-XXX-7734",
      spokenDialects: ["EN", "Mandarin"],
      dispatchConfindece: 0.61,
      callDuration: "03:12",
      callReceivedAt: call2,
      dispatchedAt: minutesAfter(call2, 3),
      arrivedAt: minutesAfter(call2, 10),
      resolvedAt: minutesAfter(call2, 48),
      responseTimeSeconds: 180,
      reasoningReport: {
        content:
          "Jogger initially described 'a bit of tightness', downplaying symptoms, before caller revealed shortness of breath and left-arm pain moments later.",
        sopUsed: ["Chest Pain Rapid Response Guideline"],
      },
      sopActions: [
        "Instructed patient to sit down and stop exertion immediately.",
        "Dispatched Advanced Cardiac ambulance with continuous monitoring.",
      ],
      operatorVerdict: "APPROVED & DISPATCHED — Escalated after contradiction revealed cardiac risk.",
      notes: "Patient stabilised on-scene, transported for cardiac workup as a precaution.",
      supervisingRelease: { inspector: "DR. WONG", status: 0 },
      incidentSHA: "MERS999-SECURE-AUDIT-SESSION-TODAY-002",
      emotionalAnalysis: {
        panicLevel: "High",
        distressScore: 76,
        speechRate: "205 wpm",
        tremorDetected: true,
        volumeTrend: "Escalating",
        aiConfidence: 61,
        contradiction:
          "Caller said 'just a bit of tightness in my chest' then 'I can't breathe properly, my left arm hurts' 45 seconds later.",
      },
      transcript: [
        { time: "00:06", speaker: "Caller", text: "My friend says he's got a bit of tightness in his chest after jogging, probably nothing." },
        { time: "00:51", speaker: "Caller", text: "Wait — he says he can't breathe properly and his left arm hurts!" },
        { time: "01:05", speaker: "Operator", text: "Have him sit down now. Ambulance with cardiac monitoring dispatched." },
      ],
      humanIntervention: {
        required: true,
        interventionBy: "OP. SITI RAHMAH",
        role: "Medical Dispatcher",
        action: "Escalated from a low-priority classification to Advanced Cardiac Ambulance after the caller's contradiction.",
        reason: "AI confidence (61%) was too low to auto-escalate to URGENT; dispatcher acted on the live contradiction.",
        timestampLabel: fmtTime(minutesAfter(call2, 1)),
      },
      closingReport: {
        closedBy: "DR. WONG",
        closedAt: minutesAfter(call2, 48),
        outcome: "Patient stabilised on-scene, transported for cardiac workup, no infarction found.",
        caseStatus: "CLOSED",
      },
      eventTimeline: [
        { time: fmtTime(call2), event: "Call received — MERS AI Core activated", type: "system" },
        { time: fmtTime(minutesAfter(call2, 0.3)), event: "Incident classified: MEDICAL / MODERATE (low confidence 61%)", type: "ai" },
        { time: fmtTime(minutesAfter(call2, 1)), event: "HUMAN OVERRIDE — Op. Siti escalated to URGENT", type: "human" },
        { time: fmtTime(minutesAfter(call2, 3)), event: "Advanced Cardiac Ambulance dispatched", type: "dispatch" },
        { time: fmtTime(minutesAfter(call2, 48)), event: "Case sealed — patient stabilised", type: "close" },
      ],
    },
    {
      id: "INC-TODAY-03",
      title: "Bangsar Noise Complaint Prank",
      outcome: OutcomeType.REJECT,
      createAt: call3,
      location: "Bangsar, Kuala Lumpur",
      incidentType: IncidentType.CRIME,
      severity: SeverityType.MODERATE,
      caller: "UNKNOWN CELLULAR TERMINAL",
      callerNumber: "+601X-XXX-0000 (FLAGGED)",
      spokenDialects: ["EN"],
      dispatchConfindece: 0.22,
      callDuration: "00:48",
      callReceivedAt: call3,
      resolvedAt: minutesAfter(call3, 3),
      responseTimeSeconds: null,
      reasoningReport: {
        content:
          "Caller reported a vague disturbance with audible background laughter and no coherent details, matching prior prank patterns from the same cellular base station.",
        sopUsed: ["MERS Anti-Harassment & Prank Assessment Framework"],
      },
      sopActions: [
        "Rejected patrol unit deployment per low-confidence prank match.",
        "Logged MSISDN for pattern tracking.",
      ],
      operatorVerdict: "REJECTED — Low-confidence prank pattern, no dispatch required.",
      notes: "Caller disconnected before providing a coherent location or description.",
      supervisingRelease: { inspector: "SYSTEM AUTOMATION", status: 1 },
      incidentSHA: "MERS999-SECURE-AUDIT-SESSION-TODAY-003",
      emotionalAnalysis: {
        panicLevel: "Low",
        distressScore: 14,
        speechRate: "170 wpm",
        tremorDetected: false,
        volumeTrend: "Stable",
        aiConfidence: 78,
      },
      transcript: [
        { time: "00:04", speaker: "Caller", text: "Uh, something's happening on my street... [background laughter] ...help I guess?" },
        { time: "00:20", speaker: "Operator", text: "Can you confirm your exact location and the nature of the emergency?" },
        { time: "00:35", speaker: "Caller", text: "[call disconnects]" },
      ],
      humanIntervention: { required: false },
      closingReport: {
        closedBy: "SYSTEM AUTOMATION",
        closedAt: minutesAfter(call3, 3),
        outcome: "Low-confidence prank call, no emergency resources deployed.",
        caseStatus: "CLOSED",
      },
      eventTimeline: [
        { time: fmtTime(call3), event: "Call received — MERS AI Core activated", type: "system" },
        { time: fmtTime(minutesAfter(call3, 0.3)), event: "Dispatch recommendation: REJECT (confidence 22%)", type: "ai" },
        { time: fmtTime(minutesAfter(call3, 3)), event: "Caller disconnected — case auto-closed", type: "close" },
      ],
    },
  ];
}
