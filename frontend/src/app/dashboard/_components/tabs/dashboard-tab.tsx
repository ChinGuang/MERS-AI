"use client"

import { useMemo, useState } from "react"
import { Clock3, Archive } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SectionHeader, StatCardsGrid } from "../dashboard/stat-cards"
import { DispatchOutcomeChart } from "../dashboard/dispatch-outcome-chart"
import { ResponsePipelineChart } from "../dashboard/response-pipeline-chart"
import { EscalationChart } from "../dashboard/escalation-chart"
import { IncidentTrendChart } from "../dashboard/incident-trend-chart"
import { useHistoricalReports } from "@/context/historical-reports/useHistoricalReports"
import { HISTORICAL_REPORTS } from "@/data/historicalReports"
import { getTodaySeedReports } from "@/data/todaySeedReports"

type StatsRange = "today" | "all-time"

function isToday(date: Date) {
  return date.toDateString() === new Date().toDateString()
}

export function DashboardTab() {
  const [statsRange, setStatsRange] = useState<StatsRange>("all-time")
  const { reports } = useHistoricalReports()

  // All Time always shows the curated demo archive so the dashboard looks
  // demo-ready regardless of what's currently seeded in the live database.
  // Today blends in whatever real cases came in today with a small seed set,
  // so it never renders as a bare empty state on a quiet day.
  const scopedReports = useMemo(
    () =>
      statsRange === "today"
        ? [...reports.filter((r) => isToday(r.createAt)), ...getTodaySeedReports()]
        : HISTORICAL_REPORTS,
    [reports, statsRange]
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {statsRange === "today" ? (
              <SectionHeader icon={Clock3} title="Today" subtitle="cases handled today" />
            ) : (
              <SectionHeader icon={Archive} title="All Time" subtitle="historical archive" />
            )}

            <Tabs value={statsRange} onValueChange={(val) => setStatsRange(val as StatsRange)}>
              <TabsList className="h-9 rounded-full bg-muted p-1">
                <TabsTrigger
                  value="today"
                  className="gap-1.5 rounded-full px-3 text-xs font-semibold uppercase data-[state=active]:bg-secondary data-[state=active]:text-primary-foreground dark:data-[state=active]:text-primary-foreground"
                >
                  <Clock3 className="size-3.5" />
                  Today
                </TabsTrigger>
                <TabsTrigger
                  value="all-time"
                  className="gap-1.5 rounded-full px-3 text-xs font-semibold uppercase data-[state=active]:bg-secondary data-[state=active]:text-primary-foreground dark:data-[state=active]:text-primary-foreground"
                >
                  <Archive className="size-3.5" />
                  All Time
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <StatCardsGrid reports={scopedReports} />
        </div>

        <IncidentTrendChart reports={scopedReports} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DispatchOutcomeChart reports={scopedReports} />
          <ResponsePipelineChart reports={scopedReports} />
        </div>

        <EscalationChart reports={scopedReports} />
      </div>
    </div>
  )
}
