"use client"

import {
  CheckCircle2,
  XCircle,
  ThumbsUp,
  Timer,
  ClipboardList,
  UserCheck,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { OutcomeType, type ArchivedReport } from "@/models/report"
import { useMemo } from "react"

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  iconBg: string
  subtitle?: string
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, subtitle }: StatCardProps) {
  return (
    <Card className="cursor-default overflow-hidden transition-all duration-200 hover:scale-[1.03] hover:border-secondary hover:shadow-secondary hover:shadow-md">
      <CardContent className="px-4">
        <div className="flex justify-between">
          <div>
            <p className="text-3xl font-bold leading-none tabular-nums">{value}</p>
            <p className="mt-1.5 text-sm font-medium text-foreground/75">{label}</p>
          </div>
          <div className="mb-2 flex items-start justify-between">
            <div className={cn("flex size-12 items-center justify-center rounded-xl", iconBg)}>
              <Icon className={cn("size-6.5", iconColor)} />
            </div>
          </div>
        </div>

        {subtitle && (
          <div className="mt-2.5 flex items-center justify-center border-t border-white/18 pt-4">
            <span className="text-center text-sm font-medium text-muted-foreground">{subtitle}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-5 text-muted-foreground" />
      <h3 className="text-sm font-bold uppercase tracking-widest text-foreground sm:text-lg">{title}</h3>
      <span className="text-sm text-muted-foreground capitalize">— {subtitle}</span>
    </div>
  )
}

function formatResponseTime(seconds?: number | null) {
  if (!seconds) return "—"
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function getReportStats(reports: ArchivedReport[]): StatCardProps[] {
  const total      = reports.length
  const dispatched = reports.filter((r) => r.outcome !== OutcomeType.REJECT).length
  const overridden = reports.filter((r) => r.outcome === OutcomeType.OVERRIDE).length
  const approvedAiOnly = reports.filter((r) => r.outcome === OutcomeType.ACCEPT).length
  const rejectedAiOnly = reports.filter((r) => r.outcome === OutcomeType.REJECT).length
  const withResponse = reports.filter((r) => r.responseTimeSeconds)
  const avgResponse = withResponse.length
    ? Math.round(withResponse.reduce((sum, r) => sum + (r.responseTimeSeconds ?? 0), 0) / withResponse.length)
    : 0
  const approvalRate = total ? Math.round((dispatched / total) * 100) : 0

  return [
    {
      label: "Total Cases",
      value: total,
      icon: ClipboardList,
      iconColor: "text-primary",
      iconBg: "bg-primary/15",
      subtitle: "Cases handled",
    },
    {
      label: "Approval Rate",
      value: `${approvalRate}%`,
      icon: ThumbsUp,
      iconColor: "text-primary",
      iconBg: "bg-primary/15",
      subtitle: "SLA target 95%",
    },
    {
      label: "Avg Response",
      value: formatResponseTime(avgResponse),
      icon: Timer,
      iconColor: "text-warning",
      iconBg: "bg-warning/15",
      subtitle: "Call to dispatch",
    },
    {
      label: "Approved (AI-only)",
      value: approvedAiOnly,
      icon: CheckCircle2,
      iconColor: "text-secondary",
      iconBg: "bg-secondary/15",
      subtitle: "Dispatched, no review needed",
    },
    {
      label: "Rejected (AI-only)",
      value: rejectedAiOnly,
      icon: XCircle,
      iconColor: "text-destructive",
      iconBg: "bg-destructive/15",
      subtitle: "No resources deployed",
    },
    {
      label: "Overridden",
      value: overridden,
      icon: UserCheck,
      iconColor: "text-warning",
      iconBg: "bg-warning/15",
      subtitle: "Resolved with a dispatcher",
    },
  ]
}

export function StatCardsGrid({ reports }: { reports: ArchivedReport[] }) {
  const stats = useMemo(() => getReportStats(reports), [reports])

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
}
