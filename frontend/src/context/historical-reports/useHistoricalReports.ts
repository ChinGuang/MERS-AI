"use client"

import { createContext, useContext } from "react"
import { ArchivedReport } from "@/models/report"

export type HistoricalReportsSource = "supabase" | "offline"

interface Context {
  reports: ArchivedReport[]
  loading: boolean
  error: string | null
  source: HistoricalReportsSource
  refresh: () => Promise<void>
}

export const HistoricalReportsContext = createContext<null | Context>(null)

export function useHistoricalReports() {
  const ctx = useContext(HistoricalReportsContext)
  if (ctx == null) throw new Error("useHistoricalReports must be used within a HistoricalReportsProvider")
  return ctx
}
