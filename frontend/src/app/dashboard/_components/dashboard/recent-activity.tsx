"use client"

import { useMemo } from "react"
import { Flame, Heart, Shield, Car, Droplets, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useIncident } from "@/context/incident/useIncident"
import { timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { Incident } from "@/types"
import { SeverityType } from "@/types"

/* ─── Severity colour maps ─────────────────────────────────────────────── */

const SEVERITY_BORDER: Record<string, string> = {
  [SeverityType.CRITICAL]: "border-destructive/70",
  [SeverityType.URGENT]: "border-warning/70",
  [SeverityType.MODERATE]: "border-primary/70",
  [SeverityType.RESOLVED]: "border-secondary/70",
}

const SEVERITY_BADGE: Record<string, string> = {
  [SeverityType.CRITICAL]: "border-destructive/60 bg-destructive/10 text-destructive",
  [SeverityType.URGENT]: "border-warning/60 bg-warning/10 text-warning",
  [SeverityType.MODERATE]: "border-primary/60 bg-primary/10 text-primary",
  [SeverityType.RESOLVED]: "border-secondary/60 bg-secondary/10 text-secondary",
}

const SEVERITY_BASE_SHADOW: Record<string, string> = {
  [SeverityType.CRITICAL]: "shadow-sm shadow-destructive/15",
  [SeverityType.URGENT]: "shadow-sm shadow-warning/15",
  [SeverityType.MODERATE]: "shadow-sm shadow-primary/15",
  [SeverityType.RESOLVED]: "shadow-sm shadow-secondary/15",
}

const SEVERITY_HOVER_SHADOW: Record<string, string> = {
  [SeverityType.CRITICAL]: "hover:shadow-lg hover:shadow-destructive/30",
  [SeverityType.URGENT]: "hover:shadow-lg hover:shadow-warning/30",
  [SeverityType.MODERATE]: "hover:shadow-lg hover:shadow-primary/30",
  [SeverityType.RESOLVED]: "hover:shadow-lg hover:shadow-secondary/30",
}

/* ─── Incident type maps ────────────────────────────────────────────────── */

const TYPE_ICON: Record<NonNullable<Incident["type"]>, React.ElementType> = {
  medical: Heart,
  fire: Flame,
  crime: Shield,
  accident: Car,
  flood: Droplets,
}

const TYPE_ICON_STYLE: Record<NonNullable<Incident["type"]>, string> = {
  medical: "bg-destructive/20 text-destructive",
  fire: "bg-warning/20 text-warning",
  crime: "bg-muted text-muted-foreground",
  accident: "bg-primary/20 text-primary",
  flood: "bg-primary/15 text-primary",
}

/* ─── Dispatch status badge ─────────────────────────────────────────────── */

function dispatchStyle(status: string): string {
  const s = status.toUpperCase()
  if (s === "DISPATCHED" || s === "APPROVED") return "border-secondary/60 bg-secondary/10 text-secondary"
  if (s === "PENDING") return "border-warning/60 bg-warning/10 text-warning"
  if (s === "REJECTED") return "border-destructive/60 bg-destructive/10 text-destructive"
  return "border-border text-muted-foreground"
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function RecentActivity() {
  const { incidents } = useIncident()

  const events = useMemo(
    () =>
      [...incidents]
        .sort((a, b) => new Date(b.occurDateTime).getTime() - new Date(a.occurDateTime).getTime())
        .slice(0, 20),
    [incidents]
  )

  return (
    <Card className="h-full transition-all duration-200 hover:border-secondary hover:shadow-secondary hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Recent Activity
        </CardTitle>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[400px] pr-3">
          <div className="space-y-3">
            {events.map((incident) => {
              const TypeIcon = TYPE_ICON[incident?.type ?? "crime"] ?? Shield
              const dispatchStatus = incident?.status?.dispatch ?? "PENDING"

              return (
                <div
                  key={incident.id}
                  className={cn(
                    "group cursor-default rounded-lg border-2 p-4 transition-all duration-200",
                    SEVERITY_BORDER[incident.severity] ?? "border-border",
                    SEVERITY_BASE_SHADOW[incident.severity] ?? "shadow-sm",
                    SEVERITY_HOVER_SHADOW[incident.severity]
                  )}
                >
                  {/* ── Severity label ── */}
                  <div className="mb-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                        SEVERITY_BADGE[incident.severity] ?? "border-border text-muted-foreground"
                      )}
                    >
                      {incident.severity}
                    </span>
                  </div>

                  {/* ── Icon + title row ── */}
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                        TYPE_ICON_STYLE[incident.type ?? "crime"]
                      )}
                    >
                      <TypeIcon className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-snug">
                        {incident.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {incident.location}
                      </p>
                    </div>

                    <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                      {timeAgo(incident.occurDateTime)}
                    </span>
                  </div>

                  {/* ── Divider ── */}
                  <div className="my-3 border-t border-border/40" />

                  {/* ── Reference row (mirrors "SOP REFERENCE" in the design) ── */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Dispatch
                    </span>

                    <div className="flex items-center gap-2">
                      {/* <span
                        className={cn(
                          "rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          dispatchStyle(dispatchStatus)
                        )}
                      >
                        {dispatchStatus}
                      </span> */}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {incident.id}
                      </span>
                      <ExternalLink className="size-3 text-muted-foreground/50" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
