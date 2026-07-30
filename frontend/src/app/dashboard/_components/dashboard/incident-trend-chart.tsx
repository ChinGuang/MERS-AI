"use client"

import { useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartInfoDialog } from "./chart-info-dialog"
import { ArchivedReport, SeverityType } from "@/models/report"

const SEVERITY_COLOR = {
  Critical: "hsl(var(--destructive))",
  Urgent: "hsl(var(--warning))",
  Moderate: "hsl(var(--primary))",
}

function dailySeverityBreakdown(reports: ArchivedReport[]) {
  const byDate = new Map<string, { critical: number; urgent: number; moderate: number }>()

  for (const r of reports) {
    const key = r.createAt.toISOString().slice(0, 10)
    const bucket = byDate.get(key) ?? { critical: 0, urgent: 0, moderate: 0 }
    if (r.severity === SeverityType.CRITICAL) bucket.critical += 1
    else if (r.severity === SeverityType.URGENT) bucket.urgent += 1
    else bucket.moderate += 1
    byDate.set(key, bucket)
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Critical: counts.critical,
      Urgent: counts.urgent,
      Moderate: counts.moderate,
      total: counts.critical + counts.urgent + counts.moderate,
    }))
}

export function IncidentTrendChart({ reports }: { reports: ArchivedReport[] }) {
  const { chartData, totalCases, dayCount, growthPct } = useMemo(() => {
    const data = dailySeverityBreakdown(reports)
    const first = data[0]?.total ?? 0
    const last = data[data.length - 1]?.total ?? 0
    const growth = first > 0 ? Math.round(((last - first) / first) * 100) : 0

    return {
      chartData: data,
      totalCases: reports.length,
      dayCount: data.length,
      growthPct: growth,
    }
  }, [reports])

  return (
    <Card className="transition-all duration-200 hover:border-secondary hover:shadow-secondary hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base font-bold uppercase tracking-widest">
            Incident Volume Trend
          </CardTitle>
          <CardDescription className="mt-1 text-sm">
            Daily case load broken down by severity — shows whether growing call volume is being met with a
            heavier or lighter mix of critical cases.
          </CardDescription>
        </div>
        <ChartInfoDialog title="Why Incident Volume Trend matters">
          <p>
            Every other chart on this dashboard is a snapshot — a single aggregate across the whole archive.
            This one adds the missing dimension: time. Each day&apos;s cases are stacked by severity, so you can
            watch call volume rise or fall day over day instead of inferring it from a single static total.
          </p>
          <p>
            That matters operationally: a rising volume with a stable or shrinking Critical share is evidence
            the system scales without straining high-priority response capacity. A rising Critical share, on the
            other hand, is an early warning worth investigating before it becomes a staffing problem.
          </p>
          <p>
            Currently tracking {totalCases} cases across {dayCount} days, {growthPct >= 0 ? "up" : "down"}{" "}
            {Math.abs(growthPct)}% in daily volume from the first day in the archive to the most recent. As more
            days accumulate, this trend line becomes the primary early-warning signal for capacity planning.
          </p>
        </ChartInfoDialog>
      </CardHeader>

      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SEVERITY_COLOR.Critical} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={SEVERITY_COLOR.Critical} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillUrgent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SEVERITY_COLOR.Urgent} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={SEVERITY_COLOR.Urgent} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillModerate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SEVERITY_COLOR.Moderate} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={SEVERITY_COLOR.Moderate} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{
                  fontSize: 13,
                  borderRadius: 8,
                  background: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                }}
              />
              <Area
                type="monotone"
                dataKey="Critical"
                stackId="severity"
                stroke={SEVERITY_COLOR.Critical}
                fill="url(#fillCritical)"
                strokeWidth={2}
                animationDuration={1000}
                animationEasing="ease-out"
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Urgent"
                stackId="severity"
                stroke={SEVERITY_COLOR.Urgent}
                fill="url(#fillUrgent)"
                strokeWidth={2}
                animationDuration={1000}
                animationEasing="ease-out"
                animationBegin={150}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Moderate"
                stackId="severity"
                stroke={SEVERITY_COLOR.Moderate}
                fill="url(#fillModerate)"
                strokeWidth={2}
                animationDuration={1000}
                animationEasing="ease-out"
                animationBegin={300}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {Object.entries(SEVERITY_COLOR).map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5 text-sm font-medium text-foreground/75">
              <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
