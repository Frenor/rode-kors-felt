import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
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

interface PatientPin {
  id: string;
  label: string | null;
  triageStatus: string | null;
  lat: number;
  lon: number;
  seqNum: number;
  closed?: boolean;
}

interface EventMapProps {
  teams: Team[];
  center?: GeoPoint;
  provider?: 'leaflet' | 'maplibre';
  presentation3d?: boolean;
  mapRuntimeConfig?: MapRuntimeConfig | null;
  /** Per-team per-member live positions: teamId → memberId → GeoPoint */
  memberPositions?: Record<string, Record<string, GeoPoint>>;
  /** Active patient pins to render on the map */
  patients?: Array<{ id: string; label: string | null; triageStatus: string | null; lat: number | null; lon: number | null; status?: string | null }>;
  /** When set, the map enters picking mode — clicking the map calls this handler */
  onMapClick?: ((lat: number, lng: number) => void) | null;
  /** Called when the user cancels picking mode */
  onCancelPick?: () => void;
}

// ── Utility helpers ────────────────────────────────────────────────────────────

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function haversineMeters(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6_371_000;
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Cluster radius in metres based on zoom — returns 0 to always show all */
function clusterRadiusForZoom(zoom: number): number {
  if (zoom >= 17) return 0;
  if (zoom >= 15) return 20;
  if (zoom >= 14) return 50;
  if (zoom >= 13) return 100;
  return 200;
}

function centroid(points: GeoPoint[]): GeoPoint {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

interface TeamMarkerData {
  key: string;
  lat: number;
  lng: number;
  label: string;
}

function getTeamMarkers(
  team: Team,
  memberPos: Record<string, GeoPoint> | undefined,
  zoom: number,
): TeamMarkerData[] {
  const members = memberPos ? Object.entries(memberPos) : [];
  const positions: GeoPoint[] =
    members.length > 0
      ? members.map(([, p]) => p)
      : team.currentPosition
        ? [team.currentPosition]
        : [];

  if (positions.length === 0) return [];

  const radius = clusterRadiusForZoom(zoom);

  if (radius === 0 || positions.length <= 1) {
    return positions.map((pos, i) => ({
      key: `${team.id}-${i}`,
      lat: pos.lat,
      lng: pos.lng,
      label: positions.length > 1 ? `${team.name} ${i + 1}` : team.name,
    }));
  }

  const c = centroid(positions);
  const allClose = positions.every((p) => haversineMeters(c, p) <= radius);

  if (allClose) {
    const cnt = c;
    return [
      {
        key: team.id,
        lat: cnt.lat,
        lng: cnt.lng,
        label: positions.length > 1 ? `${team.name} (${positions.length})` : team.name,
      },
    ];
  }

  return positions.map((pos, i) => ({
    key: `${team.id}-${i}`,
    lat: pos.lat,
    lng: pos.lng,
    label: `${team.name} ${i + 1}`,
  }));
}

// ── Leaflet icons ──────────────────────────────────────────────────────────────

function makeTeamIcon(label: string): L.DivIcon {
  const safe = esc(label);
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
      <div style="white-space:nowrap;background:rgba(30,58,138,.92);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.35);margin-bottom:2px;font-family:sans-serif">${safe}</div>
      <div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>
    </div>`,
    className: '',
    iconSize: [120, 36],
    iconAnchor: [60, 36],
    popupAnchor: [0, -38],
  });
}

const TRIAGE_MARKER_BG: Record<string, string> = {
  red: '#dc2626',
  yellow: '#ca8a04',
  green: '#16a34a',
  black: '#1e293b',
};

function makePatientIcon(seqNum: number, triageStatus: string | null): L.DivIcon {
  const bg = TRIAGE_MARKER_BG[triageStatus ?? ''] ?? '#64748b';
  const label = `P${seqNum}`;
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
      <div style="width:28px;height:22px;border-radius:4px;background:${bg};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;font-family:monospace">${label}</div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg}"></div>
    </div>`,
    className: '',
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -36],
  });
}

// ── Leaflet sub-components ─────────────────────────────────────────────────────

function BoundsFitter({ teams, memberPositions }: { teams: Team[]; memberPositions?: Record<string, Record<string, GeoPoint>> }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = teams.flatMap((t) => {
      const members = memberPositions?.[t.id];
      if (members && Object.keys(members).length > 0) {
        return Object.values(members).map((p) => [p.lat, p.lng] as [number, number]);
      }
      return t.currentPosition ? [[t.currentPosition.lat, t.currentPosition.lng]] : [];
    });
    if (points.length > 0) {
      map.fitBounds(points, { padding: [32, 32], maxZoom: 15 });
    }
  }, [teams, memberPositions, map]);

  return null;
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

