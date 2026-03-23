import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Minimal SVG pin icon
const PIN_ICON = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
    <ellipse cx="10" cy="27" rx="4" ry="2" fill="rgba(0,0,0,0.2)"/>
    <path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18S20 17.5 20 10C20 4.5 15.5 0 10 0z" fill="#e8112d"/>
    <circle cx="10" cy="10" r="4" fill="white"/>
  </svg>`,
  iconSize: [20, 28],
  iconAnchor: [10, 28],
  className: '',
});

interface GpsMiniMapProps {
  lat: number;
  lng: number;
}

export default function GpsMiniMap({ lat, lng }: GpsMiniMapProps) {
  return (
    <div style={{ height: 150, borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: 4 }}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: '100%', width: '100%', pointerEvents: 'none' }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={PIN_ICON} />
      </MapContainer>
    </div>
  );
}
