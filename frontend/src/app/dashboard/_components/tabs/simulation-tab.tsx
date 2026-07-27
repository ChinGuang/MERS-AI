"use client"

import { useEffect, useState } from "react"
import { FlaskConical } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useIncident } from "@/context/incident/useIncident"
import { useSimulator } from "@/context/simulator/useSimulator"
import { useTab } from "@/context/tab/useTab"
import { useTime } from "@/context/time/useTime"
import { Incident, SeverityType, TabName } from "@/types"
import { cn } from "@/lib/utils"

const SCENARIOS = [
  {
    id: "cardiac",
    name: "Cardiac Arrest — Jalan Ampang",
    type: "MEDICAL" as const,
    difficulty: "ADVANCED" as const,
    description:
      "Panicked caller reports elderly male unconscious. Contradiction in breathing status expected.",
    incidentType: "medical" as const,
  },
  {
    id: "fire",
    name: "Cheras Gas Leak Explosion",
    type: "FIRE" as const,
    difficulty: "INTERMEDIATE" as const,
    description:
      "Multi-caller fire scenario with trapped victims. Tests escalation protocols.",
    incidentType: "fire" as const,
  },
  {
    id: "accident",
    name: "Highway Pile-Up — NKVE",
    type: "ACCIDENT" as const,
    difficulty: "BASIC" as const,
    description:
      "Multi-vehicle collision with moderate injuries. Standard triage flow.",
    incidentType: "accident" as const,
  },
]

const DIFFICULTY_COLOR: Record<string, string> = {
  BASIC: "bg-secondary text-secondary-foreground",
  INTERMEDIATE: "bg-primary text-primary-foreground",
  ADVANCED: "bg-destructive text-destructive-foreground",
}

export function SimulationTab() {
  const { setIncidents, setSelectedIncidentId } = useIncident()
  const { isSimulating, setIsSimulating, setSimLogFeed } = useSimulator()
  const { setCurrentTab } = useTab()
  const { currentTimeText } = useTime()
  const [simStep, setSimStep] = useState(0)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (isSimulating) {
      interval = setInterval(() => {
        setSimStep((prev) => prev + 1)
        if (simStep >= 10) {
          setIsSimulating(false)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [isSimulating, simStep, setIsSimulating])

  function launchSimulation(scenario: (typeof SCENARIOS)[0]) {
    const newSim: Incident = {
      id: "SIM-9999",
      type: scenario.incidentType,
      title: scenario.name,
      location: "Kuala Lumpur, Malaysia",
      severity: SeverityType.URGENT,
      priority: 75,
      lang: "EN / BM",
      occurDateTime: new Date().toISOString(),
      caller: "SIMULATED CALLER",
      callId: "SIM-9999",
      duration: "00:00",
      distressScore: 82,
      panicLevel: "High",
      entities: ["Simulation", scenario.type],
      reason: scenario.description,
      confidence: 88,
      sopCitation: "Simulation SOP v1.0",
      sopProcedure: [
        "Assess caller distress level",
        "Verify location coordinates",
        "Determine appropriate response unit",
      ],
      responder: {
        name: "Ambulance A1 - EMS Unit",
        type: "Emergency Medical Service",
        distance: "2.4km",
        eta: "06:45m",
        status: "Ready",
        paramedic: "Rizal K.",
      },
      timeline: [{ time: currentTimeText, event: "Simulation initialized." }],
      transcript: [
        { time: "00:01", speaker: "Caller", text: "Tolong! Kecemasan simulasi!" },
        { time: "00:05", speaker: "Operator", text: "Saya faham. Sila berikan lokasi anda." },
      ],
      coordinates: { lat: 3.091, lng: 101.741 },
      status: {},
    }

    setIncidents((prev) => [newSim, ...prev.filter((i) => i.id !== "SIM-9999")])
    setSelectedIncidentId("SIM-9999")
    setIsSimulating(true)
    setSimStep(0)
    setSimLogFeed([`[${currentTimeText}] Simulation "${scenario.name}" launched.`])
    setCurrentTab(TabName.OPERATIONS)
    toast.warning("Simulation mode active — not live data")
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-2 rounded-lg bg-warning px-4 py-3 text-warning-foreground">
          <FlaskConical className="size-5" />
          <span className="font-semibold uppercase tracking-wide">
            Simulation Mode — Training Environment
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SCENARIOS.map((scenario) => (
            <Card key={scenario.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{scenario.name}</CardTitle>
                  <Badge variant="outline">{scenario.type}</Badge>
                </div>
                <Badge
                  className={cn(
                    "w-fit text-[10px] font-bold uppercase",
                    DIFFICULTY_COLOR[scenario.difficulty]
                  )}
                >
                  {scenario.difficulty}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {scenario.description}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => launchSimulation(scenario)}
                >
                  Launch Simulation
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
