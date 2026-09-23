import { describe, expect, it } from 'vitest';
import { patientNumber } from '../lib/patient-number';

describe('patientNumber', () => {
  it('formats a numeric seq as "#<n>"', () => {
    expect(patientNumber({ seq: 12 })).toBe('#12');
    expect(patientNumber({ seq: 1 })).toBe('#1');
    expect(patientNumber({ seq: 0 })).toBe('#0');
  });

  it('returns null when seq is missing or null', () => {
    expect(patientNumber({ seq: null })).toBeNull();
    expect(patientNumber({})).toBeNull();
    expect(patientNumber({ seq: undefined })).toBeNull();
  });
});
