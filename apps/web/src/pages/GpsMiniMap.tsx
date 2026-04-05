import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
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
  interactive?: boolean;
  onPositionChange?: (position: { lat: number; lng: number }) => void;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);

  return null;
}

function ClickToSetMarker({
  onPositionChange,
}: {
  onPositionChange: (position: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click: (event) => {
      onPositionChange({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return null;
}

export default function GpsMiniMap({
  lat,
  lng,
  interactive = false,
  onPositionChange,
}: GpsMiniMapProps) {
  const canInteract = interactive && typeof onPositionChange === 'function';

  return (
    <div
      data-testid={canInteract ? 'incident-location-editor-map' : 'incident-location-preview-map'}
      style={{ height: 150, borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: 4 }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: '100%', width: '100%', pointerEvents: canInteract ? 'auto' : 'none' }}
        zoomControl={canInteract}
        attributionControl={false}
        scrollWheelZoom={canInteract}
        dragging={canInteract}
        doubleClickZoom={canInteract}
      >
        <RecenterMap lat={lat} lng={lng} />
        {canInteract ? <ClickToSetMarker onPositionChange={onPositionChange} /> : null}
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker
          position={[lat, lng]}
          icon={PIN_ICON}
          draggable={canInteract}
          eventHandlers={
            canInteract
              ? {
                  dragend: (event) => {
                    const marker = event.target;
                    const position = marker.getLatLng();
                    onPositionChange({
                      lat: position.lat,
                      lng: position.lng,
                    });
                  },
                }
              : undefined
          }
        />
      </MapContainer>
    </div>
  );
}
