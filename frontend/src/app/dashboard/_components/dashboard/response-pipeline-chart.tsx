"use client"

import { useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartInfoDialog } from "./chart-info-dialog"
import { useHistoricalReports } from "@/context/historical-reports/useHistoricalReports"
import { ArchivedReport } from "@/models/report"

const STAGE_COLORS = {
  dispatch: "hsl(var(--primary))",
  travel: "hsl(var(--warning))",
  onScene: "hsl(var(--secondary))",
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.round(totalSeconds % 60)
  return `${m}m ${s}s`
}

export function ResponsePipelineChart() {
  const { reports } = useHistoricalReports()

  const { chartData, sampleSize, totalAvg } = useMemo(() => {
    const complete = reports.filter(
      (r) => r.dispatchedAt && r.arrivedAt && r.resolvedAt
    )

    const avg = (fn: (r: (typeof complete)[number]) => number) =>
      complete.length > 0 ? complete.reduce((sum, r) => sum + fn(r), 0) / complete.length : 0

    const dispatchSecs = avg(
      (r) => (r.dispatchedAt!.getTime() - r.callReceivedAt.getTime()) / 1000
    )
    const travelSecs = avg(
      (r) => (r.arrivedAt!.getTime() - r.dispatchedAt!.getTime()) / 1000
    )
    const onSceneSecs = avg(
      (r) => (r.resolvedAt!.getTime() - r.arrivedAt!.getTime()) / 1000
    )

    return {
      chartData: [
        {
          name: "Average Case",
          "AI Decision → Dispatch": Math.round(dispatchSecs),
          "Travel to Scene": Math.round(travelSecs),
          "On-Scene to Resolved": Math.round(onSceneSecs),
        },
      ],
      sampleSize: complete.length,
      totalAvg: dispatchSecs + travelSecs + onSceneSecs,
    }
  }, [])

  return (
    <Card className="transition-all duration-200 hover:border-secondary hover:shadow-secondary hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base font-bold uppercase tracking-widest">
            Response-Time Pipeline
          </CardTitle>
          <CardDescription className="mt-1 text-sm">
            Breaks total response time into stages — AI decision speed, travel time, and on-scene duration —
            instead of one flat average.
          </CardDescription>
        </div>
        <ChartInfoDialog title="Why the Response-Time Pipeline matters">
          <p>
            A single &quot;average response time&quot; number hides where the time actually goes. This chart splits
            it into three stages: how fast the AI classifies and dispatches, how long travel to the scene takes,
            and how long the case takes to resolve once responders arrive.
          </p>
          <p>
            That&apos;s actionable in a way a single average isn&apos;t — e.g. if travel time dominates, the fix is
            about unit placement, not the AI; if the dispatch stage is the bottleneck, that&apos;s squarely an AI/ops
            problem worth investigating.
          </p>
          <p>
            Based on {sampleSize} archived cases with a full call-to-resolution timeline (average total:{" "}
            {formatDuration(totalAvg)}). As more cases accumulate, this can be tracked over time to catch a
            slipping stage before it drags down the overall average.
          </p>
        </ChartInfoDialog>
      </CardHeader>

      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => formatDuration(v)}
              />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={0} />
              <Tooltip
                formatter={(value) => formatDuration(Number(value))}
                contentStyle={{
                  fontSize: 13,
                  borderRadius: 8,
                  background: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                }}
              />
              <Bar
                dataKey="AI Decision → Dispatch"
                stackId="pipeline"
                fill={STAGE_COLORS.dispatch}
                radius={[4, 0, 0, 4]}
              />
              <Bar dataKey="Travel to Scene" stackId="pipeline" fill={STAGE_COLORS.travel} />
              <Bar
                dataKey="On-Scene to Resolved"
                stackId="pipeline"
                fill={STAGE_COLORS.onScene}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {Object.entries({
            "AI Decision → Dispatch": STAGE_COLORS.dispatch,
            "Travel to Scene": STAGE_COLORS.travel,
            "On-Scene to Resolved": STAGE_COLORS.onScene,
          }).map(([label, color]) => (
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
