import {
  LiveKitFallbackSession,
  LiveKitFallbackSessionSchema,
} from "@/dtos/livekit";
import axios from "axios";

/**
 * Talks to backend/livekit_agent/api.py - a separate standalone process/port
 * from the main backend (NEXT_PUBLIC_BACKEND_URL), by design: the LiveKit
 * fallback channel was built isolated from the main FastAPI app so it could
 * be developed/tested without touching it.
 */
async function startFallbackSession(): Promise<LiveKitFallbackSession> {
  const url = `${process.env.NEXT_PUBLIC_LIVEKIT_API_URL}/livekit/session`;
  const response = await axios.post(url);
  return LiveKitFallbackSessionSchema.parse(response.data);
}

export const LiveKitApi = {
  startFallbackSession,
};
