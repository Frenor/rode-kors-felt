import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { MapRuntimeConfig } from '../lib/types';

interface GeoPoint {
  lat: number;
  lng: number;
}

interface Team {
  id: string;
  name: string;
  currentPosition?: GeoPoint;
}

interface EventMapProps {
  teams: Team[];
  center?: GeoPoint;
  provider?: 'leaflet' | 'maplibre';
  presentation3d?: boolean;
  mapRuntimeConfig?: MapRuntimeConfig | null;
}

type MapLibreModule = {
  Map: new (options: Record<string, unknown>) => MapLibreInstance;
  NavigationControl: new (...args: unknown[]) => unknown;
  Marker: new (options?: Record<string, unknown>) => MapLibreMarker;
  Popup: new (options?: Record<string, unknown>) => MapLibrePopup;
};

type MapLibreInstance = {
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
  remove: () => void;
  addControl: (control: unknown, position?: string) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options?: Record<string, unknown>) => void;
  getSource: (sourceId: string) => unknown;
  addSource: (sourceId: string, source: Record<string, unknown>) => void;
  getLayer: (layerId: string) => unknown;
  addLayer: (layer: Record<string, unknown>) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
};

type MapLibreMarker = {
  setLngLat: (coords: [number, number]) => MapLibreMarker;
  setPopup: (popup: MapLibrePopup) => MapLibreMarker;
  addTo: (map: MapLibreInstance) => MapLibreMarker;
  remove: () => void;
};

type MapLibrePopup = {
  setHTML: (html: string) => MapLibrePopup;
};

function makeTeamIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#2563eb" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="9" r="3" fill="white"/>
      <path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6" fill="white"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

const TEAM_ICON = makeTeamIcon();

function BoundsFitter({ teams }: { teams: Team[] }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [
      ...teams.filter((t) => t.currentPosition).map((t) => [t.currentPosition!.lat, t.currentPosition!.lng] as [number, number]),
    ];
    if (points.length > 0) {
      map.fitBounds(points, { padding: [32, 32], maxZoom: 15 });
    }
  }, [teams, map]);

  return null;
}

const NORWAY_CENTER: GeoPoint = { lat: 64.5, lng: 17.5 };
const MAPLIBRE_RUNTIME_URL = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';

let mapLibreRuntimePromise: Promise<MapLibreModule | null> | null = null;

function getMapLibreRuntime(): MapLibreModule | null {
  if (typeof window === 'undefined') return null;
  return ((window as Window & { maplibregl?: MapLibreModule }).maplibregl ?? null);
}

function loadMapLibreRuntime(runtimeUrl = MAPLIBRE_RUNTIME_URL): Promise<MapLibreModule | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const existing = getMapLibreRuntime();
  if (existing) return Promise.resolve(existing);
  if (mapLibreRuntimePromise) return mapLibreRuntimePromise;

  mapLibreRuntimePromise = new Promise<MapLibreModule | null>((resolve) => {
    const complete = () => resolve(getMapLibreRuntime());
    const scriptId = 'rkf-maplibre-runtime';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', complete, { once: true });
      existingScript.addEventListener('error', () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = runtimeUrl;
    script.async = true;
    script.onload = complete;
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  }).finally(() => {
    if (!getMapLibreRuntime()) {
      mapLibreRuntimePromise = null;
    }
  });

  return mapLibreRuntimePromise ?? Promise.resolve(getMapLibreRuntime());
}

function layerToTileUrl(layerUrl: string, token?: string): string {
  if (!token) return layerUrl;
  if (layerUrl.includes('{token}')) return layerUrl.replaceAll('{token}', encodeURIComponent(token));
  const separator = layerUrl.includes('?') ? '&' : '?';
  return `${layerUrl}${separator}token=${encodeURIComponent(token)}`;
}

