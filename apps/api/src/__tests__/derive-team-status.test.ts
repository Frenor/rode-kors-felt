import { describe, expect, it } from 'vitest';
import type { TeamPatientStatus } from '@rkf/shared-types';
import { deriveTeamOperationalStatus } from '../routes/teams.js';

function makeMap(entries: Array<[string, TeamPatientStatus]>): Map<string, TeamPatientStatus> {
  return new Map(entries);
}

describe('deriveTeamOperationalStatus', () => {
  it('returns available when no patients are engaged', () => {
    expect(deriveTeamOperationalStatus('available', makeMap([]))).toBe('available');
  });

  it('returns en_route when only en_route_to_patient status exists', () => {
    expect(deriveTeamOperationalStatus('available', makeMap([['p1', 'en_route_to_patient']]))).toBe('en_route');
  });

  it('returns on_scene when a patient has monitoring status', () => {
    expect(deriveTeamOperationalStatus('available', makeMap([['p1', 'monitoring']]))).toBe('on_scene');
  });

  it('returns on_scene when a patient has transporting status', () => {
    expect(deriveTeamOperationalStatus('available', makeMap([['p1', 'transporting']]))).toBe('on_scene');
  });

  it('on_scene wins over en_route when both exist across different patients', () => {
    expect(
      deriveTeamOperationalStatus(
        'available',
        makeMap([['p1', 'en_route_to_patient'], ['p2', 'monitoring']]),
      ),
    ).toBe('on_scene');
  });

  it('returns available when all patients are cleared from on_scene', () => {
    expect(deriveTeamOperationalStatus('on_scene', makeMap([]))).toBe('available');
  });

  it('never overrides needs_assistance regardless of patient statuses', () => {
    expect(deriveTeamOperationalStatus('needs_assistance', makeMap([]))).toBe('needs_assistance');
    expect(
      deriveTeamOperationalStatus('needs_assistance', makeMap([['p1', 'en_route_to_patient']])),
    ).toBe('needs_assistance');
    expect(
      deriveTeamOperationalStatus('needs_assistance', makeMap([['p1', 'monitoring']])),
    ).toBe('needs_assistance');
  });

  it('never overrides unavailable regardless of patient statuses', () => {
    expect(deriveTeamOperationalStatus('unavailable', makeMap([]))).toBe('unavailable');
    expect(
      deriveTeamOperationalStatus('unavailable', makeMap([['p1', 'transporting']])),
    ).toBe('unavailable');
  });

  it('transitions from en_route to on_scene when a second patient gains monitoring', () => {
    const map = makeMap([['p1', 'en_route_to_patient'], ['p2', 'monitoring']]);
    expect(deriveTeamOperationalStatus('en_route', map)).toBe('on_scene');
  });

  it('transitions back to en_route when only en_route patient remains after clearing monitoring', () => {
    const map = makeMap([['p1', 'en_route_to_patient']]);
    expect(deriveTeamOperationalStatus('on_scene', map)).toBe('en_route');
  });
});
