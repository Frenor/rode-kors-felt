/**
 * PatientLocationRow
 *
 * Displays a patient's position (text or coordinates) and a "Naviger hit"
 * button that opens Google Maps navigation. Shared between the own-patient
 * accordion and the unassigned-patient card inside FirstAiderDashboard.
 */

export interface GeoPosition {
  lat: number;
  lng: number;
}

export interface PatientLocationRowProps {
  positionText: string | null;
  lat: number | null;
  lon: number | null;
  gpsPosition: GeoPosition | null;
  onNavigate: (lat: number, lon: number) => void;
}

export function bearingTo(
  gpsPosition: GeoPosition | null,
  lat: number,
  lng: number,
): string {
  if (!gpsPosition) return '';
  const dLng = lng - gpsPosition.lng;
  const y = Math.sin(dLng) * Math.cos((lat * Math.PI) / 180);
  const x =
    Math.cos((gpsPosition.lat * Math.PI) / 180) * Math.sin((lat * Math.PI) / 180) -
    Math.sin((gpsPosition.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.cos(dLng);
  const brng = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
  return dirs[Math.round(brng / 45) % 8]!;
}

export function PatientLocationRow({
  positionText,
  lat,
  lon,
  gpsPosition,
  onNavigate,
}: PatientLocationRowProps) {
  const hasCoords = lat != null && lon != null;
  if (!positionText && !hasCoords) return null;

  const bearing = gpsPosition && hasCoords ? ` · ${bearingTo(gpsPosition, lat!, lon!)}` : '';
  const label = positionText
    ? `📍 ${positionText}`
    : `📍 ${lat!.toFixed(4)}, ${lon!.toFixed(4)}${bearing}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-subtle)',
          flex: 1,
        }}
      >
        {label}
      </span>
      {hasCoords && (
        <button
          onClick={() => onNavigate(lat!, lon!)}
          className="touch-target"
          style={{
            minHeight: 36,
            padding: '0 var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-brand)',
            background: 'transparent',
            color: 'var(--color-brand)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Naviger hit
        </button>
      )}
    </div>
  );
}
