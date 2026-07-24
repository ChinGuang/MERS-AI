import { Incident } from '@/types';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Map, Marker, Popup, AttributionControl, type MapRef } from 'react-map-gl/mapbox';
import { SVGFallback } from './SvgFallback';
import { MapButton } from './MapButton';
import { RouteLayer } from './RouteLayer';
import { Crosshair, Layers, Minus, Plus, MapPin, Search, X, Radar } from 'lucide-react';
// import { EMERGENCY_CENTER } from '@/constants/dispatch';

interface IncidentMapProps {
    activeIncident: Incident;
    allIncidents?: Incident[];
    pinColor: string;
    isDark: boolean;
    onSelectIncident?: (incident: Incident) => void;
    /** True while the AI location agent is analyzing the live transcript */
    isLocating?: boolean;
    /** Live GPS fix for the responding unit, if you have real tracking */
    liveResponderPosition?: { lat: number; lng: number } | null;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Used only while a live call has no resolved coordinates yet, so the map
// doesn't default to (0, 0) — the Gulf of Guinea — while the agent is
// still extracting/geocoding the caller's location.
const FALLBACK_CENTER = { lat: 3.139, lng: 101.6869 }; // Kuala Lumpur
const EMERGENCY_CENTER = { lat: 3.139, lng: 101.6869 }; // Kuala Lumpur Dispatch Center


const MAP_STYLES_DARK = [
    { id: 'mapbox://styles/mapbox/dark-v11', label: 'TACTICAL' },
    { id: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'SATELLITE' },
    { id: 'mapbox://styles/mapbox/navigation-night-v1', label: 'NAV' },
    { id: 'mapbox://styles/mapbox/standard', label: '3D' },
] as const;

const MAP_STYLES_LIGHT = [
    { id: 'mapbox://styles/mapbox/light-v11', label: 'LIGHT' },
    { id: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'SATELLITE' },
    { id: 'mapbox://styles/mapbox/streets-v12', label: 'STREETS' },
    { id: 'mapbox://styles/mapbox/standard', label: '3D' },
] as const;

/**
 * Center panel: tactical map, incident header, timeline, and responder ETA cards.
 * See src/components/guides/TacticalWorkspace.md
 */
// Source by: Qistina
// ─── IncidentMap ────────────────────────────────────────────────────────────
export function IncidentMap({
    activeIncident,
    allIncidents,
    pinColor,
    isDark,
    onSelectIncident,
    isLocating = false,
    liveResponderPosition = null,
}: IncidentMapProps) {
    const mapRef = useRef<MapRef | null>(null);
    const [styleIndex, setStyleIndex] = useState(0);
    const [hoveredIncident, setHoveredIncident] = useState<Incident | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const hasCoordinates = Boolean(activeIncident.coordinates);
    const lat = activeIncident.coordinates?.lat ?? 0;
    const lng = activeIncident.coordinates?.lng ?? 0;

    // Backend flags weak geocode matches by prefixing the address with "(Approx)"
    const isApproximate = activeIncident.location?.startsWith('(Approx)') ?? false;
    const displayLocation = activeIncident.location?.replace(/^\(Approx\)\s*/, '') ?? '';

    const styles = isDark ? MAP_STYLES_DARK : MAP_STYLES_LIGHT;
    const currentStyle = styles[styleIndex];

    // Combined list (active + others) for searching
  const searchableIncidents = useMemo(() => {
    const list = allIncidents ?? [];
    return list.some(inc => inc.id === activeIncident.id) ? list : [activeIncident, ...list];
  }, [allIncidents, activeIncident]);
  
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // No query yet -> show active incident by default
    // if (!q) return activeIncident ? [activeIncident] : [];

    return searchableIncidents.filter(inc =>
    inc.title?.toLowerCase().includes(q) ||
    inc.location?.toLowerCase().includes(q) ||
    inc.id?.toString().toLowerCase().includes(q),
  ).slice(0, 6);
}, [searchQuery, searchableIncidents, activeIncident]);

    const hasQuery = searchQuery.trim().length > 0;

    // Keep the active incident visible as the default suggestion when the
    // // search box is opened but nothing has been typed yet.
    const displayResults = hasQuery ? searchResults : searchableIncidents;
    const noResults = hasQuery && searchResults.length === 0;

  // All non-resolved incidents, shown by default when the dropdown opens with no query
  const activeIncidents = useMemo(
    () => searchableIncidents.filter(inc => inc.severity !== 'resolved'),
    [searchableIncidents],
  );

    
  const flyToIncident = useCallback((inc: Incident) => {
    if (!inc.coordinates) return;
    mapRef.current?.flyTo({
      center: [inc.coordinates.lng, inc.coordinates.lat],
      zoom: 16,
      pitch: 40,
      bearing: -18,
      duration: 1000,
      essential: true,
    });
    setHoveredIncident(inc);
    onSelectIncident?.(inc);
  }, [onSelectIncident]);

    // Re-center when active incident changes (or when its location resolves mid-call)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !hasCoordinates) return;
        map.flyTo({
            center: [lng, lat],
            zoom: 15,
            pitch: 40,
            bearing: -18,
            duration: 1400,
            essential: true,
        });
    }, [lat, lng, hasCoordinates])

    if (!MAPBOX_TOKEN) {
        return <SVGFallback activeIncident={activeIncident} pinColor={pinColor} isDark={isDark} />;
    }

    const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 250 });
    const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 250 });
    const handleCycleStyle = () => setStyleIndex(i => (i + 1) % styles.length);
    const handleRecenter = () =>
        mapRef.current?.flyTo({ center: lng && lat && [lng, lat] || undefined, zoom: 15, pitch: 40, bearing: -18, duration: 700 });

    return (
    <div className="absolute inset-0">
            <Map
                ref={mapRef}
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                    longitude: lng,
                    latitude: lat,
                    zoom: 15,
                    pitch: 40,
                    bearing: -18,
                }}
                mapStyle={currentStyle.id}
                style={{ width: '100%', height: '100%' }}
                attributionControl={false}
                reuseMaps
            >
                {/* Other incidents (smaller, dimmer) */}
                {allIncidents
                    ?.filter(inc => inc.id !== activeIncident.id)
                    .map(inc => {
                        if (inc.coordinates)
                            return (
                                <Marker
                                    key={inc.id}
                                    longitude={inc.coordinates?.lng}
                                    latitude={inc.coordinates?.lat}
                                    anchor="center"
                                >
                                    <div
                                        className="w-3 h-2.5 rounded-full ring-1 ring-black-400 opacity-70 hover:opacity-50 transition-opacity"
                                        style={{
                                            backgroundColor:
                                                inc.severity === 'critical' ? 'red' :
                                                    inc.severity === 'urgent' ? 'orange' :
                                                        inc.severity === 'moderate' ? 'yellow' : 'green',
                                        }}
                                        title={`${inc.id} · ${inc.title}`}
                                    />
                                </Marker>
                            )
                    })}

                {/* Route + responder tracker: dispatch center → active incident */}
                {lat !== 0 && lng !== 0 && (
                    <RouteLayer
                        origin={EMERGENCY_CENTER}
                        destination={{ lat, lng }}
                        mapboxToken={MAPBOX_TOKEN}
                        isDark={isDark}
                        color={pinColor}
                        liveResponderPosition={liveResponderPosition}
                    />
                )}

                {/* Active incident pin */}
                <Marker longitude={lng} latitude={lat} anchor="center">
                    <div className="relative cursor-pointer"
                    onMouseEnter={() => setHoveredIncident(activeIncident)}
                    onMouseLeave={() => setHoveredIncident(curr => (curr?.id === activeIncident.id ? null : curr))}
                    >
                        <div className="absolute -inset-7 rounded-full animate-ping pointer-events-none"
                        style={{ backgroundColor: 'red', opacity: 0.35 }} 
                        />
                        <div className="relative w-5 h-5 rounded-full ring-2 bg-stone-500 shadow-2xl flex items-center justify-center"
                        style={{ backgroundColor: 'darkred' }} 
                        >
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap pointer-events-none"
                        style={{
                            backgroundColor: 'rgba(13, 16, 27, 0.95)',
                            color: 'white',
                            borderLeft: `2px solid ${pinColor}`,
                        }}
                        >
                            {activeIncident.id}
                        </div>
                        </div>
                </Marker>

                {/* Active incident pin — only once the agent has actually resolved a location */}
                {hasCoordinates && (
                    <Marker longitude={lng} latitude={lat} anchor="center">
                        <div className="relative cursor-pointer"
                        onMouseEnter={() => setHoveredIncident(activeIncident)}
                        onMouseLeave={() => setHoveredIncident(curr => (curr?.id === activeIncident.id ? null : curr))}
                        >
                            <div className="absolute -inset-7 rounded-full animate-ping pointer-events-none"
                            style={{ backgroundColor: isApproximate ? '#F59E0B' : 'red', opacity: 0.35 }}
                            />
                            <div className={`relative w-5 h-5 rounded-full ring-2 shadow-2xl flex items-center justify-center ${isApproximate ? 'ring-amber-400 ring-dashed' : 'ring-white/40'}`}
                            style={{ backgroundColor: isApproximate ? '#B45309' : 'darkred' }}
                            >
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 max-w-47.5 px-1.5 py-1 rounded text-[9px] font-mono font-bold whitespace-normal text-center leading-tight pointer-events-none"
                            
                            style={{
                                backgroundColor: 'rgba(13, 16, 27, 0.95)',
                                color: 'white',
                                borderLeft: `2px solid ${isApproximate ? '#F59E0B' : pinColor}`,
                            }}
                            >
                                <div>{displayLocation || activeIncident.id}</div>
                                {isApproximate && (
                                    <div className="mt-0.5 text-amber-400 tracking-wide">≈ APPROX — CONFIRM</div>
                                )}
                            </div>
                            </div>
                    </Marker>
                )}

                {/* Locating state — shown while the agent hasn't extracted/geocoded a location yet */}
                {!hasCoordinates && (
                    <Marker longitude={lng} latitude={lat} anchor="center">
                        <div className="flex flex-col items-center pointer-events-none">
                            <div className="w-4 h-4 rounded-full ring-2 ring-cyan-400 animate-pulse" />
                            <div className="mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap bg-black/80 text-cyan-300">
                                LOCATING…
                            </div>
                        </div>
                    </Marker>
                )}

                        {/* Hover detail popup */}
                        {hoveredIncident && hoveredIncident.coordinates && (
                          <Popup
                            longitude={hoveredIncident.coordinates.lng}
                            latitude={hoveredIncident.coordinates.lat}
                            anchor="bottom"
                            offset={18}
                            closeButton={false}
                            closeOnClick={false}
                            className={`incident-hover-popup ${isDark ? 'incident-hover-popup-dark' : 'incident-hover-popup-light'}`}
                          >
                            <div
                              className={`min-w-45 max-w-105 text-[15px] font-mono p-3 rounded ${
                                isDark ? 'text-slate-200' : 'text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span
                                  className="inline-block w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      hoveredIncident.severity === 'critical' ? '#E63946' :
                                      hoveredIncident.severity === 'urgent'   ? '#F59E0B' :
                                      hoveredIncident.severity === 'moderate' ? '#EAB308' : '#10B981',
                                  }}
                                />
                                <span className="font-bold uppercase tracking-wide">{hoveredIncident.title}</span>
                              </div>
                              <div className="opacity-70 flex items-center gap-1 mb-0.5">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="font-bold uppercase tracking-wide">{hoveredIncident.location}</span>
                              </div>
                              <div className="flex items-center justify-between opacity-90">
                                <span className="uppercase">{hoveredIncident.severity}</span>
                                <span className="opacity-60">{hoveredIncident.id}</span>
                              </div>
                            </div>
                          </Popup>
                        )}
                
                        <AttributionControl position="bottom-left" compact />
                      </Map>
                
                     {/* Search box */}
                      <div className="absolute top-5 right-3 z-10 flex flex-col items-end gap-1.5">
                        <div className="flex items-center">
                          {searchOpen && (
                            <div className="relative">
                              <input
                                autoFocus
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && searchResults[0]) flyToIncident(searchResults[0]);
                                  if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
                                }}
                                placeholder="Search by name or location…"
                                className={`w-56 px-3 py-2 rounded-md text-xs font-mono backdrop-blur-md outline-none ${
                                  isDark
                                    ? 'bg-black/70 text-slate-200 placeholder-slate-500 border border-[#2D334A] focus:border-cyan-500/50'
                                    : 'bg-white/90 text-slate-800 placeholder-slate-400 border border-slate-300 focus:border-cyan-500'
                                }`}
                              />
                
                              {(displayResults.length > 0 || noResults) && (
                                <div
                                  className={`absolute top-full mt-1 w-56 max-h-56 overflow-y-auto rounded-md backdrop-blur-md z-30 ${
                                    isDark ? 'bg-black/85 border border-[#2D334A]' : 'bg-white/95 border border-slate-300'
                                  }`}
                                >
                                  {noResults ? (
                                    <div
                                      className={`px-3 py-2 text-[10px] font-mono ${
                                        isDark ? 'text-slate-500' : 'text-slate-400'
                                      }`}
                                    >
                                      No Result Incident
                                    </div>
                                  ) : (
                                    displayResults.map(inc => (
                                      <button
                                        key={inc.id}
                                        type="button"
                                        onClick={() => { flyToIncident(inc); setSearchOpen(false); setSearchQuery(''); }}
                                        className={`w-full text-left px-3 py-2 text-[10px] font-mono border-b last:border-b-0 transition-colors ${
                                          isDark
                                            ? 'border-[#2D334A] text-slate-300 hover:bg-white/5'
                                            : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                                        }`}
                                      >
                                        <div className="font-bold truncate flex items-center gap-1.5">
                                          <span
                                          className="inline-block w-1 h-1 rounded-full shrink-0 "
                                          style={
                                          {backgroundColor:
                                          inc.severity === 'critical' ? '#E63946' :
                                          inc.severity === 'urgent'   ? '#F59E0B' :
                                          inc.severity === 'moderate' ? '#EAB308' : '#10B981',
                                        }}
                                        />
                                        {inc.title}
                                        </div>
        
                                        <div className="opacity-60 truncate flex items-center gap-1">
                                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                                          {inc.location}
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                
                          <MapButton
                            onClick={() => {
                              if (searchOpen) { setSearchOpen(false); setSearchQuery(''); }
                              else setSearchOpen(true);
                            }}
                            isDark={isDark}
                            title={searchOpen ? 'Close search' : 'Search incidents'}
                          >
                            {searchOpen ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                          </MapButton>
                        </div>
                      </div>

                      
            {/* Custom map controls */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
                <MapButton onClick={handleZoomIn} isDark={isDark} title="Zoom in">
                    <Plus className="w-3.5 h-3.5" />
                </MapButton>
                <MapButton onClick={handleZoomOut} isDark={isDark} title="Zoom out">
                    <Minus className="w-3.5 h-3.5" />
                </MapButton>
                <MapButton onClick={handleCycleStyle} isDark={isDark} title={`Cycle style (${currentStyle.label})`}>
                    <Layers className="w-3.5 h-3.5" />
                </MapButton>
                <MapButton onClick={handleRecenter} isDark={isDark} title="Recenter on incident">
                    <Crosshair className="w-3.5 h-3.5" />
                </MapButton>
            </div>

            {/* AI location agent status */}
            {isLocating && (
                <div
                    className={`absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono font-bold tracking-widest z-10 ${
                        isDark ? 'bg-black/70 text-cyan-400 ring-1 ring-cyan-500/40' : 'bg-white/90 text-cyan-700 ring-1 ring-cyan-500/40'
                    }`}
                >
                    <Radar className="w-3 h-3 animate-spin" style={{ animationDuration: '1.5s' }} />
                    AI LOCATING…
                </div>
            )}

            {/* Style indicator */}
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[9px] font-mono font-bold tracking-widest pointer-events-none ${
          isDark ? 'bg-black/60 text-cyan-400 ring-1 ring-cyan-500/30' : 'bg-white/80 text-cyan-700 ring-1 ring-cyan-500/40'
        }`}
      >
        {currentStyle.label} · MAPBOX
      </div>
    </div>
  );
}