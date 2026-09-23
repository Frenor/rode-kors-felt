/**
 * Lane 8 batch 3 (B) — event operations.
 *
 * Two resources that don't fit cleanly under the `/events/:id` prefix or
 * inside `events.ts`'s existing route group:
 *  - Chat history (gap B9): `GET /events/:id/messages` — the read side of
 *    `ws.ts`'s `team.message` relay (see `persistTeamMessage`).
 *  - Access-code revoke (gap B5): `POST /access-codes/:id/revoke` — the code
 *    id is not scoped by an event id in the URL, so it cannot be a
 *    `/events/:id/...` sub-route.
 *
 * Registered in server.ts under the `/api` prefix.
 */
import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accessCodes, events, teamMessages } from '../db/schema.js';
import { canAccessEvent, requireAuth, requireRole } from '../middleware/auth.js';

type AuthUser = { role?: string; eventId?: string };

const DEFAULT_MESSAGE_LIMIT = 100;
const MAX_MESSAGE_LIMIT = 500;

export async function messageRoutes(app: FastifyInstance) {
  // Chat history (gap B9): the newest `limit` messages, returned oldest→newest
  // so the client can append them straight into a chat list.
  app.get('/events/:id/messages', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id: eventId } = request.params as { id: string };
    const { limit: limitParam } = request.query as { limit?: string };

    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    if (!canAccessEvent(user, eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    let limit = DEFAULT_MESSAGE_LIMIT;
    if (limitParam !== undefined) {
      const parsedLimit = Number(limitParam);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_MESSAGE_LIMIT) {
        return reply.code(400).send({ error: 'limit må være et heltall mellom 1 og 500' });
      }
      limit = parsedLimit;
    }

    const rows = await db
      .select()
      .from(teamMessages)
      .where(eq(teamMessages.eventId, eventId))
      .orderBy(desc(teamMessages.sentAt))
      .limit(limit);

    // Newest-first from the query, ascending sentAt for the client.
    const messages = rows.slice().reverse().map(mapTeamMessage);

    return { messages };
  });

  // Event set-up (gap B5): revoking is not scoped by event id in the URL —
  // canAccessEvent isn't applicable, so role alone gates it, matching every
  // other coordinator/admin-only write in this batch.
  app.post('/access-codes/:id/revoke', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [code] = await db.select().from(accessCodes).where(eq(accessCodes.id, id)).limit(1);
    if (!code) return reply.code(404).send({ error: 'Kode ikke funnet' });

    if (code.revokedAt) {
      return { code: mapAccessCode(code) };
    }

    const [updated] = await db
      .update(accessCodes)
      .set({ revokedAt: new Date() })
      .where(eq(accessCodes.id, id))
      .returning();

    return { code: mapAccessCode(updated!) };
  });
}

function mapTeamMessage(row: typeof teamMessages.$inferSelect) {
  return {
    id: row.id,
    fromTeamId: row.fromTeamId ?? null,
    fromLabel: row.fromLabel ?? null,
    toTeamId: row.toTeamId ?? null,
    text: row.text,
    ackOf: row.ackOf ?? null,
    sentAt: row.sentAt.toISOString(),
  };
}

function mapAccessCode(row: typeof accessCodes.$inferSelect) {
  return {
    id: row.id,
    role: row.role,
    code: row.code,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}
