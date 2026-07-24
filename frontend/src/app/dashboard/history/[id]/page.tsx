"use client"

import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, ShieldAlert, Download, Printer,
  Clock, Timer, Phone, Mic, Brain, Shield,
  User, Ambulance, FileText, Lock,
  Activity, Waves, Volume2, AlertTriangle,
  CheckCircle2, XCircle, UserCheck, Zap, MapPin,
  Flame, Heart, Car, Droplets, CalendarClock, BadgeCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HISTORICAL_REPORTS } from "@/data/historicalReports"
import { getPanicBadgeClass } from "@/lib/severity"
import { IncidentType, OutcomeType } from "@/models/report"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/app/dashboard/_components/theme-toggle"
import type { ArchivedReport } from "@/models/report"

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(d?: Date) {
  if (!d) return "—"
  return d.toLocaleString("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
function fmtTime(d?: Date) {
  if (!d) return "—"
  return d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
function fmtRes(s?: number | null) {
  if (!s) return "—"
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

// ─── icon maps ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  [IncidentType.MEDICAL]: Heart, [IncidentType.FIRE]: Flame,
  [IncidentType.CRIME]: Shield, [IncidentType.ACCIDENT]: Car,
  [IncidentType.FLOOD]: Droplets, [IncidentType.UNKNOWN]: AlertTriangle,
}
const TYPE_ICON_STYLE: Record<string, string> = {
  [IncidentType.MEDICAL]:  "bg-destructive/20 text-destructive",
  [IncidentType.FIRE]:     "bg-warning/20     text-warning",
  [IncidentType.CRIME]:    "bg-muted          text-muted-foreground",
  [IncidentType.ACCIDENT]: "bg-primary/20     text-primary",
  [IncidentType.FLOOD]:    "bg-primary/15     text-primary",
  [IncidentType.UNKNOWN]:  "bg-muted          text-muted-foreground",
}
const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "border-destructive/60 bg-destructive/10 text-destructive",
  URGENT:   "border-warning/60   bg-warning/10   text-warning",
  MODERATE: "border-primary/60   bg-primary/10   text-primary",
}
const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#dc2626", URGENT: "#d97706", MODERATE: "#2563eb",
}

// ─── timeline helpers ─────────────────────────────────────────────────────────

function dot(t?: string) {
  return { ai: "bg-primary", human: "bg-warning", dispatch: "bg-secondary", close: "bg-muted-foreground" }[t ?? ""] ?? "bg-border"
}
function row(t?: string) {
  return {
    ai:       "border-primary/30  bg-primary/5",
    human:    "border-warning/30  bg-warning/5",
    dispatch: "border-secondary/30 bg-secondary/5",
    close:    "border-border       bg-muted/30 text-muted-foreground",
  }[t ?? ""] ?? "border-border bg-muted/20 text-muted-foreground"
}

// ─── shared primitives ────────────────────────────────────────────────────────

function SecLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</p>
}
function KV({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-right text-xs font-medium", mono && "font-mono")}>{value ?? "—"}</span>
    </div>
  )
}
function Metric({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
      <Icon className={cn("size-3.5 shrink-0", color ?? "text-muted-foreground")} />
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xs font-bold leading-tight">{value}</p>
      </div>
    </div>
  )
}
function PanelCard({ icon: Icon, iconBg, title, children }: { icon: React.ElementType; iconBg: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className={cn("flex size-6 items-center justify-center rounded-md", iconBg)}>
          <Icon className="size-3.5" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

// ─── PRINT: generate fully self-contained HTML from report data ───────────────

function buildPrintHTML(r: ArchivedReport): string {
  const sevColor  = SEVERITY_COLOR[r.severity] ?? "#2563eb"
  const approved  = r.outcome !== OutcomeType.REJECT
  const verdColor = approved ? "#16a34a" : "#dc2626"
  const hasHuman  = r.humanIntervention?.required

  const kv = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px 6px 0;font-size:11px;color:#6b7280;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:6px 0;font-size:11px;font-weight:600;text-align:right;">${v}</td></tr>`

  const grid4 = (items: [string, string][]) => `
    <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
      <tr>${items.map(([k, v]) => `
        <td style="width:25%;padding:6px 16px 6px 0;vertical-align:top;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:3px;">${k}</div>
          <div style="font-size:11px;font-weight:700;color:#111827;">${v}</div>
        </td>`).join("")}
      </tr>
    </table>`

  const section = (title: string, body: string) => `
    <div style="margin-bottom:24px;">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;border-bottom:2px solid #e5e7eb;padding-bottom:5px;margin-bottom:12px;">${title}</div>
      ${body}
    </div>`

  const DOT_C: Record<string, string> = { ai: "#2563eb", human: "#d97706", dispatch: "#22c55e", close: "#9ca3af" }
  const BG_C: Record<string, string>  = { ai: "#eff6ff", human: "#fffbeb", dispatch: "#f0fdf4", close: "#f9fafb" }
  const timelineRows = r.eventTimeline.map(e => {
    const dotC = DOT_C[e.type ?? ""] ?? "#d1d5db"
    const bgC  = BG_C[e.type ?? ""]  ?? "#f9fafb"
    return `<tr>
      <td style="padding:5px 10px 5px 0;white-space:nowrap;vertical-align:top;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${dotC};flex-shrink:0;margin-top:2px;"></div>
          <span style="font-family:monospace;font-size:10px;color:#6b7280;">${e.time}</span>
        </div>
      </td>
      <td style="padding:5px 0;">
        <div style="background:${bgC};border:1px solid #e5e7eb;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:500;">${e.event}</div>
      </td>
    </tr>`
  }).join("")

  const sopList = r.sopActions.map((a, i) => `
    <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
      <div style="min-width:22px;height:22px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#2563eb;flex-shrink:0;">${i + 1}</div>
      <p style="font-size:11px;line-height:1.6;margin:0;padding-top:2px;">${a}</p>
    </div>`).join("")

  const transcriptRows = r.transcript.map(t => {
    const isOp = t.speaker.toLowerCase() === "operator"
    return `<tr>
      <td style="padding:5px 8px 5px 0;white-space:nowrap;vertical-align:top;font-size:9px;font-family:monospace;color:#9ca3af;">[${t.speaker.toUpperCase()}]<br>${t.time}</td>
      <td style="padding:5px 0;${isOp ? "text-align:right;" : ""}">
        <div style="display:inline-block;max-width:85%;background:${isOp ? "#2563eb" : "#f3f4f6"};color:${isOp ? "#fff" : "#111827"};border-radius:${isOp ? "12px 12px 3px 12px" : "12px 12px 12px 3px"};padding:7px 12px;font-size:11px;line-height:1.55;">${t.text}</div>
      </td>
    </tr>`
  }).join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Incident Closing Report — ${r.id}</title>
<style>
  @page { size: A4; margin: 18mm 20mm 18mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-size: 20px; font-weight: 800; color: #111827; }
  h2 { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; }
  .page { max-width: 760px; margin: 0 auto; }
  .avoid-break { page-break-inside: avoid; }
</style>
</head>
<body>
<div class="page">

  <!-- ══ LETTERHEAD ══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;margin-bottom:20px;border-bottom:3px solid ${sevColor};">
    <div style="display:flex;align-items:flex-start;gap:14px;">
      <div style="width:52px;height:52px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      </div>
      <div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:3px;">MERS-AI · Malaysia Emergency Response System</div>
        <h1>Official Incident Closing Report</h1>
        <div style="font-size:10px;color:#9ca3af;margin-top:4px;font-family:monospace;">Document generated: ${new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" })} &nbsp;|&nbsp; ${new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#9ca3af;margin-bottom:4px;">Case Reference</div>
      <div style="font-size:18px;font-weight:800;font-family:monospace;color:#111827;">${r.id}</div>
      <div style="margin-top:6px;">
        <span style="display:inline-block;padding:3px 12px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;border:2px solid ${r.closingReport.caseStatus === "CLOSED" ? "#22c55e" : "#d97706"};color:${r.closingReport.caseStatus === "CLOSED" ? "#16a34a" : "#d97706"};">${r.closingReport.caseStatus}</span>
      </div>
      <div style="margin-top:6px;">
        <span style="display:inline-block;padding:3px 12px;border-radius:999px;font-size:10px;font-weight:800;background:${sevColor}15;color:${sevColor};border:1px solid ${sevColor}40;">${r.severity}</span>
      </div>
    </div>
  </div>

  <!-- ══ SECTION 1: INCIDENT SUMMARY ══ -->
  ${section("1 · Incident Summary",
    grid4([
      ["Incident Title", r.title],
      ["Type", r.incidentType],
      ["Severity", r.severity],
      ["Dispatch Decision", r.outcome],
    ]) +
    `<div style="height:8px;"></div>` +
    grid4([
      ["Location", r.location],
      ["Caller", r.caller],
      ["Caller Number", r.callerNumber ?? "—"],
      ["Language(s)", r.spokenDialects.join(" / ")],
    ])
  )}

  <!-- ══ SECTION 2: RESPONSE METRICS ══ -->
  ${section("2 · Response Metrics",
    `<table style="width:100%;border-collapse:collapse;">
      <tbody>
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:20px;">
            <table style="width:100%;">
              ${kv("Call Received",  fmt(r.callReceivedAt))}
              ${kv("Unit Dispatched", fmt(r.dispatchedAt))}
              ${kv("Unit Arrived",   fmt(r.arrivedAt))}
              ${kv("Case Resolved",  fmt(r.resolvedAt))}
            </table>
          </td>
          <td style="width:50%;vertical-align:top;border-left:1px solid #e5e7eb;padding-left:20px;">
            <table style="width:100%;">
              ${kv("Call Duration",    r.callDuration)}
              ${kv("Response Time",   fmtRes(r.responseTimeSeconds))}
              ${kv("AI Confidence",   Math.round(r.dispatchConfindece * 100) + "%")}
              ${kv("Distress Score",  r.emotionalAnalysis.distressScore + "/100")}
            </table>
          </td>
        </tr>
      </tbody>
    </table>`
  )}

  <!-- ══ SECTION 3: EMOTIONAL ANALYSIS ══ -->
  ${section("3 · Caller Emotional & Prosody Analysis",
    `<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tbody>
        <tr>
          ${[
            ["Panic Level", r.emotionalAnalysis.panicLevel],
            ["Speech Rate", r.emotionalAnalysis.speechRate],
            ["Volume Trend", r.emotionalAnalysis.volumeTrend],
            ["Tremor", r.emotionalAnalysis.tremorDetected ? "Detected" : "Not detected"],
          ].map(([k, v]) => `
            <td style="width:25%;padding:6px 12px 6px 0;vertical-align:top;border-bottom:1px solid #e5e7eb;">
              <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:3px;">${k}</div>
              <div style="font-size:11px;font-weight:700;">${v}</div>
            </td>`).join("")}
        </tr>
      </tbody>
    </table>
    ${r.emotionalAnalysis.contradiction ? `
    <div style="background:#fffbeb;border:1px solid #f59e0b;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;padding:8px 12px;margin-top:4px;">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#d97706;margin-bottom:2px;">Contradiction Detected</div>
      <div style="font-size:11px;line-height:1.5;">${r.emotionalAnalysis.contradiction}</div>
    </div>` : ""}
  `)}

  <!-- ══ SECTION 4: AI TRIAGE ══ -->
  ${section("4 · AI Triage Reasoning",
    `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;margin-bottom:10px;">
      <div style="font-size:11px;line-height:1.7;">${r.reasoningReport.content}</div>
    </div>
    ${r.reasoningReport.sopUsed.map(s => `
      <div style="display:inline-flex;align-items:center;gap:6px;background:#f8faff;border:1px solid #dbeafe;border-radius:6px;padding:4px 10px;margin-right:6px;margin-top:4px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span style="font-size:10px;font-weight:600;color:#2563eb;font-family:monospace;">${s}</span>
      </div>`).join("")}
  `)}

  <!-- ══ SECTION 5: SOP ACTIONS ══ -->
  ${section("5 · SOP Actions Executed", sopList)}

  <!-- ══ SECTION 6: TRANSCRIPT EXCERPT ══ -->
  ${section("6 · Call Transcript",
    `<table style="width:100%;border-collapse:collapse;">${transcriptRows}</table>`
  )}

  <!-- ══ SECTION 7: OPERATOR VERDICT ══ -->
  ${section("7 · Operator Verdict & Notes",
    `<div style="border-left:4px solid ${verdColor};background:${approved ? "#f0fdf4" : "#fef2f2"};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:10px;">
      <div style="font-size:12px;font-weight:800;color:${verdColor};margin-bottom:4px;">${r.operatorVerdict}</div>
      <div style="font-size:11px;line-height:1.6;color:#374151;">${r.notes}</div>
    </div>`
  )}

  ${hasHuman ? section("8 · Human Intervention Record",
    `<div style="border:1px solid #f59e0b;border-radius:8px;overflow:hidden;">
      <div style="background:#fffbeb;padding:10px 14px;border-bottom:1px solid #f59e0b;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:800;">${r.humanIntervention!.interventionBy}</div>
          <div style="font-size:10px;color:#6b7280;">${r.humanIntervention!.role}</div>
        </div>
        <div style="font-family:monospace;font-size:11px;font-weight:700;background:#fff;border:1px solid #f59e0b;border-radius:4px;padding:3px 8px;">${r.humanIntervention!.timestampLabel}</div>
      </div>
      <div style="padding:12px 14px;">
        <div style="margin-bottom:8px;">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:4px;">Action Taken</div>
          <div style="font-size:11px;line-height:1.6;">${r.humanIntervention!.action}</div>
        </div>
        <div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:4px;">Reason for Override</div>
          <div style="font-size:11px;line-height:1.6;color:#374151;">${r.humanIntervention!.reason}</div>
        </div>
      </div>
    </div>`) : ""}

  <!-- ══ TIMELINE ══ -->
  ${section(`${hasHuman ? "9" : "8"} · Event Timeline`,
    `<table style="width:100%;border-collapse:collapse;">${timelineRows}</table>`
  )}

  <!-- ══ FINAL OUTCOME ══ -->
  ${section(`${hasHuman ? "10" : "9"} · Final Outcome`,
    `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;font-size:12px;line-height:1.75;font-weight:500;">${r.closingReport.outcome}</div>`
  )}

  <!-- ══ SIGN-OFF ══ -->
  <div class="avoid-break">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;border-bottom:2px solid #e5e7eb;padding-bottom:5px;margin-bottom:16px;">${hasHuman ? "11" : "10"} · Official Sign-Off</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:33%;padding-right:16px;vertical-align:top;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:6px;">Sealed By</div>
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;background:#f9fafb;">
            <div style="font-size:13px;font-weight:800;">${r.closingReport.closedBy}</div>
            <div style="font-size:10px;color:#6b7280;font-family:monospace;margin-top:3px;">${fmt(r.closingReport.closedAt)}</div>
          </div>
        </td>
        <td style="width:33%;padding:0 8px;vertical-align:top;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:6px;">Supervising Release</div>
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;background:#f9fafb;">
            <div style="font-size:13px;font-weight:800;">${r.supervisingRelease.inspector}</div>
            <div style="font-size:11px;font-weight:700;margin-top:4px;color:${r.supervisingRelease.status === 0 ? "#16a34a" : "#dc2626"};">${r.supervisingRelease.status === 0 ? "✓ Confirmed" : "✗ Not Confirmed"}</div>
          </div>
        </td>
        <td style="width:33%;padding-left:16px;vertical-align:top;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:6px;">Document Status</div>
          <div style="border:2px solid ${r.closingReport.caseStatus === "CLOSED" ? "#22c55e" : "#d97706"};border-radius:8px;padding:12px 14px;background:${r.closingReport.caseStatus === "CLOSED" ? "#f0fdf4" : "#fffbeb"};">
            <div style="font-size:13px;font-weight:800;color:${r.closingReport.caseStatus === "CLOSED" ? "#16a34a" : "#d97706"};">${r.closingReport.caseStatus}</div>
            <div style="font-size:10px;color:#6b7280;margin-top:3px;">${r.closingReport.caseStatus === "CLOSED" ? "Incident fully resolved" : "Pending review"}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- SHA audit seal -->
    <div style="margin-top:16px;border:1.5px dashed #d1d5db;border-radius:8px;padding:10px 14px;background:#f9fafb;display:flex;align-items:center;gap:10px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span style="font-family:monospace;font-size:9px;color:#9ca3af;word-break:break-all;">${r.incidentSHA}</span>
    </div>
  </div>

  <!-- footer -->
  <div style="margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;color:#9ca3af;font-size:9px;">
    <span>MERS-AI · Malaysia Emergency Response System · Confidential</span>
    <span>Generated ${new Date().toLocaleString("en-MY")}</span>
  </div>

</div>
</body>
</html>`
}

// ─── on-screen closing report ─────────────────────────────────────────────────

function ClosingReport({ report }: { report: ArchivedReport }) {
  const isApproved = report.outcome !== OutcomeType.REJECT
  const today = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" })

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">

      {/* letterhead */}
      <div className="border-b-4 border-primary px-8 py-6 bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 shrink-0">
              <ShieldAlert className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">MERS-AI · Malaysia Emergency Response System</p>
              <h2 className="mt-0.5 text-xl font-bold">Official Incident Closing Report</h2>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">Document generated: {today}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Case Reference</p>
            <p className="mt-0.5 font-mono text-lg font-bold">{report.id}</p>
            <div className="mt-1.5 flex justify-end gap-1.5">
              <Badge className={cn("text-[10px] font-bold", report.closingReport.caseStatus === "CLOSED" ? "bg-secondary/20 text-secondary border border-secondary/40" : "bg-warning/20 text-warning border border-warning/40")}>
                {report.closingReport.caseStatus}
              </Badge>
              <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest", SEVERITY_BADGE[report.severity])}>
                {report.severity}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/60">

        {/* 1. incident summary */}
        <section className="px-8 py-5">
          <SecLabel>1 · Incident Summary</SecLabel>
          <div className="grid grid-cols-2 gap-x-8 sm:grid-cols-4">
            {[
              ["Incident Title",    report.title],
              ["Incident Type",     report.incidentType],
              ["Severity",          report.severity],
              ["Dispatch Decision", report.outcome],
              ["Location",          report.location],
              ["Caller",            report.caller],
              ["Caller Number",     report.callerNumber ?? "—"],
              ["Language(s)",       report.spokenDialects.join(" / ")],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-border/30 py-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-xs font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 2. response metrics */}
        <section className="px-8 py-5">
          <SecLabel>2 · Response Metrics</SecLabel>
          <div className="grid grid-cols-2 gap-x-8 sm:grid-cols-4">
            {[
              ["Call Received",    fmt(report.callReceivedAt)],
              ["Unit Dispatched",  fmt(report.dispatchedAt)],
              ["Unit Arrived",     fmt(report.arrivedAt)],
              ["Case Resolved",    fmt(report.resolvedAt)],
              ["Call Duration",    report.callDuration],
              ["Response Time",    fmtRes(report.responseTimeSeconds)],
              ["AI Confidence",    `${Math.round(report.dispatchConfindece * 100)}%`],
              ["Distress Score",   `${report.emotionalAnalysis.distressScore}/100`],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-border/30 py-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-xs font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. emotional */}
        <section className="px-8 py-5">
          <SecLabel>3 · Caller Emotional & Prosody Analysis</SecLabel>
          <div className="grid grid-cols-2 gap-x-8 sm:grid-cols-4 mb-3">
            {[
              ["Panic Level",  report.emotionalAnalysis.panicLevel],
              ["Speech Rate",  report.emotionalAnalysis.speechRate],
              ["Volume Trend", report.emotionalAnalysis.volumeTrend],
              ["Tremor",       report.emotionalAnalysis.tremorDetected ? "Detected" : "Not detected"],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-border/30 py-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{k}</p>
                <p className="mt-0.5 text-xs font-semibold">{v}</p>
              </div>
            ))}
          </div>
          {report.emotionalAnalysis.contradiction && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <p className="text-xs leading-relaxed">{report.emotionalAnalysis.contradiction}</p>
            </div>
          )}
        </section>

        {/* 4. AI triage */}
        <section className="px-8 py-5">
          <SecLabel>4 · AI Triage Reasoning</SecLabel>
          <div className="rounded-lg border bg-primary/5 px-4 py-3 text-xs leading-relaxed mb-3">
            {report.reasoningReport.content}
          </div>
          <div className="flex flex-wrap gap-2">
            {report.reasoningReport.sopUsed.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1">
                <FileText className="size-3 text-primary" />
                <span className="font-mono text-[10px] text-primary">{s}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. SOP */}
        <section className="px-8 py-5">
          <SecLabel>5 · SOP Actions Executed</SecLabel>
          <ol className="space-y-2.5">
            {report.sopActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary mt-0.5">{i + 1}</span>
                <span className="text-xs leading-relaxed">{a}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 6. operator verdict */}
        <section className="px-8 py-5">
          <SecLabel>6 · Operator Verdict & Notes</SecLabel>
          <div className={cn("rounded-lg border-l-4 px-4 py-3 mb-2", isApproved ? "border-secondary bg-secondary/5" : "border-destructive bg-destructive/5")}>
            <p className="text-xs font-bold">{report.operatorVerdict}</p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{report.notes}</p>
        </section>

        {/* 7. human intervention */}
        {report.humanIntervention?.required && (
          <section className="px-8 py-5">
            <SecLabel>7 · Human Intervention Record</SecLabel>
            <div className="rounded-lg border border-warning/40 overflow-hidden">
              <div className="flex items-center justify-between bg-warning/10 px-4 py-2.5 border-b border-warning/30">
                <div>
                  <p className="text-sm font-bold">{report.humanIntervention.interventionBy}</p>
                  <p className="text-[10px] text-muted-foreground">{report.humanIntervention.role}</p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{report.humanIntervention.timestampLabel}</Badge>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border/40 px-0">
                <div className="px-4 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Action Taken</p>
                  <p className="text-xs leading-relaxed">{report.humanIntervention.action}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Reason for Override</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{report.humanIntervention.reason}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* final outcome */}
        <section className="px-8 py-5">
          <SecLabel>{report.humanIntervention?.required ? "8" : "7"} · Final Outcome</SecLabel>
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm font-medium leading-relaxed">
            {report.closingReport.outcome}
          </div>
        </section>

        {/* sign-off */}
        <section className="px-8 py-6">
          <SecLabel>{report.humanIntervention?.required ? "9" : "8"} · Official Sign-Off</SecLabel>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Sealed By</p>
              <div className="rounded-lg border bg-muted/20 px-4 py-3">
                <p className="text-sm font-bold">{report.closingReport.closedBy}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{fmt(report.closingReport.closedAt)}</p>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Supervising Release</p>
              <div className="rounded-lg border bg-muted/20 px-4 py-3">
                <p className="text-sm font-bold">{report.supervisingRelease.inspector}</p>
                <p className={cn("mt-0.5 text-xs font-bold", report.supervisingRelease.status === 0 ? "text-secondary" : "text-destructive")}>
                  {report.supervisingRelease.status === 0 ? "✓ Confirmed" : "✗ Not Confirmed"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Document Status</p>
              <div className={cn("rounded-lg border px-4 py-3", report.closingReport.caseStatus === "CLOSED" ? "border-secondary/40 bg-secondary/5" : "border-warning/40 bg-warning/5")}>
                <p className={cn("text-sm font-bold", report.closingReport.caseStatus === "CLOSED" ? "text-secondary" : "text-warning")}>
                  {report.closingReport.caseStatus}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {report.closingReport.caseStatus === "CLOSED" ? "Incident fully resolved" : "Pending review"}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-dashed bg-muted/10 px-4 py-2.5">
            <Lock className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="break-all font-mono text-[10px] text-muted-foreground">{report.incidentSHA}</p>
          </div>
        </section>

      </div>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function IncidentDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const report = HISTORICAL_REPORTS.find(r => r.id === id)

  function handlePrint() {
    if (!report) return
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(buildPrintHTML(report))
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  if (!report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <ShieldAlert className="size-12 text-muted-foreground mb-4" />
        <h1 className="text-lg font-bold">Incident Not Found</h1>
        <p className="text-sm text-muted-foreground mt-1">No record for ID: {id}</p>
        <Button className="mt-6" onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  const isApproved = report.outcome !== OutcomeType.REJECT
  const ea         = report.emotionalAnalysis
  const TypeIcon   = TYPE_ICON[report.incidentType] ?? AlertTriangle
  const typeStyle  = TYPE_ICON_STYLE[report.incidentType] ?? "bg-muted text-muted-foreground"

  return (
    <div className="min-h-screen bg-background">

      {/* sticky nav */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />Back
          </Button>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex items-center gap-1.5 text-sm">
            <ShieldAlert className="size-4 text-primary" />
            <span className="font-bold">MERS-AI</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">History</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono font-semibold">{report.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
            <Printer className="size-3.5" />Print
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handlePrint}>
            <Download className="size-3.5" />Download PDF
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 lg:px-6">

        {/* hero header */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex justify-between items-c">
            <div className="">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", typeStyle)}>
                    <TypeIcon className="size-6" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold leading-tight">{report.title}</h1>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />{report.location}
                    </p>
                    
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest", SEVERITY_BADGE[report.severity] ?? "border-muted bg-muted")}>{report.severity}</span>
                <Badge variant="outline" className="font-mono text-[10px]">{report.id}</Badge>
                <Badge className={cn("text-[10px] font-bold", isApproved ? "bg-secondary/20 text-secondary" : "bg-destructive/20 text-destructive")}>
                  {isApproved ? <CheckCircle2 className="mr-1 size-2.5" /> : <XCircle className="mr-1 size-2.5" />}
                  {report.outcome}
                </Badge>
                {report.humanIntervention?.required && (
                  <Badge className="bg-warning/20 text-warning text-[10px] font-bold">
                    <UserCheck className="mr-1 size-2.5" />Human Involved
                  </Badge>
                )}
                <Badge className={cn("text-[10px]", report.closingReport.caseStatus === "CLOSED" ? "bg-muted text-muted-foreground" : "bg-warning/20 text-warning")}>
                  {report.closingReport.caseStatus}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric icon={Clock}      label="Duration"    value={report.callDuration}                                color="text-primary" />
              <Metric icon={Timer}      label="Response"    value={fmtRes(report.responseTimeSeconds)}                 color="text-secondary" />
              <Metric icon={BadgeCheck} label="AI Conf."    value={`${Math.round(report.dispatchConfindece * 100)}%`}  color={report.dispatchConfindece >= 0.8 ? "text-secondary" : "text-warning"} />
              <Metric icon={Mic}        label="Language"    value={report.spokenDialects.join(" / ")}                  color="text-muted-foreground" />
            </div>
          </div>
          

          
        </div>

        <div className="flex flex-col">
          {/* TABS — below hero */}
          <Tabs defaultValue="call-details" className="flex flex-col">
            <TabsList className="h-9 w-full justify-start rounded-lg bg-muted p-1">
              {[
                { value: "call-details",   label: "Call Details" },
                { value: "dispatch",       label: "Dispatch Report" },
                { value: "sop",            label: "SOP Actions" },
                { value: "timeline",       label: "Event Timeline" },
                { value: "closing-report", label: "Closing Report" },
              ].map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-md px-3 text-xs font-semibold data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground dark:data-[state=active]:text-primary-foreground"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {/* ── Call Details ── */}
            <TabsContent value="call-details" className="mt-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              <PanelCard icon={Phone} iconBg="bg-primary/15 text-primary" title="Call Metadata">
                <KV label="Caller Name"   value={report.caller} />
                <KV label="Caller Number" value={report.callerNumber} mono />
                <KV label="Language(s)"   value={report.spokenDialects.join(" / ")} />
                <KV label="Call Duration" value={report.callDuration} />
                <KV label="Call Received" value={fmt(report.callReceivedAt)} />
                <KV label="Dispatched At" value={fmt(report.dispatchedAt)} />
                <KV label="Unit Arrived"  value={fmt(report.arrivedAt)} />
                <KV label="Case Resolved" value={fmt(report.resolvedAt)} />
              </PanelCard>

              <PanelCard icon={Activity} iconBg="bg-destructive/15 text-destructive" title="Emotional & Prosody">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Panic Level</span>
                    <Badge className={cn("text-xs font-bold uppercase", getPanicBadgeClass(ea.panicLevel))}>{ea.panicLevel}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Distress Score</span>
                      <span className={cn("font-bold tabular-nums", ea.distressScore > 70 ? "text-destructive" : "text-warning")}>{ea.distressScore}/100</span>
                    </div>
                    <Progress value={ea.distressScore} className={cn("h-2", ea.distressScore > 70 ? "[&_[data-slot=progress-indicator]]:bg-destructive" : "[&_[data-slot=progress-indicator]]:bg-warning")} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">AI Confidence</span>
                      <span className="font-bold tabular-nums text-secondary">{ea.aiConfidence}%</span>
                    </div>
                    <Progress value={ea.aiConfidence} className="h-1.5 [&_[data-slot=progress-indicator]]:bg-secondary" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { icon: Activity, label: ea.speechRate,                           color: "text-primary" },
                      { icon: Waves,    label: ea.tremorDetected ? "Tremor" : "No tremor", color: ea.tremorDetected ? "text-warning" : "text-muted-foreground" },
                      { icon: Volume2,  label: ea.volumeTrend,                           color: ea.volumeTrend === "Escalating" ? "text-destructive" : ea.volumeTrend === "Declining" ? "text-secondary" : "text-muted-foreground" },
                    ].map(({ icon: Ic, label, color }, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5">
                        <Ic className={cn("size-3", color)} />
                        <span className="text-[10px]">{label}</span>
                      </div>
                    ))}
                  </div>
                  {ea.contradiction && (
                    <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      <p className="text-[10px] leading-relaxed">{ea.contradiction}</p>
                    </div>
                  )}
                </div>
              </PanelCard>

              {/* transcript — full width */}
              <div className="lg:col-span-2">
              <PanelCard icon={Mic} iconBg="bg-muted text-muted-foreground" title="Call Transcript">
                <div className="max-h-72 overflow-y-auto space-y-2.5">
                  {report.transcript.map((line, i) => {
                    const isCaller = line.speaker.toLowerCase() === "caller"
                    const isOp     = line.speaker.toLowerCase() === "operator"
                    return (
                      <div key={i} className={cn("flex flex-col gap-0.5", isOp && "items-end")}>
                        <span className="text-[9px] font-mono text-muted-foreground">[{line.speaker.toUpperCase()}] {line.time}</span>
                        <div className={cn("max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                          isCaller && "rounded-tl-sm bg-muted/70",
                          isOp     && "rounded-tr-sm bg-primary text-primary-foreground",
                          !isCaller && !isOp && "bg-muted/50 italic"
                        )}>{line.text}</div>
                      </div>
                    )
                  })}
                </div>
              </PanelCard>
              </div>

              </div>
            </TabsContent>

            {/* ── Dispatch Report ── */}
            <TabsContent value="dispatch" className="mt-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              <PanelCard icon={Ambulance} iconBg="bg-secondary/15 text-secondary" title="Dispatch Details">
                <div className="space-y-3">
                  <div className={cn("rounded-lg border-l-4 px-3 py-2.5", isApproved ? "border-secondary bg-secondary/5" : "border-destructive bg-destructive/5")}>
                    <p className="text-xs font-bold">{report.operatorVerdict}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{report.notes}</p>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Metric icon={Zap}   label="AI Conf."   value={`${Math.round(report.dispatchConfindece * 100)}%`} color={report.dispatchConfindece >= 0.8 ? "text-secondary" : "text-warning"} />
                    <Metric icon={Timer} label="Dispatched" value={fmtTime(report.dispatchedAt)} />
                    <Metric icon={Clock} label="On Scene"   value={fmtTime(report.arrivedAt)} />
                  </div>
                </div>
              </PanelCard>

              <PanelCard icon={UserCheck} iconBg="bg-warning/15 text-warning" title="Human Intervention">
                {report.humanIntervention?.required ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5">
                      <div className="flex size-8 items-center justify-center rounded-full bg-warning/20 shrink-0">
                        <User className="size-4 text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold">{report.humanIntervention.interventionBy}</p>
                        <p className="text-[10px] text-muted-foreground">{report.humanIntervention.role}</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">{report.humanIntervention.timestampLabel}</Badge>
                    </div>
                    <div>
                      <SecLabel>Action Taken</SecLabel>
                      <p className="text-xs leading-relaxed">{report.humanIntervention.action}</p>
                    </div>
                    <div>
                      <SecLabel>Reason for Override</SecLabel>
                      <p className="text-xs leading-relaxed text-muted-foreground">{report.humanIntervention.reason}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-lg border bg-secondary/10 px-3 py-3">
                    <CheckCircle2 className="size-4 text-secondary shrink-0" />
                    <p className="text-xs font-medium text-secondary">Fully AI-handled — no human intervention required.</p>
                  </div>
                )}
              </PanelCard>

              </div>
            </TabsContent>

            {/* ── SOP Actions ── */}
            <TabsContent value="sop" className="mt-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              <PanelCard icon={Brain} iconBg="bg-primary/15 text-primary" title="AI Triage Reasoning">
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed">{report.reasoningReport.content}</p>
                  {report.reasoningReport.sopUsed.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border bg-primary/5 px-2.5 py-1.5">
                      <FileText className="size-3 shrink-0 text-primary" />
                      <span className="font-mono text-[10px] text-primary">{s}</span>
                    </div>
                  ))}
                </div>
              </PanelCard>

              <PanelCard icon={Shield} iconBg="bg-secondary/15 text-secondary" title="SOP Actions Executed">
                <ol className="space-y-3">
                  {report.sopActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary mt-0.5">{i + 1}</span>
                      <span className="text-xs leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ol>
              </PanelCard>

              </div>
            </TabsContent>

            {/* ── Event Timeline ── */}
            <TabsContent value="timeline" className="mt-4">
              <PanelCard icon={CalendarClock} iconBg="bg-muted text-muted-foreground" title="Full Event Timeline">
                <div className="relative space-y-2 pl-5">
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                  {report.eventTimeline.map((evt, i) => (
                    <div key={i} className="relative flex items-start gap-3">
                      <div className={cn("absolute -left-[7px] mt-[5px] size-2.5 rounded-full ring-2 ring-background", dot(evt.type))} />
                      <div className={cn("flex-1 rounded-lg border px-3 py-2 text-xs", row(evt.type))}>
                        <span className="font-mono text-[10px] opacity-60">{evt.time}</span>
                        <span className="mx-1.5 opacity-30">·</span>
                        <span className="font-medium">{evt.event}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3 border-t border-border/40 pt-3">
                  {[
                    { type: "system",   label: "System",       d: "bg-border" },
                    { type: "ai",       label: "AI Action",    d: "bg-primary" },
                    { type: "human",    label: "Human Action", d: "bg-warning" },
                    { type: "dispatch", label: "Dispatch",     d: "bg-secondary" },
                    { type: "close",    label: "Case Closed",  d: "bg-muted-foreground" },
                  ].map(({ type, label, d }) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div className={cn("size-2 rounded-full", d)} />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </PanelCard>
            </TabsContent>

            {/* ── Closing Report ── */}
            <TabsContent value="closing-report" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Official sealed record — suitable for printing and archiving.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
                    <Printer className="size-3.5" />Print
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={handlePrint}>
                    <Download className="size-3.5" />Download PDF
                  </Button>
                </div>
              </div>
              <ClosingReport report={report} />
            </TabsContent>

          </Tabs>
        </div>
      </main>
    </div>
  )
}
