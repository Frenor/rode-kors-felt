/**
 * Retention (gap B8).
 *
 * Scrubs personally identifying fields from every patient in an event once
 * it is over, keeping the clinical record itself (triage, statuses,
 * placement, timestamps, vitals, medications) for the debrief/statistics.
 * `anonymiseExpiredEvents` is the scheduled sweep server.ts runs on startup
 * and every 24h; `anonymiseEvent` is what `POST /events/:id/anonymise`
 * (and the sweep) both call.
 */

import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { actionEvents, events, patients } from '../db/schema.js';

const ANONYMISED_TEXT = '[anonymisert]';
const RETENTION_DAYS = 30;

export class RetentionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type AnonymiseEventResult = {
  anonymisedAt: string;
  alreadyAnonymised: boolean;
  patientsAnonymised: number;
};

/**
 * Anonymises every patient in `eventId`: idempotent (a second call is a
 * no-op that reports `alreadyAnonymised: true`), and refuses (409) while
 * the event is still `active` — the event must have been ended/archived
 * first.
 */
export async function anonymiseEvent(eventId: string): Promise<AnonymiseEventResult> {
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) {
    throw new RetentionError('Arrangement ikke funnet', 404);
  }

  if (event.anonymisedAt) {
    return {
      anonymisedAt: event.anonymisedAt.toISOString(),
      alreadyAnonymised: true,
      patientsAnonymised: 0,
    };
  }

  if (event.status === 'active') {
    throw new RetentionError('Arrangementet er fortsatt aktivt', 409);
  }

  const eventPatients = await db.select().from(patients).where(eq(patients.eventId, eventId));

  for (const patient of eventPatients) {
    const anonymisedNotes = (patient.notes ?? []).map((note) => ({ ...note, text: ANONYMISED_TEXT }));
    await db
      .update(patients)
      .set({
        fullName: null,
        birthDate: null,
        gender: null,
        description: null,
        positionText: null,
        notes: anonymisedNotes,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, patient.id));
  }

  // AMK call logs are action-event payloads (patient.amk_call_logged), not a
  // table of their own — scrub the free-text narrative fields in place and
  // keep everything else (timestamps, followUpOwner, referenceId, eta).
  const patientIds = new Set(eventPatients.map((p) => p.id));
  if (patientIds.size > 0) {
    const callLogActions = await db
      .select()
      .from(actionEvents)
      .where(and(
        eq(actionEvents.eventId, eventId),
        eq(actionEvents.entityType, 'patient'),
        eq(actionEvents.actionType, 'patient.amk_call_logged'),
      ));

    for (const action of callLogActions) {
      if (!patientIds.has(action.entityId)) continue;
      const payload = action.payload as { callLog?: Record<string, unknown> };
      if (!payload.callLog) continue;
      const anonymisedPayload = {
        ...payload,
        callLog: {
          ...payload.callLog,
          summaryGiven: ANONYMISED_TEXT,
          amkGuidance: ANONYMISED_TEXT,
        },
      };
      await db.update(actionEvents).set({ payload: anonymisedPayload }).where(eq(actionEvents.id, action.id));
    }
  }

  const now = new Date();
  await db.update(events).set({ anonymisedAt: now, updatedAt: now }).where(eq(events.id, eventId));

  return {
    anonymisedAt: now.toISOString(),
    alreadyAnonymised: false,
    patientsAnonymised: eventPatients.length,
  };
}

/**
 * Scheduled sweep: anonymises every event that ended more than
 * `RETENTION_DAYS` ago and has not been anonymised yet. Never throws — a
 * per-event failure (including the expected 409 for an event that outlived
 * its end date without being archived) is logged and skipped so the rest of
 * the sweep still runs.
 */
export async function anonymiseExpiredEvents(now: Date = new Date()): Promise<{ anonymisedEventIds: string[] }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const expiredEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(and(isNull(events.anonymisedAt), lt(events.endDate, cutoff)));

  const anonymisedEventIds: string[] = [];
  for (const event of expiredEvents) {
    try {
      const result = await anonymiseEvent(event.id);
      if (!result.alreadyAnonymised) anonymisedEventIds.push(event.id);
    } catch (err) {
      // Fail loud in the log, never throw out of the sweep (CLAUDE.md).
      console.error(`[retention] Kunne ikke anonymisere arrangement ${event.id}:`, err);
    }
  }

  return { anonymisedEventIds };
}
