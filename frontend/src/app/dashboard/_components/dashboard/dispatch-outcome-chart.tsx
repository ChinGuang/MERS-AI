"use client"

import { useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { HISTORICAL_REPORTS } from "@/data/historicalReports"
import { OutcomeType, ArchivedReport } from "@/models/report"
import { ChartInfoDialog } from "./chart-info-dialog"
import { useHistoricalReports } from "@/context/historical-reports/useHistoricalReports"

const APPROVED_COLOR = "hsl(var(--secondary))"
const REJECTED_COLOR = "hsl(var(--destructive))"
const OVERRIDE_COLOR = "hsl(var(--warning))"

export function DispatchOutcomeChart() {
  const { reports } = useHistoricalReports()

  const { outcomeSplit, overrideCount, totalCount } = useMemo(() => {
    const overridden = reports.filter((r) => r.outcome === OutcomeType.OVERRIDE)
    const approvedAiOnly = reports.filter((r) => r.outcome === OutcomeType.ACCEPT).length
    const rejectedAiOnly = reports.filter((r) => r.outcome === OutcomeType.REJECT).length

    return {
      outcomeSplit: [
        { name: "Approved (AI-only)", value: approvedAiOnly, color: APPROVED_COLOR },
        { name: "Rejected (AI-only)", value: rejectedAiOnly, color: REJECTED_COLOR },
        { name: "Human Override", value: overridden.length, color: OVERRIDE_COLOR },
      ],
      overrideCount: overridden.length,
      totalCount: reports.length,
    }
  }, [reports])

  return (
    <Card className="transition-all duration-200 hover:border-secondary hover:shadow-secondary hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base font-bold uppercase tracking-widest">
            Dispatch Outcome &amp; Human Override
          </CardTitle>
          <CardDescription className="mt-1 text-sm">
            How every archived case was actually resolved — dispatched by the AI alone, rejected by the AI
            alone, or resolved together with a human dispatcher.
          </CardDescription>
        </div>
        <ChartInfoDialog title="Why Dispatch Outcome & Human Override matters">
          <p>
            This view shows exactly how each case was handled in practice: dispatched by the AI on its own,
            rejected by the AI on its own, or resolved together with a human dispatcher for extra judgment or
            coordination.
          </p>
          <p>
            That&apos;s a direct, verifiable measure of how the AI and the dispatch team work together — it
            shows how often the AI&apos;s call was trusted to run end-to-end, and how often a dispatcher&apos;s
            judgment added value on top of it.
          </p>
          <p>
            Currently {overrideCount} of {totalCount} archived cases involved a human dispatcher. As dispatch
            volume grows, this same view can be tracked over time to see how that collaboration evolves.
          </p>
        </ChartInfoDialog>
      </CardHeader>

      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={outcomeSplit}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={0}
              >
                {outcomeSplit.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 13,
                  borderRadius: 8,
                  background: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {outcomeSplit.map(({ name, color }) => (
            <div key={name} className="flex items-center gap-1.5 text-sm font-medium text-foreground/75">
              <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
              {name}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
