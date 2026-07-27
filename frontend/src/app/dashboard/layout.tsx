"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { HistoricalReportsProvider } from "@/context/historical-reports/HistoricalReportsProvider"
import { useAuth } from "@/context/auth/useAuth"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/authpage")
    }
  }, [loading, router, user])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="relative flex size-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full border border-secondary/20" />
          <div className="size-12 animate-spin rounded-full border-2 border-t-primary border-r-primary/30 border-b-primary/10 border-l-primary/30" />
        </div>
        <p className="mt-6 animate-pulse font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Verifying Operator Credentials...
        </p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <HistoricalReportsProvider>{children}</HistoricalReportsProvider>
}
