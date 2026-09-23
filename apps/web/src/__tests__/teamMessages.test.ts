/**
 * mergeTeamMessages — chat history seeding + de-dup (gap B9 / item 8.29).
 */
import { describe, expect, it } from 'vitest';
import { mergeTeamMessages } from '../pages/Coordinator/teamMessages';
import type { TeamMessage } from '../lib/types';

function msg(overrides: Partial<TeamMessage>): TeamMessage {
  return { id: 'm', text: 'hei', sentAt: '2026-09-23T12:00:00Z', ...overrides };
}

describe('mergeTeamMessages', () => {
  it('seeds an empty list, newest first', () => {
    const seed: TeamMessage[] = [
      msg({ id: 'm1', sentAt: '2026-09-23T12:00:00Z' }),
      msg({ id: 'm2', sentAt: '2026-09-23T12:05:00Z' }),
      msg({ id: 'm3', sentAt: '2026-09-23T11:58:00Z' }),
    ];
    const merged = mergeTeamMessages([], seed);
    expect(merged.map((m) => m.id)).toEqual(['m2', 'm1', 'm3']);
  });

  it('does not duplicate a message already present by id', () => {
    const existing = [msg({ id: 'm1', sentAt: '2026-09-23T12:00:00Z' })];
    const merged = mergeTeamMessages(existing, [msg({ id: 'm1', sentAt: '2026-09-23T12:00:00Z', text: 'different text' })]);
    expect(merged).toHaveLength(1);
    // The original wins — a duplicate id never overwrites what is already shown.
    expect(merged[0]?.text).toBe('hei');
  });

  it('folds a live message into seeded history without disturbing order', () => {
    const existing = [
      msg({ id: 'm2', sentAt: '2026-09-23T12:05:00Z' }),
      msg({ id: 'm1', sentAt: '2026-09-23T12:00:00Z' }),
    ];
    const merged = mergeTeamMessages(existing, [msg({ id: 'm3', sentAt: '2026-09-23T12:10:00Z' })]);
    expect(merged.map((m) => m.id)).toEqual(['m3', 'm2', 'm1']);
  });

  it('returns the same array reference when there is nothing new to add', () => {
    const existing = [msg({ id: 'm1' })];
    const merged = mergeTeamMessages(existing, [msg({ id: 'm1' })]);
    expect(merged).toBe(existing);
  });

  it('caps the merged list to the 100 most recent messages', () => {
    const existing = Array.from({ length: 100 }, (_, i) =>
      msg({ id: `old-${i}`, sentAt: new Date(2026, 0, 1, 0, i).toISOString() }));
    const merged = mergeTeamMessages(existing, [msg({ id: 'new', sentAt: new Date(2026, 0, 2).toISOString() })]);
    expect(merged).toHaveLength(100);
    expect(merged[0]?.id).toBe('new');
    expect(merged.some((m) => m.id === 'old-0')).toBe(false);
  });
});
