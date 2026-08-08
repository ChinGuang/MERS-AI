"use client"

import { useEffect, useRef, useState } from "react"
import {
  BookText,
  ChevronDown,
  ChevronUp,
  Languages,
  Mic,
  MicOff,
  PhoneCall,
  Settings2,
  ShieldCheck,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useIncident } from "@/context/incident/useIncident"
import { useCallDuration } from "@/hooks/useCallDuration"
import { cn } from "@/lib/utils"

// ── Constants ───────────────────────────────────────────────────────────────
const VOICE_OPTIONS = [
  { id: "11labs-Adrian", label: "Adrian", desc: "Male · EN" },
  { id: "11labs-Aria", label: "Aria", desc: "Female · EN" },
  { id: "11labs-Sarah", label: "Sarah", desc: "Female · EN" },
  { id: "11labs-Charlie", label: "Charlie", desc: "Male · EN" },
  { id: "openai-Alloy", label: "Alloy", desc: "Neutral · EN" },
  { id: "openai-Nova", label: "Nova", desc: "Female · EN" },
  { id: "deepgram-Asteria", label: "Asteria", desc: "Female · EN" },
]

const LANGUAGE_OPTIONS = [
  { id: "en-US", label: "English (US)" },
  { id: "ms", label: "Bahasa Melayu" },
  { id: "zh-CN", label: "Chinese (Mandarin)" },
  { id: "ta", label: "Tamil" },
]

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ""

// ── Aura orb — lives in the header, replaces the status pill ───────────────
function AuraOrb({ active }: { active: boolean }) {
  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: 40, height: 40 }}>
      {/* Ripple ring — only when active */}
      {active && (
        <div className="absolute inset-0 rounded-full bg-secondary/20 animate-aura-ring" />
      )}
      {/* Core */}
      <div
        className={cn(
          "relative z-10 flex items-center justify-center rounded-full border transition-all duration-700",
          active
            ? "animate-aura-active bg-secondary/15 border-secondary/40 shadow-[0_0_16px_4px_rgba(34,182,123,0.35)]"
            : "bg-muted/30 border-border/60"
        )}
        style={{ width: 34, height: 34 }}
      >
        {active
          ? <Mic className="size-3.5 text-secondary drop-shadow-[0_0_4px_rgba(34,182,123,0.8)]" />
          : <MicOff className="size-3.5 text-muted-foreground/35" />
        }
      </div>
    </div>
  )
}

// ── Agent settings panel ────────────────────────────────────────────────────
interface AgentSettings {
  agent_name: string
  voice_id: string
  language: string
}

