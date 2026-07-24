"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search, CheckCircle2, XCircle, UserCheck,
  AlertTriangle, ChevronRight, MapPin, Flame, Heart, Shield, Car, Droplets,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu, DropdownMenuCheckboxItem,
  DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HISTORICAL_REPORTS } from "@/data/historicalReports"
import { cn } from "@/lib/utils"
import { SeverityType as ReportSeverityType, IncidentType, OutcomeType } from "@/models/report"
import { useAuth } from "@/context/auth/useAuth"

const PAGE_SIZE = 10

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "border-destructive/60 bg-destructive/10 text-destructive",
  URGENT:   "border-warning/60   bg-warning/10   text-warning",
  MODERATE: "border-primary/60   bg-primary/10   text-primary",
}

const TYPE_ICON: Record<string, React.ElementType> = {
  [IncidentType.MEDICAL]:  Heart,
  [IncidentType.FIRE]:     Flame,
  [IncidentType.CRIME]:    Shield,
  [IncidentType.ACCIDENT]: Car,
  [IncidentType.FLOOD]:    Droplets,
  [IncidentType.UNKNOWN]:  AlertTriangle,
}

const TYPE_ICON_STYLE: Record<string, string> = {
  [IncidentType.MEDICAL]:  "bg-destructive/20 text-destructive",
  [IncidentType.FIRE]:     "bg-warning/20     text-warning",
  [IncidentType.CRIME]:    "bg-muted          text-muted-foreground",
  [IncidentType.ACCIDENT]: "bg-primary/20     text-primary",
  [IncidentType.FLOOD]:    "bg-primary/15     text-primary",
  [IncidentType.UNKNOWN]:  "bg-muted          text-muted-foreground",
}

export function HistoryTab() {
  const router = useRouter()
  const { user } = useAuth()
  const operatorName = user?.user_metadata?.full_name || user?.email || "OP. Khalid"

  const [search, setSearch]                 = useState("")
  const [severityFilter, setSeverityFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter]         = useState("")
  const [page, setPage]                     = useState(0)

  const filtered = useMemo(() => {
    return HISTORICAL_REPORTS.filter((r) => {
      const q = search.toLowerCase()
      const matchSearch =
        r.title.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)    ||
        r.location.toLowerCase().includes(q) ||
        r.caller.toLowerCase().includes(q)
      const matchSeverity = severityFilter.length === 0 || severityFilter.includes(r.severity)
      const matchType     = !typeFilter || r.incidentType.toLowerCase().includes(typeFilter.toLowerCase())
      return matchSearch && matchSeverity && matchType
    })
  }, [search, severityFilter, typeFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID, title, location, caller…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {severityFilter.length > 0 ? `Severity (${severityFilter.length})` : "Severity"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.values(ReportSeverityType).map((sev) => (
                <DropdownMenuCheckboxItem
                  key={sev}
                  checked={severityFilter.includes(sev)}
                  onCheckedChange={() => {
                    setSeverityFilter(prev =>
                      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
                    )
                    setPage(0)
                  }}
                >
                  {sev}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Input
            placeholder="Filter type…"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(0) }}
            className="w-36"
          />
        </div>

        {/* table */}
        <div className="overflow-hidden rounded-xl border border-black transition-all duration-200 hover:shadow-secondary hover:shadow-md dark:border-neutral-700">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {["ID", "Incident", "Severity", "Caller", "Operator", "Duration", "Outcome", ""].map((h, i) => (
                  <TableHead key={i} className={cn("text-[10px] uppercase tracking-wider", i === 7 && "w-10")}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((report) => {
                const TypeIcon  = TYPE_ICON[report.incidentType] ?? AlertTriangle
                const iconStyle = TYPE_ICON_STYLE[report.incidentType] ?? "bg-muted text-muted-foreground"

                return (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => router.push(`/dashboard/history/${report.id}`)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{report.id}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", iconStyle)}>
                          <TypeIcon className="size-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold leading-tight">{report.title}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="size-2.5" />{report.location.split(",")[0]}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                        SEVERITY_BADGE[report.severity] ?? "border-muted bg-muted text-muted-foreground"
                      )}>
                        {report.severity}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs">{report.caller}</TableCell>
                    <TableCell className="text-xs font-medium">{operatorName}</TableCell>
                    <TableCell className="font-mono text-xs">{report.callDuration}</TableCell>

                    <TableCell>
                      {report.outcome === OutcomeType.ACCEPT && (
                        <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                          <CheckCircle2 className="mr-1 size-2.5 text-emerald-400" />
                          Accept
                        </Badge>
                      )}
                      {report.outcome === OutcomeType.OVERRIDE && (
                        <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold">
                          <UserCheck className="mr-1 size-2.5 text-amber-400" />
                          Override
                        </Badge>
                      )}
                      {report.outcome === OutcomeType.REJECT && (
                        <Badge className="bg-rose-600/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold">
                          <XCircle className="mr-1 size-2.5 text-rose-400" />
                          Reject
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )
              })}
              {pageData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No incidents match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(page * PAGE_SIZE + 1, filtered.length)}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} records
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
