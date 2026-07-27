"use client"

import { useState } from "react"
import { Brain, FlaskConical, PanelLeftOpen, ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { IncidentList } from "../operations/incident-list"
import { MapPanel } from "../operations/map-panel"
import { LiveIntelligence } from "../operations/live-intelligence"
import { TranscriptFeed } from "../operations/transcript-feed"
import { EmotionalAnalysis } from "../operations/emotional-analysis"
import { LiveKitFallbackCall } from "../operations/livekit-fallback-call"
import { useIncident } from "@/context/incident/useIncident"
import { useSimulator } from "@/context/simulator/useSimulator"

export function OperationsTab() {
  const { activeIncident, incidents } = useIncident()
  const { isSimulating, setIsSimulating } = useSimulator()
  const [intelOpen, setIntelOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const activeCount = incidents.filter((i) => i.severity !== "resolved").length

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {isSimulating && !bannerDismissed && (
        <div className="relative z-40 flex shrink-0 items-center justify-between bg-warning px-4 py-2 text-warning-foreground">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase">
            <FlaskConical className="size-4" />
            Simulation Active — Not Live Data
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-warning-foreground/30"
              onClick={() => setIsSimulating(false)}
            >
              End Simulation
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setBannerDismissed(true)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className={cn(
          "grid h-full min-h-0 grid-cols-1 grid-rows-[auto_1fr] md:grid-rows-1",
          sidebarCollapsed
            ? "md:grid-cols-1 lg:grid-cols-[1fr_minmax(280px,28%)]"
            : "md:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_minmax(280px,28%)]"
        )}>
          <IncidentList collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

          <div className="relative min-h-0 overflow-hidden border-t md:border-t-0 md:border-l lg:border-r-0">
            <MapPanel />
            <LiveKitFallbackCall />
          </div>

          <LiveIntelligence />

          {/* Mobile / tablet intel FAB */}
          <div className="absolute bottom-20 right-4 z-30 lg:hidden">
            <Sheet open={intelOpen} onOpenChange={setIntelOpen}>
              <SheetTrigger asChild>
                <Button size="icon" className="size-12 rounded-full shadow-lg">
                  <Brain className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="flex h-[70vh] flex-col gap-0 p-0">
                <SheetHeader className="border-b px-4 py-3">
                  <SheetTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
                    <Brain className="size-4 text-primary" /> Live Intelligence
                  </SheetTitle>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                  {activeIncident && <EmotionalAnalysis incident={activeIncident} compact />}
                  <Separator className="my-4" />
                  <div className="min-h-0 flex-1">
                    {activeIncident && <TranscriptFeed incident={activeIncident} fillHeight />}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Floating expand button — OUTSIDE the grid so it never participates in grid layout */}
        {sidebarCollapsed && (
          <div className="pointer-events-auto absolute left-2 top-2 z-20 hidden md:flex flex-col items-center gap-2 rounded-xl border bg-card p-1 shadow-lg">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeftOpen className="size-4" />
            </button>
            <div className="h-px w-6 bg-border" />
            <div className="flex flex-col items-center gap-1 pb-1">
              <div className="relative">
                <ShieldAlert className="size-4 text-destructive" />
                <span className="absolute -right-1.5 -top-1 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white">
                  {activeCount}
                </span>
              </div>
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                Active
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
