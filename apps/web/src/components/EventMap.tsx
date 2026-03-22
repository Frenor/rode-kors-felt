import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

interface GeoPoint {
  lat: number;
  lng: number;
}

interface Incident {
  id: string;
  type: string;
  status: string;
  location: GeoPoint;
  createdAt: string;
  acvpu?: string;
  activeEscalation?: { path: string } | null;
}

interface Team {
  id: string;
  name: string;
  currentPosition?: GeoPoint;
}

interface EventMapProps {
  incidents: Incident[];
  teams: Team[];
  center?: GeoPoint;
  onIncidentClick: (incidentId: string) => void;
}

function incidentColor(incident: Incident): string {
  if (incident.activeEscalation) return '#dc2626'; // red
  if (incident.status === 'resolved') return '#6b7280'; // grey
  if (incident.status === 'transporting') return '#f59e0b'; // yellow
  return '#f97316'; // orange (on_scene / at_sickbay)
}

function makeIncidentIcon(incident: Incident) {
  const color = incidentColor(incident);
  const hasEscalation = !!incident.activeEscalation;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.33 14 22 14 22S28 23.33 28 14C28 6.27 21.73 0 14 0z" fill="${color}"/>
      ${hasEscalation
        ? `<text x="14" y="19" text-anchor="middle" font-size="14" fill="white" font-weight="bold">!</text>`
        : `<circle cx="14" cy="14" r="5" fill="white" opacity="0.8"/>`
      }
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

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

// Auto-fits map bounds to all visible markers
function BoundsFitter({ incidents, teams }: { incidents: Incident[]; teams: Team[] }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [
      ...incidents.map((i) => [i.location.lat, i.location.lng] as [number, number]),
      ...teams.filter((t) => t.currentPosition).map((t) => [t.currentPosition!.lat, t.currentPosition!.lng] as [number, number]),
    ];
    if (points.length > 0) {
      map.fitBounds(points, { padding: [32, 32], maxZoom: 15 });
    }
  }, [incidents, teams, map]);

  return null;
}

// Norway center fallback
const NORWAY_CENTER: GeoPoint = { lat: 64.5, lng: 17.5 };

export function EventMap({ incidents, teams, center, onIncidentClick }: EventMapProps) {
  const mapCenter = center ?? NORWAY_CENTER;
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');

  return (
    <MapContainer
      center={[mapCenter.lat, mapCenter.lng]}
      zoom={center ? 13 : 5}
      style={{ height: '100%', width: '100%', borderRadius: 'var(--radius-md)' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <BoundsFitter incidents={activeIncidents} teams={teams} />

      {incidents.map((incident) => (
        <Marker
          key={incident.id}
          position={[incident.location.lat, incident.location.lng]}
          icon={makeIncidentIcon(incident)}
          eventHandlers={{ click: () => onIncidentClick(incident.id) }}
        >
          <Popup>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 160 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {incident.type.toUpperCase()}
                {incident.activeEscalation && (
                  <span style={{ color: '#dc2626', marginLeft: 6 }}>
                    ⚠ ESKALERT
                  </span>
                )}
              </div>
              <div>Status: {incident.status}</div>
              {incident.acvpu && <div>ACVPU: {incident.acvpu}</div>}
              <div style={{ color: '#6b7280', marginTop: 4 }}>
                {new Date(incident.createdAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

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
  );
}
