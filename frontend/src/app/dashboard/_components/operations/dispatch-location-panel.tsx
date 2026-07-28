"use client"

import "mapbox-gl/dist/mapbox-gl.css"
import { ExternalLink, MapPin, Navigation, Satellite } from "lucide-react"
import { Map, Marker } from "react-map-gl/mapbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Incident } from "@/types"
import { LOCATION_OPTIONS } from "./dispatch-constants"

interface CallerAddress {
  formatted: string
  street?: string
  area?: string
  city?: string
  state?: string
  postalCode?: string
  landmark?: string
  source?: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

function buildGoogleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

function buildGoogleEmbedUrl(lat: number, lng: number) {
  if (GOOGLE_MAPS_KEY) {
    return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${lat},${lng}&zoom=17`
  }
  return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=17&output=embed`
}

function buildSpotImageUrl(lat: number, lng: number, customUrl?: string) {
  if (customUrl) return customUrl
  if (GOOGLE_MAPS_KEY) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=800x450&maptype=satellite&markers=color:red%7C${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
  }
  if (MAPBOX_TOKEN) {
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-l+ff4444(${lng},${lat})/${lng},${lat},17,0/800x450@2x?access_token=${MAPBOX_TOKEN}`
  }
  return null
}

function AddressRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

interface DispatchLocationPanelProps {
  incident: Incident
}

export function DispatchLocationPanel({ incident }: DispatchLocationPanelProps) {
  const lat = incident.coordinates?.lat
  const lng = incident.coordinates?.lng
  const hasCoords = lat != null && lng != null

  const matchedLocation = LOCATION_OPTIONS.find(
    (opt) => opt.label === incident.location || incident.location.includes(opt.label)
  )

  const address: CallerAddress = matchedLocation
    ? {
      formatted: matchedLocation.formatted,
      street: matchedLocation.street,
      area: matchedLocation.area,
      city: matchedLocation.city,
      state: matchedLocation.state,
      postalCode: matchedLocation.postalCode,
      landmark: matchedLocation.landmark,
      source: "ai",
    }
    : {
      formatted: incident.location,
      city: incident.location.split(",")[0]?.trim(),
      state: incident.location.split(",")[1]?.trim(),
      landmark: incident.location.includes("(")
        ? incident.location.split("(")[1]?.replace(")", "").trim()
        : undefined,
      source: "ai",
    }

  const spotImageUrl = hasCoords
    ? buildSpotImageUrl(lat, lng)
    : null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Caller Location
        </p>
        {address.source && (
          <Badge variant="outline" className="text-[10px] uppercase">
            {address.source} verified
          </Badge>
        )}
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium leading-snug">{address.formatted}</p>
            {address.landmark && (
              <p className="text-xs text-muted-foreground">
                Near landmark: {address.landmark}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5 border-t pt-2">
          <AddressRow label="Street" value={address.street} />
          <AddressRow label="Area" value={address.area} />
          <AddressRow label="City" value={address.city} />
          <AddressRow label="State" value={address.state} />
          <AddressRow label="Postcode" value={address.postalCode} />
          {hasCoords && (
            <div className="flex items-center justify-between gap-3 font-mono text-[11px]">
              <span className="text-muted-foreground">GPS</span>
              <span>
                {lat.toFixed(5)}°N, {lng.toFixed(5)}°E
              </span>
            </div>
          )}
        </div>
      </div>

      {hasCoords ? (
        <Tabs defaultValue="map" className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-2">
            <p className="flex text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Navigation className="mr-2 size-3.5" /> Map View
            </p>
          </div>

          <TabsContent value="map" className="space-y-2">
            <div className="overflow-hidden rounded-lg border">
              <iframe
                title={`Google Maps — ${incident.case_number}`}
                src={buildGoogleEmbedUrl(lat, lng)}
                className="h-44 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>

            <Button variant="outline" size="sm" className="w-full" asChild>
              <a
                href={buildGoogleMapsUrl(lat, lng)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-3.5" />
                Open in Google Maps
              </a>
            </Button>
          </TabsContent>
        </Tabs>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          GPS coordinates not available for this incident.
        </p>
      )}
    </section>
  )
}
