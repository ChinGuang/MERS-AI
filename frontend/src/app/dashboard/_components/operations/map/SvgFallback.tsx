import { Incident } from '@/types';
import { useMemo } from 'react';

interface SVGFallbackProps {
    activeIncident: Incident;
    pinColor: string;
    isDark: boolean;
}

export function SVGFallback({ activeIncident, pinColor, isDark }: SVGFallbackProps) {
    let x: number;
    let y: number;

    if (process.env.NEXT_PUBLIC_TOGGLE_HARDCODE === 'true') {
        x = 250;
        y = 150;
    } else {
        x = (activeIncident as any)?.x ?? activeIncident?.coordinates?.lng ?? 250;
        y = (activeIncident as any)?.y ?? activeIncident?.coordinates?.lat ?? 150;
    }
    const mockRoads = [
        'M 0 80 Q 120 60 250 110 T 500 130',
        'M 0 200 Q 150 240 300 200 T 500 220',
        'M 80 0 Q 120 120 90 220 T 110 300',
        'M 340 0 Q 320 100 360 180 T 380 300',
    ]

    const mockBuildings = [
        { x: 40, y: 30, w: 28, h: 18 }, { x: 110, y: 50, w: 22, h: 14 },
        { x: 180, y: 30, w: 36, h: 22 }, { x: 300, y: 60, w: 26, h: 18 },
        { x: 410, y: 40, w: 30, h: 16 }, { x: 60, y: 240, w: 24, h: 18 },
        { x: 200, y: 250, w: 28, h: 16 }, { x: 340, y: 240, w: 36, h: 22 },
        { x: 430, y: 250, w: 24, h: 18 },
    ]

    return (
        <div className="absolute inset-0">
            <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                    backgroundImage: isDark
                        ? 'linear-gradient(rgba(45, 51, 74, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(45, 51, 74, 0.5) 1px, transparent 1px)'
                        : 'linear-gradient(rgba(148, 163, 184, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.4) 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                }}
            />

            <svg viewBox="0 0 500 300" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                <defs>
                    <radialGradient id="pinPulseSvg" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={pinColor} stopOpacity="0.6" />
                        <stop offset="100%" stopColor={pinColor} stopOpacity="0" />
                    </radialGradient>
                </defs>

                {mockRoads.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke={isDark ? '#1E2435' : '#CBD5E1'} strokeWidth={i < 2 ? 6 : 3} strokeLinecap="round" />
                ))}
                {mockBuildings.map((b, i) => (
                    <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={isDark ? '#11162A' : '#E2E8F0'} stroke={isDark ? '#2D334A' : '#CBD5E1'} strokeWidth={0.5} rx="1" />
                ))}

                <circle cx={x} cy={y} r="40" fill="url(#pinPulseSvg)">
                    <animate attributeName="r" values="20;40;20" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0.1;0.9" dur="2.4s" repeatCount="indefinite" />
                </circle>
                <circle cx={x} cy={y} r="8" fill={pinColor} stroke="white" strokeWidth="2" />
                <circle cx={x} cy={y} r="3" fill="white" />

                <line x1="0" y1={y} x2="500" y2={y} stroke={pinColor} strokeWidth="0.3" strokeDasharray="2 4" opacity="0.4" />
                <line x1={x} y1="0" x2={x} y2="300" stroke={pinColor} strokeWidth="0.3" strokeDasharray="2 4" opacity="0.4" />
            </svg>

            <div
                className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[9px] font-mono font-bold tracking-widest pointer-events-none ${isDark ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                    }`}
            >
                ⚠ NEXT_PUBLIC_MAPBOX_TOKEN MISSING · SVG FALLBACK
            </div>
        </div>
    );
}