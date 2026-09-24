/**
 * Chat history (gap B9 / item 8.29) — merging seeded and live messages.
 *
 * `GET /events/:id/messages` seeds history on load; the WebSocket's
 * `team.message` relay (or, in demo mode, `api.sendTeamMessage`) delivers new
 * ones live. Both paths funnel through this one function so a message never
 * shows twice, whichever arrived first.
 */
import type { TeamMessage } from '../../lib/types';

const MAX_MESSAGES = 100;

/**
 * Merges `incoming` into `existing`, de-duplicated by id, newest first (the
 * order the message stream renders), capped to the most recent
 * `MAX_MESSAGES`.
 */
export function mergeTeamMessages(existing: TeamMessage[], incoming: TeamMessage[]): TeamMessage[] {
  const seenIds = new Set(existing.map((m) => m.id));
  const additions = incoming.filter((m) => !seenIds.has(m.id));
  if (additions.length === 0) return existing;
  const merged = [...existing, ...additions];
  return merged
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, MAX_MESSAGES);
}
