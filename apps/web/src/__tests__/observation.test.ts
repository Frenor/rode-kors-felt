import { describe, expect, it } from 'vitest';
import {
  describeObservationDue,
  formatRelativeAge,
  nextObservationDue,
  observationPriority,
} from '../lib/observation';

const NOW = new Date('2026-09-23T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe('nextObservationDue', () => {
  it('returns none without vitals', () => {
    expect(nextObservationDue(null, NOW)).toEqual({ kind: 'none' });
    expect(nextObservationDue(undefined, NOW)).toEqual({ kind: 'none' });
  });

  it('is continuous for NEWS2 ≥ 7', () => {
    // RR 30 (3) + SpO2 90 (3) + pulse 135 (3) = 9
    const due = nextObservationDue({ timestamp: minutesAgo(5), respiratoryRate: 30, spo2: 90, pulse: 135 }, NOW);
    expect(due.kind).toBe('continuous');
    expect(describeObservationDue(due)).toBe('Kontinuerlig overvåkning');
  });

  it('is due in the remaining minutes of a 1-hour interval for NEWS2 5–6', () => {
    // RR 23 (2) + SpO2 93 (2) + pulse 115 (2) = 6 → 60 min interval
    const due = nextObservationDue({ timestamp: minutesAgo(48), respiratoryRate: 23, spo2: 93, pulse: 115 }, NOW);
    expect(due.kind).toBe('due');
    if (due.kind !== 'due') throw new Error('unreachable');
    expect(due.minutesLeft).toBe(12);
    expect(describeObservationDue(due)).toMatch(/^Neste vurdering kl\. \d{2}:\d{2} \(om 12 min\)$/);
  });

  it('is overdue once the interval has passed', () => {
    // NEWS2 1 (pulse 95) → 6-hour interval, recorded 6 h 5 min ago
    const due = nextObservationDue({ timestamp: minutesAgo(365), pulse: 95 }, NOW);
    expect(due.kind).toBe('overdue');
    if (due.kind !== 'overdue') throw new Error('unreachable');
    expect(due.minutesOverdue).toBe(5);
    expect(describeObservationDue(due)).toMatch(/^Forfalt for 5 min \(skulle vært kl\. \d{2}:\d{2}\)$/);
  });

  it('orders overdue before continuous before due before none', () => {
    const overdue = nextObservationDue({ timestamp: minutesAgo(365), pulse: 95 }, NOW);
    const continuous = nextObservationDue({ timestamp: minutesAgo(5), respiratoryRate: 30, spo2: 90, pulse: 135 }, NOW);
    const due = nextObservationDue({ timestamp: minutesAgo(10), pulse: 95 }, NOW);
    const none = nextObservationDue(null, NOW);
    const sorted = [none, due, continuous, overdue].sort((a, b) => observationPriority(a) - observationPriority(b));
    expect(sorted.map((d) => d.kind)).toEqual(['overdue', 'continuous', 'due', 'none']);
  });
});

describe('formatRelativeAge', () => {
  it('formats minutes and hours in Norwegian', () => {
    expect(formatRelativeAge(minutesAgo(0), NOW)).toBe('nå');
    expect(formatRelativeAge(minutesAgo(3), NOW)).toBe('for 3 min siden');
    expect(formatRelativeAge(minutesAgo(65), NOW)).toBe('for 1 t 5 min siden');
    expect(formatRelativeAge(minutesAgo(120), NOW)).toBe('for 2 t siden');
    expect(formatRelativeAge(null, NOW)).toBe('');
    expect(formatRelativeAge('not-a-date', NOW)).toBe('');
  });
});
