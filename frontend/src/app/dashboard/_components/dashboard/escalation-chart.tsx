"use client"

import { useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { SeverityType, ArchivedReport } from "@/models/report"
import { ChartInfoDialog } from "./chart-info-dialog"
import { useHistoricalReports } from "@/context/historical-reports/useHistoricalReports"

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "hsl(var(--destructive))",
  Urgent: "hsl(var(--warning))",
  Moderate: "hsl(var(--primary))",
}

function severityBreakdown(reports: ArchivedReport[]) {
  const total = reports.length || 1
  const critical = reports.filter((r) => r.severity === SeverityType.CRITICAL).length
  const urgent = reports.filter((r) => r.severity === SeverityType.URGENT).length
  const moderate = reports.filter((r) => r.severity === SeverityType.MODERATE).length
  return {
    Critical: Math.round((critical / total) * 100),
    Urgent: Math.round((urgent / total) * 100),
    Moderate: Math.round((moderate / total) * 100),
  }
}

export function EscalationChart() {
  const { reports } = useHistoricalReports()

  const { chartData, flaggedCount, totalCount, flaggedCriticalPct } = useMemo(() => {
    const flagged = reports.filter((r) => !!r.emotionalAnalysis.contradiction)
    const standard = reports.filter((r) => !r.emotionalAnalysis.contradiction)

    return {
      chartData: [
        { name: "Contradiction Detected", ...severityBreakdown(flagged) },
        { name: "Standard Call", ...severityBreakdown(standard) },
      ],
      flaggedCount: flagged.length,
      totalCount: reports.length,
      flaggedCriticalPct: severityBreakdown(flagged).Critical,
    }
  }, [reports])

  return (
    <Card className="transition-all duration-200 hover:border-secondary hover:shadow-secondary hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base font-bold uppercase tracking-widest">
            Contradiction-Driven Escalation
          </CardTitle>
          <CardDescription className="mt-1 text-sm">
            Calls where the AI caught a caller contradicting themselves mid-call — and how often that correlates
            with a more severe final classification.
          </CardDescription>
        </div>
        <ChartInfoDialog title="Why Contradiction-Driven Escalation matters">
          <p>
            MERS AI doesn&apos;t just transcribe calls — it watches for a caller downplaying a situation and then
            revealing the real danger moments later (&quot;just a small fire&quot; → &quot;it&apos;s spreading to the gas
            tanks!&quot;). That&apos;s the system&apos;s actual differentiator over static keyword-based dispatch.
          </p>
          <p>
            This chart compares the final severity mix of calls where a contradiction was flagged against calls
            without one. If contradiction-flagged calls skew much more Critical, that&apos;s evidence the detection
            is catching real escalations, not noise.
          </p>
          <p>
            Currently {flaggedCount} of {totalCount} archived cases were contradiction-flagged, and{" "}
            {flaggedCriticalPct}% of those ended up Critical. As call volume grows, this ratio becomes a running
            health-check on whether the detection is still earning its keep.
          </p>
        </ChartInfoDialog>
      </CardHeader>

      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={140} />
              <Tooltip
                formatter={(value, name) => [`${value}%`, name]}
                contentStyle={{
                  fontSize: 13,
                  borderRadius: 8,
                  background: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                }}
              />
              <Bar dataKey="Critical" stackId="severity" fill={SEVERITY_COLOR.Critical} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Urgent" stackId="severity" fill={SEVERITY_COLOR.Urgent} />
              <Bar dataKey="Moderate" stackId="severity" fill={SEVERITY_COLOR.Moderate} radius={[0, 4, 4, 0]} />
            </BarChart>
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

        <p className="mt-3 text-center text-sm font-medium text-foreground/75">
          {flaggedCount} of {totalCount} cases were contradiction-flagged — {flaggedCriticalPct}% of those
          escalated to Critical.
        </p>
      </CardContent>
    </Card>
  )
}
