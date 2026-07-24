"use client"

import { useEffect, useMemo, useState } from "react"
import { Filter, Flame, Heart, Shield, Car, Droplets, Search, ShieldAlert, PanelLeftClose } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useIncident } from "@/context/incident/useIncident"
import { SeverityType } from "@/types"
import { timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { Incident } from "@/types"

/* ─── Severity colour maps ──────────────────────────────────────────────── */

const SEVERITY_BORDER: Record<string, string> = {
  [SeverityType.CRITICAL]: "border-gray hover:border-destructive hover:border-2",
  [SeverityType.URGENT]: "border-gray hover:border-warning hover:border-2",
  [SeverityType.MODERATE]: "border-gray hover:border-primary hover:border-2",
  [SeverityType.RESOLVED]: "border-gray hover:border-secondary hover:border-2",
}

const SEVERITY_BORDER_SELECTED: Record<string, string> = {
  [SeverityType.CRITICAL]: "border-destructive border-2",
  [SeverityType.URGENT]: "border-warning border-2",
  [SeverityType.MODERATE]: "border-primary border-2",
  [SeverityType.RESOLVED]: "border-secondary border-2",
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

const SEVERITY_SELECTED_BG: Record<string, string> = {
  [SeverityType.CRITICAL]: "bg-destructive/5",
  [SeverityType.URGENT]: "bg-warning/5",
  [SeverityType.MODERATE]: "bg-primary/5",
  [SeverityType.RESOLVED]: "bg-secondary/5",
}

const SEVERITY_SELECTED_SHADOW: Record<string, string> = {
  [SeverityType.CRITICAL]: "shadow-md shadow-destructive/25",
  [SeverityType.URGENT]: "shadow-md shadow-warning/25",
  [SeverityType.MODERATE]: "shadow-md shadow-primary/25",
  [SeverityType.RESOLVED]: "shadow-md shadow-secondary/25",
}

/* ─── Type icon maps ────────────────────────────────────────────────────── */

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

/* ─── Component ─────────────────────────────────────────────────────────── */

export function IncidentList({ collapsed, onCollapsedChange }: { collapsed: boolean; onCollapsedChange: (v: boolean) => void }) {
  const { incidents, selectedIncidentId, setSelectedIncidentId, fetchIncidents } = useIncident()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterSeverity, setFilterSeverity] = useState<SeverityType>(SeverityType.ALL)

  useEffect(() => {
    fetchIncidents()
  }, [])

  const activeIncidents = useMemo(
    () => incidents.filter((i) => i.severity !== SeverityType.RESOLVED),
    [incidents]
  )

  const results = useMemo(() => {
    return activeIncidents.filter((incident) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        incident.title.toLowerCase().includes(q) ||
        incident.id.toLowerCase().includes(q) ||
        incident.location.toLowerCase().includes(q)
      const matchesSeverity =
        filterSeverity === SeverityType.ALL || incident.severity === filterSeverity
      return matchesSearch && matchesSeverity
    })
  }, [searchQuery, filterSeverity, activeIncidents])

  return (
    <>
      {/* ── Mobile horizontal strip ── */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b bg-card/80 p-2 backdrop-blur-sm md:hidden">
        {results.map((incident) => (
          <button
            key={incident.id}
            type="button"
            onClick={() => setSelectedIncidentId(incident.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border-1 px-3 py-1.5 transition-all duration-150",
              selectedIncidentId === incident.id
                ? cn(SEVERITY_BORDER_SELECTED[incident.severity], SEVERITY_SELECTED_BG[incident.severity])
                : cn(SEVERITY_BORDER[incident.severity], "hover:brightness-110")
            )}
          >
            <span className={cn("rounded border px-1.5 py-0 text-[9px] font-bold uppercase tracking-widest", SEVERITY_BADGE[incident.severity])}>
              {incident.severity.slice(0, 3)}
            </span>
            <span className="font-mono text-xs">{incident.id}</span>
          </button>
        ))}
      </div>

      {/* ── Desktop sidebar ── */}
      {!collapsed && (
        <aside className="hidden w-[350px] min-h-0 flex-col border-r bg-card transition-all duration-300 md:flex">
          <>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <ShieldAlert className="size-3.5 text-destructive" />
                Active ({activeIncidents.length})
              </h2>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" className="text-muted-foreground">
                      <Filter className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={filterSeverity}
                      onValueChange={(v) => setFilterSeverity(v as SeverityType)}
                    >
                      <DropdownMenuRadioItem value={SeverityType.ALL}>All</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value={SeverityType.CRITICAL}>Critical</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value={SeverityType.URGENT}>Urgent</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value={SeverityType.MODERATE}>Moderate</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  onClick={() => onCollapsedChange(true)}
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative shrink-0 border-b px-3 py-2.5">
              <Search className="absolute left-6 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search code, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 border-muted bg-muted/30 pl-8 text-xs"
              />
            </div>

            {/* Incident cards */}
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-2">
                {results.map((incident) => {
                  const selected = selectedIncidentId === incident.id
                  const TypeIcon = TYPE_ICON[incident.type ?? "crime"] ?? Shield

                  return (
                    <button
                      key={incident.id}
                      type="button"
                      onClick={() => setSelectedIncidentId(incident.id)}
                      className={cn(
                        "w-full rounded-lg border-1 p-3 text-left transition-all duration-200",
                        selected
                          ? cn(
                            SEVERITY_BORDER_SELECTED[incident.severity],
                            SEVERITY_SELECTED_BG[incident.severity],
                            SEVERITY_SELECTED_SHADOW[incident.severity]
                          )
                          : cn(
                            SEVERITY_BORDER[incident.severity],
                            SEVERITY_BASE_SHADOW[incident.severity],
                            SEVERITY_HOVER_SHADOW[incident.severity]
                          )
                      )}
                    >
                      {/* Row 1: severity badge + time */}
                      <div className="mb-2 flex items-center  justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                            SEVERITY_BADGE[incident.severity]
                          )}
                        >
                          {incident.severity}
                        </span>
                        <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
                          {incident.id}
                        </p>
                      </div>

                      {/* Row 2: icon + title + location */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            TYPE_ICON_STYLE[incident.type ?? "crime"]
                          )}
                        >
                          <TypeIcon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold leading-snug">
                            {incident.title}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {incident.location}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </>
        </aside>
      )}

    </>
  )
}
