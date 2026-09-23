import { describe, expect, it } from 'vitest';
import { mergeTeamMessageHistory } from '../pages/FirstAider/team-message-history';
import type { TeamMessage } from '../lib/types';
import type { ChatMessage } from '../pages/FirstAider/TeamChatSection';

const msg = (over: Partial<TeamMessage>): TeamMessage => ({
  id: 'm1', text: 'hei', sentAt: '2026-09-23T10:00:00.000Z', ...over,
});

describe('mergeTeamMessageHistory (gap B9 / item 8.29)', () => {
  it('includes messages addressed to everyone', () => {
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'm1', toTeamId: null, fromTeamId: 'coordinator' })], []);
    expect(out.map((m) => m.id)).toEqual(['m1']);
  });

  it('includes messages directed to this team', () => {
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'm1', toTeamId: 'team-alpha' })], []);
    expect(out).toHaveLength(1);
  });

  it('excludes messages directed to another team', () => {
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'm1', toTeamId: 'team-bravo', fromTeamId: 'coordinator' })], []);
    expect(out).toHaveLength(0);
  });

  it('includes this team\'s own messages regardless of who they were addressed to, marked fromSelf', () => {
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'm1', fromTeamId: 'team-alpha', toTeamId: 'coordinator' })], []);
    expect(out).toEqual([expect.objectContaining({ id: 'm1', fromSelf: true })]);
  });

  it('marks a message from another team as not fromSelf', () => {
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'm1', fromTeamId: 'coordinator', toTeamId: null })], []);
    expect(out[0]?.fromSelf).toBe(false);
  });

  it('skips receipts (ackOf)', () => {
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'm1', toTeamId: 'team-alpha', ackOf: 'm0' })], []);
    expect(out).toHaveLength(0);
  });

  it('de-duplicates by id against messages already in the live list', () => {
    const live: ChatMessage[] = [{ id: 'm1', text: 'hei', fromSelf: false, sentAt: '2026-09-23T10:00:00.000Z' }];
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'm1', toTeamId: null })], live);
    expect(out).toHaveLength(1);
    expect(out).toBe(live); // unchanged reference when nothing new was seeded
  });

  it('merges seeded history and live messages in chronological order', () => {
    const live: ChatMessage[] = [{ id: 'live-1', text: 'nyere', fromSelf: false, sentAt: '2026-09-23T10:05:00.000Z' }];
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'hist-1', toTeamId: null, sentAt: '2026-09-23T10:00:00.000Z' })], live);
    expect(out.map((m) => m.id)).toEqual(['hist-1', 'live-1']);
  });

  it('returns an empty list when nothing is relevant', () => {
    const out = mergeTeamMessageHistory('team-alpha', [msg({ id: 'm1', toTeamId: 'team-bravo', fromTeamId: 'coordinator' })], []);
    expect(out).toEqual([]);
  });
});