function MapClickHandler({
  active,
  onMapClick,
}: {
  active: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    click: (e) => {
      if (active) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = active ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [map, active]);

  return null;
}

function LeafletTeamMarkers({
  teams,
  memberPositions,
  zoom,
}: {
  teams: Team[];
  memberPositions?: Record<string, Record<string, GeoPoint>>;
  zoom: number;
}) {
  const markers = useMemo(
    () =>
      teams.flatMap((team) =>
        getTeamMarkers(team, memberPositions?.[team.id], zoom),
      ),
    [teams, memberPositions, zoom],
  );

  return (
    <>
      {markers.map((m) => (
        <Marker key={m.key} position={[m.lat, m.lng]} icon={makeTeamIcon(m.label)}>
          <Popup>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
              {m.label}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function LeafletPatientMarkers({ patients }: { patients: PatientPin[] }) {
  return (
    <>
      {patients.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lon]}
          icon={makePatientIcon(p.seqNum, p.triageStatus)}
        >
          <Popup>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <div style={{ fontWeight: 700 }}>{p.label ?? `Pasient ${p.seqNum}`}</div>
              {p.triageStatus && (
                <div style={{ marginTop: 2, textTransform: 'capitalize' }}>{p.triageStatus}</div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// ── MapLibre types ────────────────────────────────────────────────────────────

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
  getZoom: () => number;
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

// ── MapLibre canvas ────────────────────────────────────────────────────────────

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
  memberPositions,
  patients,
  onMapClick,
}: {
  teams: Team[];
  center: GeoPoint;
  runtime: MapLibreModule;
  mapRuntimeConfig?: MapRuntimeConfig | null;
  presentation3d: boolean;
  memberPositions?: Record<string, Record<string, GeoPoint>>;
  patients?: PatientPin[];
  onMapClick?: ((lat: number, lng: number) => void) | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const teamMarkersRef = useRef<MapLibreMarker[]>([]);
  const patientMarkersRef = useRef<MapLibreMarker[]>([]);
  const [zoom, setZoom] = useState(13);

  const styleUrl = mapRuntimeConfig?.styleUrl ?? 'https://demotiles.maplibre.org/style.json';
  const configuredLayers = mapRuntimeConfig?.layers ?? [];

  const points = useMemo(() => {
    return teams.flatMap((team) => {
      const members = memberPositions?.[team.id];
      if (members && Object.keys(members).length > 0) {
        return Object.values(members).map((p) => [p.lng, p.lat] as [number, number]);
      }
      return team.currentPosition
        ? [[team.currentPosition.lng, team.currentPosition.lat] as [number, number]]
        : [];
    });
  }, [teams, memberPositions]);

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
    map.on('zoom', () => setZoom(map.getZoom()));
    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      teamMarkersRef.current = [];
      patientMarkersRef.current = [];
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

    const clickHandler = (e: any) => {
      if (onMapClick) onMapClick(e.lngLat.lat, e.lngLat.lng);
    };
    map.on('click', clickHandler);
    const container = containerRef.current;
    if (container) container.style.cursor = onMapClick ? 'crosshair' : '';
    return () => {
      map.off('click', clickHandler);
      if (container) container.style.cursor = '';
    };
  }, [onMapClick]);

  // Team markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    teamMarkersRef.current.forEach((m) => m.remove());
    teamMarkersRef.current = [];

    const markers = teams.flatMap((team) =>
      getTeamMarkers(team, memberPositions?.[team.id], zoom),
    );

    markers.forEach((m) => {
      const el = document.createElement('div');
      el.style.cssText =
        'display:flex;flex-direction:column;align-items:center;pointer-events:auto';
      el.innerHTML = `<div style="white-space:nowrap;background:rgba(30,58,138,.92);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.35);margin-bottom:2px;font-family:sans-serif">${esc(m.label)}</div><div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`;

      const popup = new runtime.Popup({ offset: 20 }).setHTML(
        `<div style="font-family:sans-serif;font-size:12px;font-weight:700">${esc(m.label)}</div>`,
      );
      const marker = new runtime.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([m.lng, m.lat])
        .setPopup(popup)
        .addTo(map);

      teamMarkersRef.current.push(marker);
    });

    return () => {
      teamMarkersRef.current.forEach((m) => m.remove());
      teamMarkersRef.current = [];
    };
  }, [teams, memberPositions, zoom, runtime]);

  // Patient markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    patientMarkersRef.current.forEach((m) => m.remove());
    patientMarkersRef.current = [];

    (patients ?? []).forEach((p) => {
      const bg = TRIAGE_MARKER_BG[p.triageStatus ?? ''] ?? '#64748b';
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:auto';
      el.innerHTML = `<div style="width:28px;height:22px;border-radius:4px;background:${bg};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;font-family:monospace">P${p.seqNum}</div><div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg}"></div>`;

      const popup = new runtime.Popup({ offset: 20 }).setHTML(
        `<div style="font-family:sans-serif;font-size:12px;font-weight:700">${esc(p.label ?? `Pasient ${p.seqNum}`)}</div>`,
      );
      const marker = new runtime.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([p.lon, p.lat])
        .setPopup(popup)
        .addTo(map);

      patientMarkersRef.current.push(marker);
    });

    return () => {
      patientMarkersRef.current.forEach((m) => m.remove());
      patientMarkersRef.current = [];
    };
  }, [patients, runtime]);

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

// ── Root export ────────────────────────────────────────────────────────────────

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

const NORWAY_CENTER: GeoPoint = { lat: 64.5, lng: 17.5 };

const CLOSED_STATUSES = new Set(['discharged', 'transferred']);

export function EventMap({
  teams,
  center,
  provider = 'leaflet',
  presentation3d = false,
  mapRuntimeConfig,
  memberPositions,
  patients,
  onMapClick,
  onCancelPick,
}: EventMapProps) {
  const [mapLibreRuntime, setMapLibreRuntime] = useState<MapLibreModule | null>(null);
  const [mapLibreLoadAttempted, setMapLibreLoadAttempted] = useState(false);
  const [zoom, setZoom] = useState(5);

  const mapCenter = center ?? NORWAY_CENTER;
  const requestedProvider = mapRuntimeConfig?.provider ?? provider;
  const configuredLayers = mapRuntimeConfig?.layers ?? [];
  const hasMapLibreRuntime = Boolean(mapLibreRuntime);
  const usingMapLibreFallback = requestedProvider === 'maplibre' && !hasMapLibreRuntime;
  const layerCount = configuredLayers.length;
  const isPicking = Boolean(onMapClick);

  const patientPins = useMemo<PatientPin[]>(() => {
    if (!patients) return [];
    const active = patients.filter(
      (p) => p.lat != null && p.lon != null && !CLOSED_STATUSES.has(p.status ?? ''),
    );
    return active.map((p, i) => ({
      id: p.id,
      label: p.label,
      triageStatus: p.triageStatus,
      lat: p.lat!,
      lon: p.lon!,
      seqNum: i + 1,
    }));
  }, [patients]);

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
          {usingMapLibreFallback && mapLibreLoadAttempted && (
            <span style={{ color: 'var(--color-status-warning)' }}>
              MapLibre-runtime ikke tilgjengelig, bruker Leaflet-fallback
            </span>
          )}
        </div>
      </div>

      {isPicking && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px var(--space-3)',
            background: '#1d4ed8',
            color: '#fff',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            gap: 'var(--space-2)',
          }}
        >
          <span>📍 Klikk i kartet for å sette pasientposisjon</span>
          {onCancelPick && (
            <button
              type="button"
              onClick={onCancelPick}
              style={{
                padding: '2px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255,255,255,.5)',
                background: 'transparent',
                color: '#fff',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
          )}
        </div>
      )}

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {requestedProvider === 'maplibre' && hasMapLibreRuntime ? (
          <MapLibreCanvas
            teams={teams}
            center={mapCenter}
            runtime={mapLibreRuntime!}
            mapRuntimeConfig={mapRuntimeConfig}
            presentation3d={presentation3d}
            memberPositions={memberPositions}
            patients={patientPins}
            onMapClick={onMapClick}
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

            <BoundsFitter teams={teams} memberPositions={memberPositions} />
            <ZoomTracker onZoom={setZoom} />
            {onMapClick && (
              <MapClickHandler active={isPicking} onMapClick={onMapClick} />
            )}

            <LeafletTeamMarkers
              teams={teams}
              memberPositions={memberPositions}
              zoom={zoom}
            />
            <LeafletPatientMarkers patients={patientPins} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}