function MapLibreCanvas({
  teams,
  center,
  runtime,
  mapRuntimeConfig,
  presentation3d,
}: {
  teams: Team[];
  center: GeoPoint;
  runtime: MapLibreModule;
  mapRuntimeConfig?: MapRuntimeConfig | null;
  presentation3d: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);

  const styleUrl = mapRuntimeConfig?.styleUrl ?? 'https://demotiles.maplibre.org/style.json';
  const configuredLayers = mapRuntimeConfig?.layers ?? [];

  const points = useMemo(() => {
    return teams
      .filter((team) => team.currentPosition)
      .map((team) => [team.currentPosition!.lng, team.currentPosition!.lat] as [number, number]);
  }, [teams]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new runtime.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [center.lng, center.lat],
      zoom: 13,
      pitch: presentation3d ? 55 : 0,
      bearing: presentation3d ? 18 : 0,
    });
    map.addControl(new runtime.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [runtime, styleUrl, center.lat, center.lng, presentation3d]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setPitch(presentation3d ? 55 : 0);
    map.setBearing(presentation3d ? 18 : 0);
  }, [presentation3d]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    teams
      .filter((team) => team.currentPosition)
      .forEach((team) => {
        const markerEl = document.createElement('div');
        markerEl.style.width = '14px';
        markerEl.style.height = '14px';
        markerEl.style.borderRadius = '999px';
        markerEl.style.border = '2px solid white';
        markerEl.style.background = '#2563eb';
        markerEl.title = team.name;

        const popup = new runtime.Popup({ offset: 12 }).setHTML(`<div style="font-family: var(--font-mono); font-size: 12px"><strong>${team.name}</strong></div>`);
        const marker = new runtime.Marker({ element: markerEl })
          .setLngLat([team.currentPosition!.lng, team.currentPosition!.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [teams, runtime]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || configuredLayers.length === 0) return;

    const onLoad = () => {
      configuredLayers.forEach((layer) => {
        const sourceId = `rkf-overlay-source-${layer.id}`;
        const layerId = `rkf-overlay-layer-${layer.id}`;
        const tileUrl = layerToTileUrl(layer.url, layer.token);

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
          });
        }

        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            minzoom: layer.minZoom ?? 0,
            maxzoom: layer.maxZoom ?? 22,
          });
        }
      });
    };

    map.on('load', onLoad);
    onLoad();

    return () => {
      map.off('load', onLoad);
    };
  }, [configuredLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;

    const lngs = points.map(([lng]) => lng);
    const lats = points.map(([, lat]) => lat);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
  }, [points]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} aria-label="MapLibre-kart" />;
}

export function EventMap({
  teams,
  center,
  provider = 'leaflet',
  presentation3d = false,
  mapRuntimeConfig,
}: EventMapProps) {
  const [mapLibreRuntime, setMapLibreRuntime] = useState<MapLibreModule | null>(null);
  const [mapLibreLoadAttempted, setMapLibreLoadAttempted] = useState(false);

  const mapCenter = center ?? NORWAY_CENTER;
  const requestedProvider = mapRuntimeConfig?.provider ?? provider;
  const configuredLayers = mapRuntimeConfig?.layers ?? [];
  const hasMapLibreRuntime = Boolean(mapLibreRuntime);
  const usingMapLibreFallback = requestedProvider === 'maplibre' && !hasMapLibreRuntime;
  const layerCount = configuredLayers.length;

  useEffect(() => {
    let cancelled = false;

    if (requestedProvider !== 'maplibre') {
      setMapLibreRuntime(null);
      setMapLibreLoadAttempted(false);
      return;
    }

    setMapLibreRuntime(getMapLibreRuntime());
    loadMapLibreRuntime().then((runtime) => {
      if (cancelled) return;
      setMapLibreRuntime(runtime);
      setMapLibreLoadAttempted(true);
    });

    return () => {
      cancelled = true;
    };
  }, [requestedProvider]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-subtle)',
        }}
      >
        <div>
          Kartmotor: <strong>{requestedProvider === 'maplibre' ? 'MapLibre' : 'Leaflet'}</strong>
          {layerCount > 0 && <> · Lag: <strong>{layerCount}</strong></>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {presentation3d && <span style={{ color: 'var(--color-brand)' }}>3D-presentasjon aktiv</span>}
          {usingMapLibreFallback && mapLibreLoadAttempted && <span style={{ color: 'var(--color-status-warning)' }}>MapLibre-runtime ikke tilgjengelig, bruker Leaflet-fallback</span>}
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {requestedProvider === 'maplibre' && hasMapLibreRuntime ? (
          <MapLibreCanvas
            teams={teams}
            center={mapCenter}
            runtime={mapLibreRuntime!}
            mapRuntimeConfig={mapRuntimeConfig}
            presentation3d={presentation3d}
          />
        ) : (
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={center ? 13 : 5}
            style={{ height: '100%', width: '100%' }}
            zoomControl
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {configuredLayers.map((layer) => (
              <TileLayer
                key={layer.id}
                attribution={layer.attribution}
                url={layerToTileUrl(layer.url, layer.token)}
                minZoom={layer.minZoom}
                maxZoom={layer.maxZoom}
                opacity={0.85}
              />
            ))}

            <BoundsFitter teams={teams} />

            {teams
              .filter((t) => t.currentPosition)
              .map((team) => (
                <Marker
                  key={team.id}
                  position={[team.currentPosition!.lat, team.currentPosition!.lng]}
                  icon={TEAM_ICON}
                >
                  <Popup>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{team.name}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
