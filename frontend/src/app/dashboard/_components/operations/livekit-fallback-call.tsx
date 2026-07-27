"use client"

import { useCallback, useState } from "react"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react"
import { ConnectionState } from "livekit-client"
import { Mic, MicOff, Phone, PhoneOff, Radio } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LiveKitApi, type LiveKitFallbackSession } from "@/apis/livekit"

function CallControls({ onDisconnect }: { onDisconnect: () => void }) {
  const connectionState = useConnectionState()
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()

  const statusLabel =
    connectionState === ConnectionState.Connected
      ? "Connected — ARIA is listening"
      : connectionState === ConnectionState.Connecting
        ? "Connecting…"
        : connectionState === ConnectionState.Reconnecting
          ? "Reconnecting…"
          : "Disconnected"

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Radio
          className={cn(
            "size-3",
            connectionState === ConnectionState.Connected
              ? "text-secondary animate-pulse"
              : "text-muted-foreground"
          )}
        />
        {statusLabel}
      </div>
      <Button
        size="icon-xs"
        variant="outline"
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        title={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isMicrophoneEnabled ? (
          <Mic className="size-3.5" />
        ) : (
          <MicOff className="size-3.5 text-destructive" />
        )}
      </Button>
      <Button size="icon-xs" variant="destructive" onClick={onDisconnect} title="End fallback call">
        <PhoneOff className="size-3.5" />
      </Button>
    </div>
  )
}

/**
 * Lets a dispatcher start/join the LiveKit fallback voice line directly from
 * the Operations tab, instead of only via LiveKit Cloud's own test tools.
 * Talks to backend/livekit_agent/api.py (a separate process/port from the
 * main backend) via LiveKitApi.startFallbackSession().
 */
export function LiveKitFallbackCall() {
  const [session, setSession] = useState<LiveKitFallbackSession | null>(null)
  const [connecting, setConnecting] = useState(false)

  const handleStart = useCallback(async () => {
    setConnecting(true)
    try {
      const result = await LiveKitApi.startFallbackSession()
      setSession(result)
    } catch (e) {
      console.error("[livekit] failed to start fallback session", e)
      toast.error("Could not start fallback voice line — is backend/livekit_agent/api.py running?")
    } finally {
      setConnecting(false)
    }
  }, [])

  const handleDisconnect = useCallback(() => {
    setSession(null)
  }, [])

  if (!session) {
    return (
      <div className="absolute top-4 left-4 z-20">
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-warning/50 bg-card/95 shadow-lg backdrop-blur-sm"
          onClick={handleStart}
          disabled={connecting}
        >
          <Phone className="size-3.5" />
          {connecting ? "Starting fallback line…" : "Start Fallback Voice Line"}
        </Button>
      </div>
    )
  }

  return (
    <div className="absolute top-4 left-4 z-20 flex items-center gap-3 rounded-lg border border-warning/40 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <LiveKitRoom
        serverUrl={session.livekit_url}
        token={session.token}
        connect
        audio
        video={false}
        onDisconnected={handleDisconnect}
      >
        <RoomAudioRenderer />
        <CallControls onDisconnect={handleDisconnect} />
      </LiveKitRoom>
    </div>
  )
}
