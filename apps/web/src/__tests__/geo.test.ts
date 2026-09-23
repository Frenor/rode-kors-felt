import { describe, expect, it } from 'vitest';
import { bearingDegrees, compassPoint, describeOffset, distanceMeters, formatDistance } from '../lib/geo';

// Holmenkollen area — the demo event.
const HERE = { lat: 59.9645, lng: 10.666 };

describe('geo helpers', () => {
  it('measures distance with haversine', () => {
    // ~0.001° latitude ≈ 111 m
    const north = { lat: HERE.lat + 0.001, lng: HERE.lng };
    expect(distanceMeters(HERE, north)).toBeGreaterThan(105);
    expect(distanceMeters(HERE, north)).toBeLessThan(117);
    expect(distanceMeters(HERE, HERE)).toBe(0);
  });

  it('computes bearings in degrees, not radians-as-degrees', () => {
    const north = { lat: HERE.lat + 0.002, lng: HERE.lng };
    const east = { lat: HERE.lat, lng: HERE.lng + 0.002 };
    const south = { lat: HERE.lat - 0.002, lng: HERE.lng };
    expect(Math.round(bearingDegrees(HERE, north))).toBe(0);
    expect(Math.round(bearingDegrees(HERE, east))).toBe(90);
    expect(Math.round(bearingDegrees(HERE, south))).toBe(180);
    expect(compassPoint(bearingDegrees(HERE, east))).toBe('Ø');
    expect(compassPoint(bearingDegrees(HERE, south))).toBe('S');
  });

  it('rounds distances so they read at a glance', () => {
    expect(formatDistance(42)).toBe('≈ 40 m');
    expect(formatDistance(347)).toBe('≈ 350 m');
    expect(formatDistance(1234)).toBe('≈ 1,2 km');
    expect(formatDistance(-1)).toBe('');
  });

  it('describes the offset only when both positions are known', () => {
    expect(describeOffset(null, HERE)).toBe('');
    expect(describeOffset(HERE, null)).toBe('');
    expect(describeOffset(HERE, { lat: HERE.lat, lng: HERE.lng + 0.005 })).toMatch(/^≈ \d+ m Ø$/);
  });
});
