"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Ambulance,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  MapPin,
  Pencil,
  User,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useIncident } from "@/context/incident/useIncident"
import { useTime } from "@/context/time/useTime"
import { useMapPreview } from "../operations/map-panel"
import { cn } from "@/lib/utils"
import type { Incident } from "@/types"
import { SeverityType } from "@/types"
import { DispatchLocationPanel } from "./dispatch-location-panel"
import { useGooglePlacesAutocomplete } from "@/hooks/useGooglePlacesAutocomplete"
import type { PlaceDetails, Suggestion } from "@/hooks/useGooglePlacesAutocomplete"
import {
  LOCATION_OPTIONS,
  RESPONDER_UNITS,
  PANIC_LEVELS,
  REJECT_REASON_PRESETS,
  findLocationOption,
  formatCallDuration,
} from "./dispatch-constants"

function MetricBar({ label, value, tone }: { label: string; value: number; tone?: "destructive" | "default" }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}>
          {value}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${tone === "destructive" ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

interface DispatchModalProps {
  incident: Incident
}

interface OverrideForm {
  title: string
  locationLabel: string
  caller: string
  severity: Incident["severity"]
  panicLevel: string
  responderNames: string[]
  reason: string
}

function severityClassName(severity: Incident["severity"]) {
  switch (severity) {
    case SeverityType.CRITICAL:
      return "bg-destructive text-white"
    case SeverityType.URGENT:
      return "bg-warning text-white"
    case SeverityType.MODERATE:
      return "bg-primary text-white"
    default:
      return ""
  }
}

export function DispatchModal({ incident }: DispatchModalProps) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState("")
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({
    title: "",
    locationLabel: "",
    caller: "",
    severity: SeverityType.MODERATE,
    panicLevel: "Moderate",
    responderNames: [],
    reason: "",
  })
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [placeCoordinates, setPlaceCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const { setIncidents } = useIncident()
  const { currentTimeText } = useTime()
  const { setPreviewCoords } = useMapPreview()

  const { suggestions, fetchSuggestions, selectSuggestion, clearSuggestions } = useGooglePlacesAutocomplete({
    onPlaceSelected: (place: PlaceDetails) => {
      setOverrideForm((prev) => ({ ...prev, locationLabel: place.formattedAddress || place.name }))
      setPlaceCoordinates(place.geometry ?? null)
      setPreviewCoords(place.geometry ?? null)
      setSuggestionOpen(false)
    },
  })

  const isPending = incident.status?.dispatch !== "DISPATCHED"
  const pendingCount = isPending ? 1 : 0

  const previewIncident = useMemo(() => {
    if (!overrideOpen) return incident
    const locLabel = overrideForm.locationLabel
    if (!locLabel || locLabel === incident.location) return incident
    const matchedLoc = findLocationOption(locLabel)
    return {
      ...incident,
      location: matchedLoc ? matchedLoc.formatted : locLabel,
      coordinates: matchedLoc
        ? { lat: matchedLoc.lat, lng: matchedLoc.lng }
        : placeCoordinates ?? incident.coordinates,
    }
  }, [overrideOpen, overrideForm.locationLabel, placeCoordinates, incident])

  function buildOverrideForm(): OverrideForm {
    const matchedLocation = LOCATION_OPTIONS.find(
      (opt) => opt.label === incident.location || incident.location.includes(opt.label)
    )
    return {
      title: incident.title,
      locationLabel: matchedLocation?.label ?? "",
      caller: incident.caller,
      severity: incident.severity,
      panicLevel: incident.panicLevel,
      responderNames: incident.responder.name.split(", ").filter(Boolean),
      reason: "",
    }
  }

  function openOverrideDialog() {
    setOverrideForm(buildOverrideForm())
    setOverrideOpen(true)
  }

  function updateOverrideField<K extends keyof OverrideForm>(key: K, value: OverrideForm[K]) {
    setOverrideForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleResponder(unit: string) {
    setOverrideForm((prev) => {
      const names = prev.responderNames.includes(unit)
        ? prev.responderNames.filter((n) => n !== unit)
        : [...prev.responderNames, unit]
      return { ...prev, responderNames: names }
    })
  }

  async function handleApprove() {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/dispatch/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ incident_id: incident.id, note }),
        }
      )
    } catch {
      // Fall back to local state if API unavailable
    }

    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incident.id
          ? {
              ...inc,
              status: { ...inc.status, dispatch: "DISPATCHED" },
              responder: { ...inc.responder, status: "DISPATCHED" },
              timeline: [
                ...inc.timeline,
                {
                  time: currentTimeText,
                  event: `Unit [${inc.responder.name}] dispatched.${note ? ` Note: ${note}` : ""}`,
                },
              ],
            }
          : inc
      )
    )

    toast.success(`✓ ${incident.responder.name} dispatched to ${incident.location}`)
    setExpanded(false)
    setNote("")
  }

  function handleReject() {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incident.id
          ? {
              ...inc,
              status: { ...inc.status, dispatch: "REJECTED" },
              timeline: [
                ...inc.timeline,
                {
                  time: currentTimeText,
                  event: `Dispatch request REJECTED. Reason: ${rejectReason}`,
                },
              ],
            }
          : inc
      )
    )
    toast.warning(`Dispatch request rejected for ${incident.case_number}`)
    setRejectOpen(false)
    setRejectReason("")
    setExpanded(false)
  }

  function handleOverride() {
    const changes: string[] = []

    if (overrideForm.title !== incident.title)
      changes.push(`title → "${overrideForm.title}"`)

    const matchedLoc = findLocationOption(overrideForm.locationLabel)
    if (overrideForm.locationLabel !== incident.location && matchedLoc)
      changes.push(`location → "${overrideForm.locationLabel}"`)

    if (overrideForm.caller !== incident.caller)
      changes.push(`caller → "${overrideForm.caller}"`)

    if (overrideForm.severity !== incident.severity)
      changes.push(`severity → ${overrideForm.severity}`)

    if (overrideForm.panicLevel !== incident.panicLevel)
      changes.push(`panic → ${overrideForm.panicLevel}`)

    const responderJoined = overrideForm.responderNames.join(", ")
    if (responderJoined !== incident.responder.name)
      changes.push(`responder → "${responderJoined}"`)

    if (changes.length === 0) {
      setOverrideOpen(false)
      return
    }

    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incident.id
          ? {
              ...inc,
              title: overrideForm.title || inc.title,
              location: matchedLoc ? matchedLoc.formatted : overrideForm.locationLabel || inc.location,
              caller: overrideForm.caller || inc.caller,
              severity: overrideForm.severity,
              panicLevel: overrideForm.panicLevel,
              responder: {
                ...inc.responder,
                name: responderJoined || inc.responder.name,
              },
              coordinates: matchedLoc
                ? { lat: matchedLoc.lat, lng: matchedLoc.lng }
                : placeCoordinates ?? inc.coordinates,
              timeline: [
                ...inc.timeline,
                {
                  time: currentTimeText,
                  event: `Dispatcher override: ${changes.join("; ")}`,
                },
              ],
            }
          : inc
      )
    )

    toast.info(`Override applied — ${changes.length} field(s) updated`)
    setOverrideOpen(false)
    setPreviewCoords(null)
  }

  if (!isPending && !expanded) return null

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="absolute bottom-12 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-destructive/40 bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur-sm transition-transform hover:scale-[1.02]"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-destructive" />
        </span>
        <span className="text-sm font-semibold">
          Dispatch Request Pending
        </span>
        <ChevronUp className="size-4" />
      </button>
    )
  }

  return (
    <>
      <Card className="absolute bottom-6 left-1/2 z-20 max-h-[78%] w-[96%] max-w-3xl -translate-x-1/2 overflow-hidden rounded-t-xl border shadow-2xl">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b bg-destructive/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-lg">🚨</span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold uppercase">
                  Dispatch Request — {incident.case_number}
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  {incident.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge className={`uppercase ${severityClassName(incident.severity)}`}>
                {incident.severity}
              </Badge>
              <Badge variant="outline" className="font-mono">
                P{incident.priority}
              </Badge>
              <Button variant="ghost" size="icon-xs" onClick={() => setExpanded(false)}>
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[58vh] space-y-4 overflow-y-auto p-4 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <section className="space-y-3 rounded-lg border bg-muted/15 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <AlertTriangle className="size-3.5" />
                  Incident Summary
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-right font-medium capitalize">
                      {incident.type ?? "unknown"} — {incident.title}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Reported at</span>
                    <span className="font-mono">{incident.occurDateTime}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Call duration</span>
                    <span className="font-mono">{formatCallDuration(incident.duration)}</span>
                  </div>
                  <p className="rounded-md bg-background/80 p-2 text-[11px] leading-relaxed text-muted-foreground">
                    {incident.reason}
                  </p>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border bg-muted/15 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Brain className="size-3.5" />
                  Caller Intel
                </p>
                <div className="space-y-2">
                  <div className="rounded-md bg-background/80 px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-semibold">{incident.caller}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {incident.lang}
                      </Badge>
                    </div>
                    {(incident.callerAge || incident.callerGender) && (
                      <div className="ml-5.5 mt-0.5 text-[11px] text-muted-foreground">
                        {incident.callerAge && <span>{incident.callerAge} yrs</span>}
                        {incident.callerAge && incident.callerGender && <span> · </span>}
                        {incident.callerGender && <span>{incident.callerGender}</span>}
                      </div>
                    )}
                  </div>
                  <MetricBar
                    label="Distress Score"
                    value={incident.distressScore}
                    tone="destructive"
                  />
                  <MetricBar label="AI Confidence" value={incident.confidence} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Panic level</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        incident.panicLevel === "Extreme"
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : incident.panicLevel === "High"
                            ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                            : incident.panicLevel === "Moderate"
                              ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                              : incident.panicLevel === "Low"
                                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                : "bg-green-500/15 text-green-600 dark:text-green-400"
                      }`}
                    >
                      {incident.panicLevel}
                    </span>
                  </div>
                  {incident.contradiction && (
                    <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning">
                      ⚠ {incident.contradiction}
                    </p>
                  )}
                </div>
              </section>
            </div>

            <DispatchLocationPanel incident={previewIncident} />

            <Separator />

            <section className="space-y-2 rounded-lg border bg-muted/15 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Ambulance className="size-3.5 text-secondary" />
                Assigned Responder
              </p>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {incident.responder.name.split(", ").filter(Boolean).map((unit) => (
                    <span
                      key={unit}
                      className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary"
                    >
                      <Ambulance className="size-4" />
                      {unit}
                      <CheckCircle2 className="size-4 text-secondary" />
                    </span>
                  ))}
                </div>
                <Badge variant="secondary">{incident.responder.status}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Type</span>
                <span className="font-medium">{incident.responder.type}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="border rounded-md bg-background/80 p-2">
                  <p className="text-muted-foreground">Distance</p>
                  <p className="font-mono font-semibold text-[15px]">{incident.responder.distance}</p>
                </div>
                <div className="border rounded-md bg-background/80 p-2">
                  <p className="text-muted-foreground">ETA</p>
                  <p className="flex items-center justify-center gap-1 font-mono font-semibold text-[15px]">
                    <Clock className="size-3" />
                    {incident.responder.eta}
                  </p>
                </div>
                <div className="border rounded-md bg-background/80 p-2">
                  <p className="text-muted-foreground">Lead</p>
                  <p className="font-semibold text-[15px]">
                    {incident.responder.paramedic ?? "—"}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <Label
                htmlFor="dispatcher-note"
                className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                Dispatcher Note (optional)
              </Label>
              <Input
                id="dispatcher-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add dispatch note before approval..."
                className="mt-2"
              />
            </section>

            <div className="sticky -bottom-5 bg-white dark:bg-card pb-5 lg:pb-1 flex flex-col gap-1 pt-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1 border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive dark:text-white dark:bg-destructive dark:hover:bg-red-800"
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="mr-2 size-4" />
                Reject Request
              </Button>

              <Button
                variant="outline"
                className="flex-1 border-amber-400/60 bg-amber-300/20 text-amber-900 hover:border-amber-400 hover:bg-amber-300/40 dark:bg-amber-400 dark:text-white dark:hover:bg-amber-600"
                onClick={openOverrideDialog}
              >
                <Pencil className="mr-2 size-4" />
                Override Request
              </Button>

              <Button
                variant="outline"
                className="flex-1 border-secondary bg-secondary text-black hover:border-secondary hover:bg-secondary/80 dark:text-white dark:hover:bg-emerald-600 dark:bg-secondary"
                onClick={() => setApproveConfirmOpen(true)}
              >
                <CheckCircle2 className="mr-2 size-4" />
                Approve & Dispatch
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Dispatch Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting the dispatch request for{" "}
              {incident.case_number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reject-reason-select">Rejection reason</Label>
              <select
                id="reject-reason-select"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Select a reason...</option>
                {REJECT_REASON_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reject-reason-text" className="flex items-center gap-1.5">
                <GripVertical className="size-3 text-muted-foreground" />
                Additional details
              </Label>
              <textarea
                id="reject-reason-text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Add optional details..."
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideOpen} onOpenChange={(open) => {
        setOverrideOpen(open)
        if (!open) setPreviewCoords(null)
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Override Request Details</DialogTitle>
            <DialogDescription>
              Correct AI-extracted details before dispatching {incident.case_number}. All
              changes are logged in the incident timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="override-title">Incident title</Label>
              <Input
                id="override-title"
                value={overrideForm.title}
                onChange={(e) => updateOverrideField("title", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="override-location">Location</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="override-location"
                  placeholder="Search for a location..."
                  value={overrideForm.locationLabel}
                  onChange={(e) => {
                    updateOverrideField("locationLabel", e.target.value)
                    setPlaceCoordinates(null)
                    const matchedLoc = findLocationOption(e.target.value)
                    setPreviewCoords(matchedLoc ? { lat: matchedLoc.lat, lng: matchedLoc.lng } : null)
                    fetchSuggestions(e.target.value)
                    setSuggestionOpen(true)
                  }}
                  onFocus={() => {
                    if (overrideForm.locationLabel.length >= 2) {
                      fetchSuggestions(overrideForm.locationLabel)
                      setSuggestionOpen(true)
                    }
                  }}
                  onBlur={() => setTimeout(() => setSuggestionOpen(false), 150)}
                  className="pl-9"
                />
                {suggestionOpen && suggestions.length > 0 && (
                  <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                    {suggestions.map((s) => (
                      <li key={s.placeId}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            selectSuggestion(s)
                          }}
                        >
                          <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{s.mainText}</span>
                            {s.secondaryText && (
                              <span className="block truncate text-xs text-muted-foreground">{s.secondaryText}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {overrideForm.locationLabel && (
                <p className="text-[11px] text-muted-foreground">
                  {findLocationOption(overrideForm.locationLabel)?.formatted
                    ?? (placeCoordinates
                      ? `${placeCoordinates.lat.toFixed(5)}°N, ${placeCoordinates.lng.toFixed(5)}°E`
                      : null)}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="override-caller">Caller name</Label>
              <Input
                id="override-caller"
                value={overrideForm.caller}
                onChange={(e) => updateOverrideField("caller", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="override-severity">Severity</Label>
                <select
                  id="override-severity"
                  value={overrideForm.severity}
                  onChange={(e) =>
                    updateOverrideField(
                      "severity",
                      e.target.value as Incident["severity"]
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value={SeverityType.CRITICAL}>Critical</option>
                  <option value={SeverityType.URGENT}>Urgent</option>
                  <option value={SeverityType.MODERATE}>Moderate</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="override-panic">Panic level</Label>
                <select
                  id="override-panic"
                  value={overrideForm.panicLevel}
                  onChange={(e) => updateOverrideField("panicLevel", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {PANIC_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Responder unit(s)</Label>
              <div className="space-y-1 rounded-md border p-2">
                {RESPONDER_UNITS.map((unit) => {
                  const isSelected = overrideForm.responderNames.includes(unit)
                  return (
                    <label
                      key={unit}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-muted/50"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        onClick={() => toggleResponder(unit)}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150",
                          isSelected
                            ? "border-secondary bg-secondary text-white"
                            : "border-muted-foreground/30 bg-transparent text-transparent"
                        )}
                      >
                        {isSelected && <Check className="size-4 stroke-[3]" />}
                      </button>
                      <span className={cn(isSelected && "font-medium")}>{unit}</span>
                    </label>
                  )
                })}
              </div>
              {overrideForm.responderNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {overrideForm.responderNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary"
                    >
                      <Ambulance className="size-4" />
                      {name}
                      <button
                        type="button"
                        onClick={() => toggleResponder(name)}
                        className="ml-0.5 rounded-full p-0.5 text-secondary/60 hover:bg-destructive/20 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="override-reason">Override reason (required)</Label>
              <textarea
                id="override-reason"
                value={overrideForm.reason}
                onChange={(e) => updateOverrideField("reason", e.target.value)}
                placeholder="e.g. Caller corrected address; AI misheard location..."
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOverride}
              disabled={!overrideForm.reason.trim()}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dispatch</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve and dispatch{" "}
              <span className="font-bold text-black dark:text-white">
                {incident.responder.name}
              </span>
              {" "}to{" "}
              <span className="font-bold text-black dark:text-white">
                {incident.location}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Incident</span>
              <span className="font-medium">{incident.case_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Responder</span>
              <span className="text-right font-medium">{incident.responder.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="text-right font-medium">{incident.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Severity</span>
              <span className="font-medium uppercase">{incident.severity}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setApproveConfirmOpen(false)
                handleApprove()
              }}
              className="bg-secondary text-black hover:bg-secondary/80"
            >
              <CheckCircle2 className="mr-2 size-4" />
              Confirm Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
