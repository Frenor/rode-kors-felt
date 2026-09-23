/**
 * Chat history seeding (gap B9 / item 8.29).
 *
 * Merges the persisted message history (`api.getTeamMessages`) into whatever
 * the live socket has already delivered: messages addressed to everyone or
 * to this team, plus this team's own (marked `fromSelf`); receipts (`ackOf`)
 * are not chat and are skipped; de-duplicated by id against the live list so
 * a repeated seed (team change, reconnect) never duplicates a message. Pure
 * so this is covered by a unit test without mounting the dashboard.
 */
import type { TeamMessage } from '../../lib/types';
import type { ChatMessage } from './TeamChatSection';

export function mergeTeamMessageHistory(
  teamId: string,
  fetched: TeamMessage[],
  live: ChatMessage[],
): ChatMessage[] {
  const relevant = fetched.filter(
    (m) => !m.ackOf && (!m.toTeamId || m.toTeamId === teamId || m.fromTeamId === teamId),
  );
  const existingIds = new Set(live.map((m) => m.id));
  const seeded: ChatMessage[] = relevant
    .filter((m) => !existingIds.has(m.id))
    .map((m) => ({
      id: m.id,
      text: m.text,
      fromTeamId: m.fromTeamId ?? undefined,
      toTeamId: m.toTeamId ?? null,
      fromSelf: m.fromTeamId === teamId,
      sentAt: m.sentAt,
    }));
  if (seeded.length === 0) return live;
  return [...seeded, ...live].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
}