function AgentSettingsPanel() {
  const [settings, setSettings] = useState<AgentSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${BACKEND_URL}/retell/agent`)
      .then(r => r.ok ? r.json() : null)
      .then((d: AgentSettings | null) => { if (d) setSettings(d) })
      .catch(() => { })
  }, [])

  async function patch(field: keyof AgentSettings, value: string) {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
    setSaving(true)
    try {
      await fetch(`${BACKEND_URL}/retell/agent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Agent</span>
        <span className="text-[11px] font-semibold text-foreground">{settings?.agent_name ?? "ARIA"}</span>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Voice</p>
        <select
          value={settings?.voice_id ?? ""}
          onChange={e => patch("voice_id", e.target.value)}
          disabled={!settings || saving}
          className="h-8 w-full rounded-md border border-border/60 bg-background/60 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-secondary disabled:opacity-50"
        >
          <option value="" disabled>Select voice…</option>
          {VOICE_OPTIONS.map(v => (
            <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Languages className="size-3" /> Language
        </p>
        <select
          value={settings?.language ?? ""}
          onChange={e => patch("language", e.target.value)}
          disabled={!settings || saving}
          className="h-8 w-full rounded-md border border-border/60 bg-background/60 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-secondary disabled:opacity-50"
        >
          <option value="" disabled>Select language…</option>
          {LANGUAGE_OPTIONS.map(l => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      {saving && (
        <p className="text-[10px] text-secondary/70 animate-pulse">Saving…</p>
      )}
    </div>
  )
}

// ── Live transcript — THE main content ──────────────────────────────────────
function LiveTranscript({ incident }: { incident: ReturnType<typeof useIncident>["activeIncident"] }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const lines = incident?.transcript ?? []
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines])

  return (
    <>
      {/* Sub-header */}
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="size-3 text-secondary" />
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Live Transcript
          </h3>
        </div>
        {lines.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {lines.length} lines
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div className="space-y-3 pb-2">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-muted-foreground/25 bg-muted/20">
                <Mic className="size-4 text-muted-foreground/35" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">No transcript yet</p>
                <p className="text-[10px] text-muted-foreground/50">
                  Transcript appears here once a call is connected.
                </p>
              </div>
            </div>
          ) : (
            lines.map((line, i) => {
              const speaker = line.speaker.toLowerCase()
              const isCaller = speaker === "user" || speaker === "[user]"
              const isNew = i === lines.length - 1

              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-1 transition-all duration-300",
                    !isCaller && "items-end",
                    isNew && "animate-in fade-in-0 slide-in-from-bottom-2"
                  )}
                >
                  <span className="text-[11px] font-mono text-black/80 dark:text-white/80">
                    [{line.speaker.toUpperCase()}]
                    {line.time && <span className="ml-1 opacity-60">{line.time}</span>}
                  </span>
                  <div
                    className={cn(
                      "relative max-w-[88%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed mb-2",
                      isCaller
                        ? "rounded-tl-sm bg-muted/70 text-foreground"
                        : "rounded-tr-sm bg-secondary text-secondary-foreground shadow-[0_2px_12px_rgba(34,182,123,0.25)]",
                      line.highlight && "ring-2 ring-warning ring-offset-1"
                    )}
                  >
                    {line.text}
                    {/* Original was non-English - show the English translation underneath,
                        since the app's default working language is English. */}
                    {line.translatedText && line.language && line.language !== "en" && (
                      <div
                        className={cn(
                          "mt-1.5 flex items-start gap-1 border-t pt-1.5 text-[13px] italic opacity-80",
                          isCaller ? "border-foreground/15" : "border-secondary-foreground/25"
                        )}
                      >
                        <Languages className="mt-0.5 size-3 shrink-0" />
                        <span>{line.translatedText}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Typing indicator when call is active */}
          {lines.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-mono text-muted-foreground/50">[ARIA] live</span>
              <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tr-sm bg-secondary/20 px-3 py-2">
                <span className="size-1.5 animate-bounce rounded-full bg-secondary [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-secondary [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-secondary [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </>
  )
}

// ── Retrieved SOP — sibling tab to Live Transcript ─────────────────────────
function SopPanel({ incident }: { incident: ReturnType<typeof useIncident>["activeIncident"] }) {
  const citation = incident?.sopCitation
  const steps = incident?.sopProcedure ?? []

  return (
    <>
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-3 text-secondary" />
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Retrieved SOP
          </h3>
        </div>
        {steps.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {steps.length} steps
          </span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1 pr-2">
        {!citation && steps.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-muted-foreground/25 bg-muted/20">
              <BookText className="size-4 text-muted-foreground/35" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">No SOP retrieved yet</p>
              <p className="text-[10px] text-muted-foreground/50">
                Matched procedures appear here once the emergency type is identified.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {citation && (
              <div className="rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-secondary/80">
                  Citation
                </p>
                <p className="text-[13px] font-medium text-foreground">{citation}</p>
              </div>
            )}
            {steps.length > 0 && (
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 rounded-xl bg-muted/50 px-3 py-2 text-[13px] leading-relaxed text-foreground"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-[11px] font-semibold text-secondary">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </ScrollArea>
    </>
  )
}

// ── Root component ──────────────────────────────────────────────────────────
export function LiveIntelligence() {
  const { activeIncident, setSSEEnabled } = useIncident()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"transcript" | "sop">("transcript")
  const hasLiveCall = (activeIncident?.transcript?.length ?? 0) > 0
  const callDuration = useCallDuration(activeIncident?.callStartedAt)

  // Lives here, not inside the Live Transcript sub-tab - the incident-creation SSE
  // stream shares this same enabled flag (see IncidentProvider.tsx), and it must stay
  // on for as long as this whole panel is mounted regardless of which sub-tab
  // (transcript vs SOP) is selected. Tying it to the transcript sub-tab's mount/unmount
  // meant switching to "Retrieved SOP" silently disabled new-incident notifications too
  // - SSE doesn't replay missed events, so a case created while on that tab never
  // appeared even after switching back.
  useEffect(() => {
    setSSEEnabled(true)
    return () => {
      setSSEEnabled(false)
    }
  }, [])

  return (
    <aside className="hidden min-h-0 flex-col border-l bg-card lg:flex">

      {/* ① Header — aura orb replaces the ACTIVE pill */}
      <div className="flex shrink-0 items-center gap-2.5 border-b px-4 py-3">
        {/* <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/40">
          <Mic className="size-4 text-muted-foreground" />
        </div> */}

        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest">Voice Assistant</h2>
          <p className="text-[10px] text-muted-foreground">ARIA · Emergency Response</p>
        </div>

        {/* Aura orb IS the status indicator */}
        <AuraOrb active={hasLiveCall} />
      </div>

      {/* ④ Agent settings — collapsible, fixed toggle ~36px + optional panel */}
      <div className="shrink-0 border-b">
        <button
          onClick={() => setSettingsOpen(v => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/15"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="size-3.5 text-muted-foreground/70" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Agent Settings
            </span>
          </div>
          {settingsOpen
            ? <ChevronUp className="size-3 text-muted-foreground/60" />
            : <ChevronDown className="size-3 text-muted-foreground/60" />
          }
        </button>
        {settingsOpen && (
          <div className="border-t bg-muted/10 px-4 py-3">
            <AgentSettingsPanel />
          </div>
        )}
      </div>

      {/* ③ Caller banner — conditional, fixed ~44px */}
      {hasLiveCall && activeIncident && (
        <div className="shrink-0 border-b bg-secondary/5 px-4 py-2">
          <div className="flex items-center gap-2">
            <PhoneCall className="size-3.5 shrink-0 text-secondary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-foreground">
                {activeIncident.caller}
              </p>
              <p className="text-[9px] text-muted-foreground">
                {activeIncident.location} · {callDuration}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab switcher — Live Transcript / Retrieved SOP */}
      <div className="flex shrink-0 border-b">
        <button
          onClick={() => setActiveTab("transcript")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors",
            activeTab === "transcript"
              ? "border-secondary text-foreground"
              : "border-transparent text-muted-foreground/60 hover:text-muted-foreground"
          )}
        >
          <Mic className="size-3" />
          Live Transcript
        </button>
        <button
          onClick={() => setActiveTab("sop")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors",
            activeTab === "sop"
              ? "border-secondary text-foreground"
              : "border-transparent text-muted-foreground/60 hover:text-muted-foreground"
          )}
        >
          <ShieldCheck className="size-3" />
          Retrieved SOP
        </button>
      </div>

      {/* ⑤ MAIN CONTENT — flex-1, takes ALL remaining space */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        {activeTab === "transcript" ? (
          <LiveTranscript incident={activeIncident} />
        ) : (
          <SopPanel incident={activeIncident} />
        )}
      </div>

    </aside>
  )
}
