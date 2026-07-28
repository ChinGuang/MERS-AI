"use client"

import { useEffect, useRef } from "react"
import { Languages, Mic, Radio } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { Incident } from "@/types"

interface TranscriptFeedProps {
  incident: Incident
  fillHeight?: boolean
}

function TypingIndicator() {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-mono text-muted-foreground">[OPERATOR] live</span>
      <div className="inline-flex max-w-[92%] items-center gap-1.5 rounded-xl rounded-tr-sm bg-primary/20 px-3 py-2.5">
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export function TranscriptFeed({ incident, fillHeight }: TranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const isLive = incident.transcript.length > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [incident.transcript])

  const isEmpty = incident.transcript.length === 0

  const content = (
    <div className="space-y-3 pb-2">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-muted/20">
            <Mic className="size-4 text-muted-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">No transcript yet</p>
            <p className="text-[10px] text-muted-foreground/60">
              Transcript will appear here once a live call is connected.
            </p>
          </div>
        </div>
      ) : (
        incident.transcript.map((line, i) => {
          const speaker = line.speaker.toLowerCase()
          const isCaller = speaker === "caller" || speaker === "[caller]"
          const isOperator = speaker === "operator" || speaker === "[operator]"
          const isNew = i === incident.transcript.length - 1

          return (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-1 transition-all duration-300",
                isOperator && "items-end",
                isNew && "animate-in fade-in-0 slide-in-from-bottom-2"
              )}
            >
              <span className="text-[10px] font-mono text-muted-foreground/70">
                [{line.speaker.toUpperCase()}]
                {line.time && (
                  <span className="ml-1 opacity-60">{line.time}</span>
                )}
              </span>
              <div
                className={cn(
                  "relative max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm",
                  isCaller && "rounded-tl-sm bg-muted/80 text-foreground",
                  isOperator && "rounded-tr-sm bg-primary text-primary-foreground",
                  !isCaller && !isOperator && "bg-muted/80 text-foreground",
                  line.highlight && "ring-2 ring-warning ring-offset-1"
                )}
              >
                {line.text}
                {line.highlight && (
                  <span className="ml-2 inline-block rounded bg-warning/20 px-1 text-[9px] font-bold uppercase tracking-wide text-warning">
                    flagged
                  </span>
                )}
                {/* Original was non-English - show the English translation underneath,
                    since the app's default working language is English. */}
                {line.translatedText && line.language && line.language !== "en" && (
                  <div
                    className={cn(
                      "mt-1.5 flex items-start gap-1 border-t pt-1.5 text-[11px] italic opacity-80",
                      isOperator ? "border-primary-foreground/25" : "border-foreground/15"
                    )}
                  >
                    <Languages className="mt-0.5 size-3 shrink-0" />
                    <span>{line.translatedText}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}

      {/* Live typing indicator — only show when call is active */}
      {isLive && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  )

  return (
    <section className={cn("flex flex-col", fillHeight && "h-full min-h-0")}>
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="size-3.5 text-primary" />
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Call Transcript
          </h3>
        </div>

        {/* Live badge */}
        {isLive && (
          <div className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-destructive" />
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-destructive">
              Live
            </span>
          </div>
        )}

        {/* Message count */}
        {incident.transcript.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {incident.transcript.length} lines
          </span>
        )}
      </div>

      {/* Caller info strip */}
      {incident.transcript.length > 0 && (
        <div className="mb-3 flex shrink-0 items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
          <Radio className="size-3 shrink-0 text-primary" />
          <span className="text-[10px] text-muted-foreground">
            Caller: <span className="font-semibold text-foreground">{incident.caller}</span>
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
            {incident.duration}
          </span>
        </div>
      )}

      {fillHeight ? (
        <ScrollArea className="min-h-0 flex-1 pr-2">{content}</ScrollArea>
      ) : (
        <ScrollArea className="h-[320px] pr-2">{content}</ScrollArea>
      )}
    </section>
  )
}
