import { describe, expect, it } from 'vitest';
import { describeTransportStatus } from '../pages/FirstAider/transport-status';

describe('describeTransportStatus (gap B3 / item 8.26)', () => {
  it('returns null when nothing has been requested', () => {
    expect(describeTransportStatus({
      transportNeed: null,
      transportRequestedAt: null,
      transportTeamId: null,
      transportTeam: null,
    })).toBeNull();
  });

  it('warning pill with time while requested and unassigned', () => {
    const result = describeTransportStatus({
      transportNeed: 'atv',
      transportRequestedAt: '2026-09-23T11:41:00.000Z',
      transportTeamId: null,
      transportTeam: null,
    });
    expect(result?.tone).toBe('warning');
    expect(result?.text).toMatch(/^Transport bedt om: ATV · kl\. \d{2}:\d{2}$/);
  });

  it('omits the time when requestedAt is unknown', () => {
    const result = describeTransportStatus({
      transportNeed: 'stretcher',
      transportRequestedAt: null,
      transportTeamId: null,
      transportTeam: null,
    });
    expect(result?.text).toBe('Transport bedt om: Båre');
  });

  it('info pill with team name and vehicle once assigned', () => {
    const result = describeTransportStatus({
      transportNeed: 'atv',
      transportRequestedAt: '2026-09-23T11:41:00.000Z',
      transportTeamId: 'team-delta',
      transportTeam: { name: 'Delta', transport: 'atv' },
    });
    expect(result).toEqual({ text: 'Delta (ATV) på vei', tone: 'info' });
  });

  it('omits the parenthesised vehicle when the team has none on record', () => {
    const result = describeTransportStatus({
      transportNeed: 'ambulance',
      transportRequestedAt: null,
      transportTeamId: 'team-delta',
      transportTeam: { name: 'Delta' },
    });
    expect(result?.text).toBe('Delta på vei');
  });

  it('falls back to "Ukjent lag" when the assigned team cannot be found', () => {
    const result = describeTransportStatus({
      transportNeed: 'ambulance',
      transportRequestedAt: null,
      transportTeamId: 'team-ghost',
      transportTeam: null,
    });
    expect(result?.text).toBe('Ukjent lag på vei');
  });
});
