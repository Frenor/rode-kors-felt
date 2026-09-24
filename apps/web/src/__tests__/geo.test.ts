import { describe, expect, it } from 'vitest';
import { bearingDegrees, compassPoint, describeOffset, distanceMeters, formatDistance, sortByDistance } from '../lib/geo';

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

  describe('sortByDistance (gap A10)', () => {
    // km 3 (near), km 12 (far), and an unknown position, seeded out of order.
    const near = { id: 'near', lat: HERE.lat + 0.001, lon: HERE.lng };
    const far = { id: 'far', lat: HERE.lat + 0.02, lon: HERE.lng };
    const unknown = { id: 'unknown', lat: null, lon: null };

    it('sorts nearest first from the given position', () => {
      const sorted = sortByDistance([far, near], HERE);
      expect(sorted.map((p) => p.id)).toEqual(['near', 'far']);
    });

    it('puts patients without a position last, keeping their relative order', () => {
      const unknown2 = { id: 'unknown2', lat: null, lon: null };
      const sorted = sortByDistance([unknown, far, near, unknown2], HERE);
      expect(sorted.map((p) => p.id)).toEqual(['near', 'far', 'unknown', 'unknown2']);
    });

    it('leaves the original order untouched when the phone has no GPS fix', () => {
      const items = [far, near, unknown];
      expect(sortByDistance(items, null)).toBe(items);
    });
  });
});
