/**
 * Small geodesy helpers for the field UI.
 *
 * A patrol on foot wants "≈ 350 m NØ", not a coordinate pair. Both functions
 * work in radians internally; the previous bearing implementation fed degrees
 * straight into Math.sin/Math.cos and produced a random compass direction.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(from: LatLng, to: LatLng): number {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from `from` to `to` in degrees [0, 360). */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const dλ = toRad(to.lng - from.lng);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_POINTS = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'] as const;

/** Eight-point compass label (Norwegian) for a bearing in degrees. */
export function compassPoint(bearing: number): string {
  return COMPASS_POINTS[Math.round(bearing / 45) % 8]!;
}

/** "≈ 80 m", "≈ 350 m", "≈ 1,2 km" — rounded so it reads at a glance. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 100) return `≈ ${Math.round(meters / 10) * 10} m`;
  if (meters < 1000) return `≈ ${Math.round(meters / 50) * 50} m`;
  return `≈ ${(meters / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km`;
}

/** "≈ 350 m NØ" when both positions are known, otherwise ''. */
export function describeOffset(from: LatLng | null, to: LatLng | null): string {
  if (!from || !to) return '';
  const distance = formatDistance(distanceMeters(from, to));
  if (!distance) return '';
  return `${distance} ${compassPoint(bearingDegrees(from, to))}`;
}
