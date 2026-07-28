"use client"

import { useEffect, useState } from "react"

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/**
 * Live-ticking "MM:SS" elapsed time since a call started, from the backend's
 * real callStartedAt timestamp (Incident.callStartedAt, sourced from
 * Call.received_at). Originally this decoded the call's UUIDv7 id instead -
 * turned out the uuid_v7 package embeds a bogus timestamp in that id (proven
 * by generating one and decoding it: came back as the year 2201), so every
 * time derived from it was nonsense. Nothing in the backend populated a real
 * `duration` field either (dtos/incidents.ts's Zod schema was silently
 * defaulting it to "00:00" for every incident), which is why this needed a
 * hook at all rather than just reading a field.
 */
export function useCallDuration(callStartedAt: string | undefined | null): string {
  const [text, setText] = useState("00:00")

  useEffect(() => {
    if (!callStartedAt) {
      setText("00:00")
      return
    }

    const startedAt = new Date(callStartedAt)
    if (Number.isNaN(startedAt.getTime())) {
      setText("00:00")
      return
    }

    function tick() {
      setText(formatDuration(Date.now() - startedAt.getTime()))
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [callStartedAt])

  return text
}
