import { LiveKitFallbackSession } from "@/dtos/livekit";
import { createContext, useContext } from "react";

interface Context {
  startFallbackSession(onFailed: () => void): Promise<void>;
  stopSession(): void;
  session: LiveKitFallbackSession | null;
  isConnecting: boolean;
}

export const LivekitContext = createContext<null | Context>(null);

export function useLivekit() {
  const livekitContext = useContext(LivekitContext);
  if (livekitContext == null) throw new Error("Null context");
  return livekitContext;
}
