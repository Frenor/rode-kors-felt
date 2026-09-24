/**
 * PatientLocationRow
 *
 * Displays a patient's position (text or coordinates), how far away it is
 * from the patrol ("≈ 350 m NØ") and a "Naviger hit" button that opens
 * Google Maps navigation. Shared between the own-patient accordion and the
 * unassigned-patient card inside FirstAiderDashboard.
 */
import { describeOffset, type LatLng } from '../../lib/geo';
import { Button, Icon } from '../../components/ui';

export type GeoPosition = LatLng;

export interface PatientLocationRowProps {
  positionText: string | null;
  lat: number | null;
  lon: number | null;
  gpsPosition: GeoPosition | null;
  onNavigate: (lat: number, lon: number) => void;
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

  const offset = hasCoords ? describeOffset(gpsPosition, { lat: lat!, lng: lon! }) : '';
  const where = positionText ?? (hasCoords ? `${lat!.toFixed(4)}, ${lon!.toFixed(4)}` : '');

  return (
    <div
      data-testid="patient-location-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
      }}
    >
      <Icon name="pin" style={{ color: 'var(--color-text-muted)' }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          {where}
        </span>
        {offset && (
          <span
            data-testid="patient-location-offset"
            className="data"
            style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-muted)' }}
          >
            {offset} fra deg
          </span>
        )}
      </span>
      {hasCoords && (
        <Button variant="outline" size="md" icon="navigate" onClick={() => onNavigate(lat!, lon!)} style={{ flexShrink: 0 }}>
          Naviger hit
        </Button>
      )}
    </div>
  );
}
