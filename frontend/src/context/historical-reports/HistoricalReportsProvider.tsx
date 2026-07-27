"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { toast } from "sonner"
import {
  HistoricalReportsContext,
  type HistoricalReportsSource,
} from "./useHistoricalReports"
import { fetchHistoricalReports } from "@/lib/historicalReportsService"
import { HISTORICAL_REPORTS } from "@/data/historicalReports"
import { ArchivedReport } from "@/models/report"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }
  return "Failed to load historical reports"
}

export function HistoricalReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<ArchivedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<HistoricalReportsSource>("supabase")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchHistoricalReports()
      setReports(data)
      setSource("supabase")
    } catch (err) {
      console.warn("Historical reports fetch failed:", err)
      setError(getErrorMessage(err))
      setReports(HISTORICAL_REPORTS)
      setSource("offline")
      toast.warning("Supabase unavailable - displaying offline backup records.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <HistoricalReportsContext value={{ reports, loading, error, source, refresh: load }}>
      {children}
    </HistoricalReportsContext>
  )
}
