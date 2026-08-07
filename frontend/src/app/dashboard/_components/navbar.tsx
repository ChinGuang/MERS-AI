"use client"

import { useMemo } from "react"
import {
  Clock,
  FlaskConical,
  LayoutDashboard,
  Radio,
  ShieldAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTime } from "@/context/time/useTime"
import { useIncident } from "@/context/incident/useIncident"
import { useSimulator } from "@/context/simulator/useSimulator"
import { TabName, SeverityType } from "@/types"
import { ThemeToggle } from "./theme-toggle"
import { ProfileDropdown } from "./profile-dropdown"
import { useTab } from "@/context/tab/useTab"
import Image from 'next/image';
const logoPath = '/MERS-AI_Mascot-rmbg1.png';

const NAV_TABS = [
  { id: TabName.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { id: TabName.OPERATIONS, label: "Operations", icon: Radio },
  { id: TabName.HISTORY, label: "History", icon: Clock },
  // { id: TabName.SIMULATION, label: "Simulation", icon: FlaskConical },
] as const

export function Navbar() {
  const { currentTimeText } = useTime()
  const { incidents } = useIncident()
  const { isSimulating } = useSimulator()
  const { currentTab, setCurrentTab } = useTab()

  const activeCount = useMemo(
    () => incidents.filter((i) => i.severity !== SeverityType.RESOLVED).length,
    [incidents]
  )
  const criticalCount = useMemo(
    () => incidents.filter((i) => i.severity === SeverityType.CRITICAL).length,
    [incidents]
  )
  const resolvedCount = useMemo(
    () => incidents.filter((i) => i.severity === SeverityType.RESOLVED).length,
    [incidents]
  )

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 lg:px-6">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-3 lg:gap-4">
        <div className="flex items-center gap-1">
          <Image
            width={40}
            height={40}
            src={logoPath}
            alt="Picture of a Logo"
            className="text-primary"
          />

          <h1 className="text-lg font-bold tracking-tight">MERS-AI</h1>
        </div>

        <span className="hidden font-mono text-xs text-muted-foreground md:inline">
          {currentTimeText} UTC+8
        </span>
      </div>

      {/* Center */}
      <div className="hidden flex-1 items-center justify-center lg:flex">
        <Tabs
          value={currentTab}
          onValueChange={(val) => setCurrentTab(val as TabName)}
        >
          <TabsList className="h-9 rounded-full bg-muted text-white p-1">
            {NAV_TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="gap-1.5 rounded-full px-3 text-xs font-semibold uppercase data-[state=active]:bg-secondary data-[state=active]:text-primary-foreground  dark:data-[state=active]:text-primary-foreground text-white"
              >
                <Icon className="size-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* <div className="hidden items-center gap-2 sm:flex">
          <Badge variant="outline" className="font-mono text-[10px]">
            Active {activeCount}
          </Badge>
          <Badge variant="destructive" className="font-mono text-[10px]">
            Critical {criticalCount}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">
            Resolved {resolvedCount}
          </Badge>
          {isSimulating && (
            <Badge variant="warning" className="animate-pulse font-mono text-[10px]">
              SIM LIVE
            </Badge>
          )}
        </div> */}

        <Badge variant="secondary" className="gap-1.5 p-3 text-white animate-pulse font-mono text-[14px] font-semibold bg-red-400">
          <span className="size-2 rounded-full bg-white" />
          SYSTEM OPERATIONAL
        </Badge>

        <ThemeToggle />
        <ProfileDropdown />
      </div>
    </header>
  )
}
