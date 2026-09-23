import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp, getCoordinatorToken, getFirstAiderToken, getEventId } from './helpers.js';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { anonymiseEvent, anonymiseExpiredEvents } from '../lib/retention.js';

let app: FastifyInstance;
let activeEventId: string;

beforeAll(async () => {
  app = await buildApp();
  activeEventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

/** A freshly created event is `draft`, not `active` — anonymisable right away. */
async function createDraftEvent() {
  const token = getCoordinatorToken();
  const res = await app.inject({
    method: 'POST',
    url: '/api/events',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: `Retention test event ${Date.now()}-${Math.random()}`,
      startDate: '2026-05-04T08:00:00.000Z',
      endDate: '2026-05-04T18:00:00.000Z',
    },
  });
  return res.json().event.id as string;
}

describe('POST /api/events/:id/anonymise (gap B8)', () => {
  it('409s while the event is still active', async () => {
    const token = getCoordinatorToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${activeEventId}/anonymise`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toHaveProperty('error');
  });

  it('rejects a first aider (coordinator/admin only)', async () => {
    const token = getFirstAiderToken(activeEventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${activeEventId}/anonymise`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('nulls PII fields, replaces note and AMK call log text, keeps the clinical record, and is idempotent', async () => {
    const eventId = await createDraftEvent();
    const firstAiderToken = getFirstAiderToken(eventId);

    const patientRes = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
      payload: { label: 'Retention test patient', triageStatus: 'yellow', positionText: 'Ved scenen' },
    });
    const patientId = patientRes.json().patient.id as string;

    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
      payload: { fullName: 'Test Testesen', gender: 'male', birthDate: '1990-01-01' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/notes`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
      payload: { text: 'Sensitiv informasjon', author: 'Alpha' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-calls`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
      payload: { summaryGiven: 'Fortalte om pasienten', amkGuidance: 'Send ambulanse', followUpOwner: 'Lege Andersen' },
    });

    const coordinatorToken = getCoordinatorToken();
    const firstRes = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/anonymise`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    expect(firstRes.statusCode).toBe(200);
    const first = firstRes.json();
    expect(first.alreadyAnonymised).toBe(false);
    expect(first.patientsAnonymised).toBe(1);
    expect(typeof first.anonymisedAt).toBe('string');

    const patientAfterRes = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    const patientAfter = patientAfterRes.json().patient;
    expect(patientAfter.fullName).toBeUndefined();
    expect(patientAfter.birthDate).toBeUndefined();
    expect(patientAfter.gender).toBeUndefined();
    expect(patientAfter.description).toBeNull();
    expect(patientAfter.positionText).toBeNull();
    // Kept: clinical record.
    expect(patientAfter.label).toBe('Retention test patient');
    expect(patientAfter.triageStatus).toBe('yellow');

    const journalRes = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}/journal`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    const journal = journalRes.json();
    expect(journal.notes.every((n: { text: string }) => n.text === '[anonymisert]')).toBe(true);
    expect(journal.amkCallLogs[0].summaryGiven).toBe('[anonymisert]');
    expect(journal.amkCallLogs[0].amkGuidance).toBe('[anonymisert]');
    expect(journal.amkCallLogs[0].followUpOwner).toBe('Lege Andersen');

    // Idempotent: a second call changes nothing and reports so.
    const secondRes = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/anonymise`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    expect(secondRes.statusCode).toBe(200);
    const second = secondRes.json();
    expect(second.alreadyAnonymised).toBe(true);
    expect(second.patientsAnonymised).toBe(0);
    expect(second.anonymisedAt).toBe(first.anonymisedAt);
  });
});

describe('anonymiseEvent (lib/retention.ts)', () => {
  it('throws a 409-shaped error while active', async () => {
    await expect(anonymiseEvent(activeEventId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws a 404-shaped error for an unknown event', async () => {
    await expect(anonymiseEvent('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('anonymiseExpiredEvents (gap B8 scheduled sweep)', () => {
  it('anonymises only events that ended more than 30 days ago and are not yet anonymised', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const longAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    const recently = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const [expiredDraft] = await db.insert(events).values({
      name: `Expired draft ${Date.now()}`,
      startDate: longAgo,
      endDate: longAgo,
      status: 'draft',
    }).returning();

    const [expiredButActive] = await db.insert(events).values({
      name: `Expired but still active ${Date.now()}`,
      startDate: longAgo,
      endDate: longAgo,
      status: 'active',
    }).returning();

    const [notYetExpired] = await db.insert(events).values({
      name: `Not yet expired ${Date.now()}`,
      startDate: recently,
      endDate: recently,
      status: 'archived',
    }).returning();

    const [alreadyAnonymised] = await db.insert(events).values({
      name: `Already anonymised ${Date.now()}`,
      startDate: longAgo,
      endDate: longAgo,
      status: 'archived',
      anonymisedAt: now,
    }).returning();

    const { anonymisedEventIds } = await anonymiseExpiredEvents(now);

    expect(anonymisedEventIds).toContain(expiredDraft!.id);
    expect(anonymisedEventIds).not.toContain(expiredButActive!.id);
    expect(anonymisedEventIds).not.toContain(notYetExpired!.id);
    expect(anonymisedEventIds).not.toContain(alreadyAnonymised!.id);

    const [expiredButActiveAfter] = await db.select().from(events).where(eq(events.id, expiredButActive!.id)).limit(1);
    expect(expiredButActiveAfter!.anonymisedAt).toBeNull();

    const [expiredDraftAfter] = await db.select().from(events).where(eq(events.id, expiredDraft!.id)).limit(1);
    expect(expiredDraftAfter!.anonymisedAt).not.toBeNull();
  });
});
