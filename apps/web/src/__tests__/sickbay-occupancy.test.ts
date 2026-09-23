/**
 * Occupancy strip math and free-number quick picks (gap B6/B3 / item 8.30).
 */
import { describe, expect, it } from 'vitest';
import { computeSickbayOccupancy, freeSickbayNumbers, TRANSPORT_NEED_LABELS } from '../lib/constants';

describe('computeSickbayOccupancy', () => {
  it('counts open patients placed in each type against configured capacity', () => {
    const openPatients = [
      { placementType: 'chair' as const, placementNumber: '3' },
      { placementType: 'chair' as const, placementNumber: '7' },
      { placementType: 'bed' as const, placementNumber: '2' },
    ];
    const result = computeSickbayOccupancy({ chairs: 16, beds: 4 }, openPatients);
    expect(result.chairs).toEqual({ occupied: 2, total: 16 });
    expect(result.beds).toEqual({ occupied: 1, total: 4 });
  });

  it('never invents a denominator — null per type when settings are missing entirely', () => {
    const result = computeSickbayOccupancy(undefined, [{ placementType: 'chair', placementNumber: '1' }]);
    expect(result.chairs).toBeNull();
    expect(result.beds).toBeNull();
  });

  it('returns null only for the type without configured capacity', () => {
    const result = computeSickbayOccupancy({ chairs: 10 }, [{ placementType: 'chair', placementNumber: '1' }]);
    expect(result.chairs).toEqual({ occupied: 1, total: 10 });
    expect(result.beds).toBeNull();
  });

  it('ignores a placement with a type but no number, and patients with no placement', () => {
    const openPatients = [
      { placementType: 'chair' as const, placementNumber: '' },
      { placementType: null, placementNumber: null },
      { placementType: undefined, placementNumber: undefined },
    ];
    const result = computeSickbayOccupancy({ chairs: 5, beds: 5 }, openPatients);
    expect(result.chairs).toEqual({ occupied: 0, total: 5 });
    expect(result.beds).toEqual({ occupied: 0, total: 5 });
  });

  it('treats chairs: 0 as configured capacity, not "missing"', () => {
    const result = computeSickbayOccupancy({ chairs: 0 }, []);
    expect(result.chairs).toEqual({ occupied: 0, total: 0 });
  });
});

describe('freeSickbayNumbers', () => {
  it('returns the lowest free numbers for the type, up to the limit', () => {
    const openPatients = [
      { placementType: 'chair' as const, placementNumber: '1' },
      { placementType: 'chair' as const, placementNumber: '2' },
      { placementType: 'chair' as const, placementNumber: '4' },
      { placementType: 'bed' as const, placementNumber: '1' },
    ];
    expect(freeSickbayNumbers('chair', openPatients, 4)).toEqual([3, 5, 6, 7]);
  });

  it('ignores placements of the other type', () => {
    const openPatients = [{ placementType: 'bed' as const, placementNumber: '1' }];
    expect(freeSickbayNumbers('chair', openPatients, 3)).toEqual([1, 2, 3]);
  });

  it('defaults to 6 chips', () => {
    expect(freeSickbayNumbers('chair', [])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('ignores a non-numeric placement number', () => {
    const openPatients = [{ placementType: 'chair' as const, placementNumber: 'x' }];
    expect(freeSickbayNumbers('chair', openPatients, 2)).toEqual([1, 2]);
  });
});

describe('TRANSPORT_NEED_LABELS', () => {
  it('labels every transport need in Norwegian', () => {
    expect(TRANSPORT_NEED_LABELS.stretcher).toBe('Båre');
    expect(TRANSPORT_NEED_LABELS.atv).toBe('ATV');
    expect(TRANSPORT_NEED_LABELS.ambulance).toBe('Ambulanse');
  });
});
