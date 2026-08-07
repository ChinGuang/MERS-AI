import { ReactNode, useState } from 'react';
import { LivekitContext } from './useLivekit';
import { LiveKitApi } from '@/apis/livekit';
import { LiveKitFallbackSession } from '@/dtos/livekit';




export function LivekitProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<LiveKitFallbackSession | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    async function startFallbackSession(onFailed: () => void) {
        setIsConnecting(true)
        try {
            const result = await LiveKitApi.startFallbackSession();
            setSession(result)
        } catch (e) {
            console.error("[livekit] failed to start fallback session", e)
            onFailed()
        } finally {
            setIsConnecting(false)
        }
    }

    async function stopSession() {
        // TODO: disconnect the session
        setSession(null)
    }
    return (
        <LivekitContext value={{
            startFallbackSession,
            stopSession,
            session,
            isConnecting
        }}>
            {children}
        </LivekitContext>
    )
}
