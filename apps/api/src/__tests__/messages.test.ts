import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { buildApp, getCoordinatorToken, getEventId, getFirstAiderToken } from './helpers.js';
import { db } from '../db/index.js';
import { teamMessages } from '../db/schema.js';
import { persistTeamMessage } from '../routes/ws.js';

let app: FastifyInstance;
let eventId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

// ────────────────────────────────────────────────────────────────────────────
// persistTeamMessage — no live socket in the test harness, so the fire-and-
// forget insert `ws.ts` uses is unit-tested directly (gap B9 / 8.29).
// ────────────────────────────────────────────────────────────────────────────

describe('persistTeamMessage', () => {
  it('inserts a row using the same id the broadcast used', async () => {
    const id = randomUUID();
    const sentAt = new Date().toISOString();

    await persistTeamMessage({
      id,
      eventId,
      fromTeamId: null,
      fromLabel: 'Koordinator',
      toTeamId: null,
      ackOf: null,
      text: 'Alle enheter: samling ved sekretariatet',
      sentAt,
    });

    const [row] = await db.select().from(teamMessages).where(eq(teamMessages.id, id)).limit(1);
    expect(row).toBeDefined();
    expect(row!.eventId).toBe(eventId);
    expect(row!.fromLabel).toBe('Koordinator');
    expect(row!.text).toBe('Alle enheter: samling ved sekretariatet');
    expect(row!.sentAt.toISOString()).toBe(sentAt);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/events/:id/messages (gap B9 / 8.29)
// ────────────────────────────────────────────────────────────────────────────

describe('GET /api/events/:id/messages', () => {
  it('returns newest `limit` messages in ascending sentAt order', async () => {
    const base = Date.now();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const id = randomUUID();
      ids.push(id);
      await persistTeamMessage({
        id,
        eventId,
        fromTeamId: null,
        fromLabel: 'Bravo',
        toTeamId: null,
        ackOf: null,
        text: `Melding ${i}`,
        sentAt: new Date(base + i * 1000).toISOString(),
      });
    }

    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/messages?limit=3`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const { messages } = res.json();
    expect(messages).toHaveLength(3);
    // Newest 3 of the 5, oldest→newest.
    expect(messages.map((m: { id: string }) => m.id)).toEqual([ids[2], ids[3], ids[4]]);
    const sentAts = messages.map((m: { sentAt: string }) => new Date(m.sentAt).getTime());
    expect(sentAts).toEqual([...sentAts].sort((a, b) => a - b));
  });

  it('rejects a limit outside 1..500', async () => {
    const token = getFirstAiderToken(eventId);
    const tooLow = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/messages?limit=0`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(tooLow.statusCode).toBe(400);

    const tooHigh = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/messages?limit=501`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(tooHigh.statusCode).toBe(400);
  });

  it('rejects a token scoped to a different event', async () => {
    const token = getFirstAiderToken(randomUUID());
    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/messages`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/events/${eventId}/messages` });
    expect(res.statusCode).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/access-codes/:id/revoke (gap B5 / 8.31)
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/access-codes/:id/revoke', () => {
  it('revoking twice stays idempotent', async () => {
    const coordinatorToken = getCoordinatorToken();
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/access-codes`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: { role: 'first_aider' },
    });
    const codeId = createRes.json().code.id as string;

    const first = await app.inject({
      method: 'POST',
      url: `/api/access-codes/${codeId}/revoke`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    expect(first.statusCode).toBe(200);
    const revokedAt = first.json().code.revokedAt as string;
    expect(revokedAt).toBeTruthy();

    const second = await app.inject({
      method: 'POST',
      url: `/api/access-codes/${codeId}/revoke`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().code.revokedAt).toBe(revokedAt);
  });

  it('returns 404 for an unknown code id', async () => {
    const coordinatorToken = getCoordinatorToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/access-codes/${randomUUID()}/revoke`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects a first_aider token', async () => {
    const coordinatorToken = getCoordinatorToken();
    const firstAiderToken = getFirstAiderToken(eventId);
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/access-codes`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: { role: 'sickbay' },
    });
    const codeId = createRes.json().code.id as string;

    const res = await app.inject({
      method: 'POST',
      url: `/api/access-codes/${codeId}/revoke`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
