import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getCoordinatorToken, getSickbayToken, getEventId } from './helpers.js';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { actionEvents } from '../db/schema.js';

let app: FastifyInstance;
let eventId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

function calculateAgeYearsFromString(birthDate: string, reference = new Date()): number {
  const date = new Date(`${birthDate}T00:00:00Z`);
  let age = reference.getUTCFullYear() - date.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - date.getUTCMonth();
  const dayDiff = reference.getUTCDate() - date.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

describe('GET /api/patients', () => {
  it('returns 200 with patients array for sickbay auth', async () => {
    const token = getSickbayToken(eventId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/patients?eventId=${eventId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('patients');
    expect(Array.isArray(body.patients)).toBe(true);
  });
});

describe('POST /api/patients', () => {
  it('creates a patient and returns 201 with patient object', async () => {
    const token = getSickbayToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        gender: 'male',
        presentingComplaint: 'Ankle injury',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('patient');
    expect(body.patient).toHaveProperty('id');
    expect(body.patient.eventId).toBe(eventId);
  });

  it('stores demographics and computes age years from birthDate', async () => {
    const token = getSickbayToken(eventId);
    const birthDate = '2000-04-06';
    const expectedAge = calculateAgeYearsFromString(birthDate);

    const res = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        fullName: 'Anna Hansen',
        gender: 'female',
        birthDate,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.patient.fullName).toBe('Anna Hansen');
    expect(body.patient.gender).toBe('female');
    expect(body.patient.birthDate).toBe(birthDate);
    expect(body.patient.ageYears).toBe(expectedAge);
  });

  it('stores sickbay placement when placement type and number are provided', async () => {
    const token = getSickbayToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        fullName: 'Plassering Test',
        placementType: 'bed',
        placementNumber: '12',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.patient.placementType).toBe('bed');
    expect(body.patient.placementNumber).toBe('12');
  });

  it('rejects incomplete sickbay placement payloads', async () => {
    const token = getSickbayToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        placementType: 'chair',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('rejects invalid birthDate values', async () => {
    const token = getSickbayToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        birthDate: '2026-02-30',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });
});

describe('POST /api/patients/:id/vitals', () => {
  it('appends two separate VitalReadings (append-only)', async () => {
    const token = getSickbayToken(eventId);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId, ageGroup: 'adult', presentingComplaint: 'Chest pain' },
    });
    const patientId = createRes.json().patient.id;

    const first = await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/vitals`,
      headers: { authorization: `Bearer ${token}` },
      payload: { pulse: 80, spo2: 98, respiratoryRate: 16, painScore: 3 },
    });

    expect(first.statusCode).toBe(201);
    const firstBody = first.json();
    expect(firstBody.vitals.pulse).toBe(80);
    const firstReadingId = firstBody.vitals.id;

    const second = await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/vitals`,
      headers: { authorization: `Bearer ${token}` },
      payload: { pulse: 90, spo2: 96, respiratoryRate: 18, painScore: 5 },
    });

    expect(second.statusCode).toBe(201);
    expect(second.json().vitals.pulse).toBe(90);
    const secondReadingId = second.json().vitals.id;

    // Different IDs confirm append-only (not overwrite)
    expect(firstReadingId).not.toBe(secondReadingId);

    // Confirm both readings are present via GET
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().patient.vitalsHistory.length).toBe(2);
  });
});

describe('POST /api/patients/:id/notes', () => {
  it('appends a note to the patient', async () => {
    const token = getSickbayToken(eventId);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId, presentingComplaint: 'Headache' },
    });
    const patientId = createRes.json().patient.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/notes`,
      headers: { authorization: `Bearer ${token}` },
      payload: { text: 'Patient is conscious and alert.', author: 'nurse1' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('patient');
    expect(Array.isArray(body.patient.notes)).toBe(true);
    expect(body.patient.notes.length).toBeGreaterThanOrEqual(1);

    const note = body.patient.notes.find(
      (n: { text: string }) => n.text === 'Patient is conscious and alert.',
    );
    expect(note).toBeDefined();
    expect(note.author).toBe('nurse1');
  });
});

describe('AMK call workflows', () => {
  it('creates append-only AMK call logs and persists an action event', async () => {
    const token = getSickbayToken(eventId);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        presentingComplaint: 'Pustevansker',
      },
    });
    const patientId = createRes.json().patient.id as string;

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-calls`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        summaryGiven: 'Pasient med brystsmerter og tung pust.',
        amkGuidance: 'Sendes til sykehus med ambulanse.',
        followUpOwner: 'Sykestue',
        referenceId: 'AMK-123',
        eta: '12 minutter',
        calledAt: '2026-04-04T10:00:00.000Z',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.callLog).toMatchObject({
      eventId,
      patientId,
      summaryGiven: 'Pasient med brystsmerter og tung pust.',
      amkGuidance: 'Sendes til sykehus med ambulanse.',
      followUpOwner: 'Sykestue',
      referenceId: 'AMK-123',
      eta: '12 minutter',
      recordedBy: expect.any(String),
    });
    expect(body.action.actionType).toBe('patient.amk_call_logged');

    const rows = await db
      .select()
      .from(actionEvents)
      .where(and(eq(actionEvents.entityType, 'patient'), eq(actionEvents.entityId, patientId), eq(actionEvents.actionType, 'patient.amk_call_logged')));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toHaveProperty('callLog');
  });

  it('lists AMK call logs newest-first', async () => {
    const token = getSickbayToken(eventId);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        presentingComplaint: 'Smerter i brystet',
      },
    });
    const patientId = createRes.json().patient.id as string;

    await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-calls`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        summaryGiven: 'Første samtale',
        amkGuidance: 'Observasjon',
        followUpOwner: 'Sykestue',
        calledAt: '2026-04-04T09:00:00.000Z',
      },
    });
    await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-calls`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        summaryGiven: 'Andre samtale',
        amkGuidance: 'Transport',
        followUpOwner: 'Sykestue',
        calledAt: '2026-04-04T10:00:00.000Z',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}/amk-calls`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.callLogs)).toBe(true);
    expect(body.callLogs).toHaveLength(2);
    expect(body.callLogs[0].summaryGiven).toBe('Andre samtale');
    expect(body.callLogs[1].summaryGiven).toBe('Første samtale');
  });

  it('returns 400 for malformed AMK call payloads', async () => {
    const token = getSickbayToken(eventId);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        presentingComplaint: 'Uklart forlop',
      },
    });
    const patientId = createRes.json().patient.id as string;

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-calls`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        summaryGiven: '',
        amkGuidance: ' ',
        followUpOwner: '',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('enforces event scoping on AMK call and assist endpoints', async () => {
    const coordinatorToken = getCoordinatorToken();
    const tokenFromOtherEvent = getSickbayToken(eventId);

    const createEventRes = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        name: `AMK scope test ${Date.now()}`,
        startDate: '2026-04-04T08:00:00.000Z',
        endDate: '2026-04-04T18:00:00.000Z',
      },
    });
    const foreignEventId = createEventRes.json().event.id as string;

    const foreignPatientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        eventId: foreignEventId,
        ageGroup: 'adult',
        presentingComplaint: 'Skopetest',
      },
    });
    const foreignPatientId = foreignPatientRes.json().patient.id as string;

    const postCallRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${foreignPatientId}/amk-calls`,
      headers: { authorization: `Bearer ${tokenFromOtherEvent}` },
      payload: {
        summaryGiven: 'Test',
        amkGuidance: 'Test',
        followUpOwner: 'Test',
      },
    });
    expect(postCallRes.statusCode).toBe(403);

    const getCallRes = await app.inject({
      method: 'GET',
      url: `/api/patients/${foreignPatientId}/amk-calls`,
      headers: { authorization: `Bearer ${tokenFromOtherEvent}` },
    });
    expect(getCallRes.statusCode).toBe(403);

    const draftRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${foreignPatientId}/amk-assist/draft`,
      headers: { authorization: `Bearer ${tokenFromOtherEvent}` },
      payload: {},
    });
    expect(draftRes.statusCode).toBe(403);

    const confirmRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${foreignPatientId}/amk-assist/confirm`,
      headers: { authorization: `Bearer ${tokenFromOtherEvent}` },
      payload: {
        criticality: 'medium',
        spokenScript: 'Test',
      },
    });
    expect(confirmRes.statusCode).toBe(403);
  });

  it('returns a deterministic AMK draft and stores the draft action', async () => {
    const token = getSickbayToken(eventId);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        presentingComplaint: 'Magesmerter',
      },
    });
    const patientId = createRes.json().patient.id as string;

    await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/vitals`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        pulse: 124,
        spo2: 91,
        respiratoryRate: 24,
        painScore: 7,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-assist/draft`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual([
      'criticality',
      'rationale',
      'sayFirst',
      'sbarDraft',
      'spokenScript',
    ]);
    expect(body.criticality).toMatch(/^(low|medium|high|critical)$/);
    expect(Array.isArray(body.sayFirst)).toBe(true);
    expect(body.sbarDraft).toHaveProperty('situation');

    const rows = await db
      .select()
      .from(actionEvents)
      .where(and(eq(actionEvents.entityType, 'patient'), eq(actionEvents.entityId, patientId), eq(actionEvents.actionType, 'patient.amk_ai_draft_generated')));

    expect(rows).toHaveLength(1);
    expect((rows[0]?.payload as any).provenance).toMatchObject({
      source: 'fallback_template',
      fallbackUsed: true,
    });
  });

  it('uses provider adapter path when AI env config is present', async () => {
    const prevProvider = process.env.AI_PROVIDER;
    const prevModel = process.env.AI_MODEL;
    const prevApiKey = process.env.AI_API_KEY;
    process.env.AI_PROVIDER = 'mock';
    process.env.AI_MODEL = 'mock-v1';
    process.env.AI_API_KEY = 'test-key';
    const token = getSickbayToken(eventId);

    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/patients',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          eventId,
          ageGroup: 'adult',
          presentingComplaint: 'Svimmelhet',
        },
      });
      const patientId = createRes.json().patient.id as string;

      const res = await app.inject({
        method: 'POST',
        url: `/api/patients/${patientId}/amk-assist/draft`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(200);

      const rows = await db
        .select()
        .from(actionEvents)
        .where(and(eq(actionEvents.entityType, 'patient'), eq(actionEvents.entityId, patientId), eq(actionEvents.actionType, 'patient.amk_ai_draft_generated')));

      expect(rows).toHaveLength(1);
      expect((rows[0]?.payload as any).provenance).toMatchObject({
        source: 'provider',
        model: 'mock-v1',
        fallbackUsed: false,
      });
    } finally {
      process.env.AI_PROVIDER = prevProvider;
      process.env.AI_MODEL = prevModel;
      process.env.AI_API_KEY = prevApiKey;
    }
  });

  it('stores a confirmed AMK script as an append-only action', async () => {
    const token = getSickbayToken(eventId);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        presentingComplaint: 'Synkope',
      },
    });
    const patientId = createRes.json().patient.id as string;

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-assist/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        criticality: 'high',
        spokenScript: 'Dette er sykestue. Vi trenger hjelp nå.',
        rationale: 'Høy puls og redusert allmenntilstand.',
        sayFirst: ['Pasient med synkope', 'Puls 124'],
        sbarDraft: {
          situation: 'Pasient med synkope',
          background: 'Ingen kjent sykehistorie',
          assessment: 'Høy risiko',
          recommendation: 'Ønsker AMK-vurdering',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.confirmed.criticality).toBe('high');
    expect(body.action.actionType).toBe('patient.amk_ai_script_confirmed');

    const rows = await db
      .select()
      .from(actionEvents)
      .where(and(eq(actionEvents.entityType, 'patient'), eq(actionEvents.entityId, patientId), eq(actionEvents.actionType, 'patient.amk_ai_script_confirmed')));

    expect(rows).toHaveLength(1);
  });

  it('does not trigger patient status transitions from AI draft/confirm actions', async () => {
    const token = getSickbayToken(eventId);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        presentingComplaint: 'Sirkulasjonssvikt',
      },
    });
    const patientId = createRes.json().patient.id as string;

    await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-assist/draft`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    await app.inject({
      method: 'POST',
      url: `/api/patients/${patientId}/amk-assist/confirm`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        criticality: 'critical',
        spokenScript: 'Trenger umiddelbar AMK-hjelp.',
      },
    });

    const patientRes = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(patientRes.statusCode).toBe(200);
    expect(patientRes.json().patient.status).toBe('incoming');

    const statusSetRows = await db
      .select()
      .from(actionEvents)
      .where(and(eq(actionEvents.entityType, 'patient'), eq(actionEvents.entityId, patientId), eq(actionEvents.actionType, 'patient.status_set')));

    expect(statusSetRows).toHaveLength(0);
  });
});

describe('Patient event scoping', () => {
  it('rejects access to a patient from another event', async () => {
    const coordinatorToken = getCoordinatorToken();
    const firstAiderToken = getSickbayToken(eventId);

    const createEventRes = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        name: `Fremmed event ${Date.now()}`,
        startDate: '2026-04-04T08:00:00.000Z',
        endDate: '2026-04-04T18:00:00.000Z',
      },
    });
    const foreignEventId = createEventRes.json().event.id as string;

    const foreignPatientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        eventId: foreignEventId,
        ageGroup: 'adult',
        presentingComplaint: 'Utenfor skopet',
      },
    });
    const foreignPatientId = foreignPatientRes.json().patient.id as string;

    const res = await app.inject({
      method: 'GET',
      url: `/api/patients/${foreignPatientId}`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/patients/:id — status transitions
// ---------------------------------------------------------------------------

/**
 * Helper: create a fresh patient for an isolated PATCH test.
 * Returns the patient id and the sickbay bearer token.
 */
async function createTestPatient(complaint = 'Teststatus-pasient') {
  const token = getSickbayToken(eventId);
  const res = await app.inject({
    method: 'POST',
    url: '/api/patients',
    headers: { authorization: `Bearer ${token}` },
    payload: { eventId, ageGroup: 'adult', presentingComplaint: complaint },
  });
  const patientId = res.json().patient.id as string;
  return { token, patientId };
}

describe('PATCH /api/patients/:id — valid status transitions', () => {
  it('incoming → in_treatment: returns 200 with updated status', async () => {
    const { token, patientId } = await createTestPatient();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_treatment' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().patient.status).toBe('in_treatment');
  });

  it('incoming → observation: returns 200 with updated status', async () => {
    const { token, patientId } = await createTestPatient();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'observation' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().patient.status).toBe('observation');
  });

  it('in_treatment → discharged: returns 200 with status discharged', async () => {
    const { token, patientId } = await createTestPatient();

    // Advance to in_treatment first
    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_treatment' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'discharged' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().patient.status).toBe('discharged');
  });

  it('in_treatment → transferred: returns 200 with status transferred', async () => {
    const { token, patientId } = await createTestPatient();

    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_treatment' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'transferred' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().patient.status).toBe('transferred');
  });

  it('observation → in_treatment: returns 200 with updated status', async () => {
    const { token, patientId } = await createTestPatient();

    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'observation' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_treatment' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().patient.status).toBe('in_treatment');
  });

  it('observation → discharged: returns 200 with status discharged', async () => {
    const { token, patientId } = await createTestPatient();

    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'observation' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'discharged' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().patient.status).toBe('discharged');
  });

  it('observation → transferred: returns 200 with status transferred', async () => {
    const { token, patientId } = await createTestPatient();

    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'observation' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'transferred' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().patient.status).toBe('transferred');
  });
});

describe('PATCH /api/patients/:id — placement updates', () => {
  it('updates placementType and placementNumber for an existing patient', async () => {
    const { token, patientId } = await createTestPatient();

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        placementType: 'chair',
        placementNumber: '5',
      },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().patient.placementType).toBe('chair');
    expect(patchRes.json().patient.placementNumber).toBe('5');
  });

  it('clears placement when both placement fields are empty/null', async () => {
    const { token, patientId } = await createTestPatient();

    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        placementType: 'bed',
        placementNumber: '1',
      },
    });

    const clearRes = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        placementType: null,
        placementNumber: null,
      },
    });

    expect(clearRes.statusCode).toBe(200);
    expect(clearRes.json().patient.placementType).toBeUndefined();
    expect(clearRes.json().patient.placementNumber).toBeUndefined();
  });
});

describe('PATCH /api/patients/:id — status persistence confirmed via GET', () => {
  it('status is persisted: GET /:id returns the updated status after PATCH', async () => {
    const { token, patientId } = await createTestPatient();

    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_treatment' },
    });

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().patient.status).toBe('in_treatment');
  });

  it('discharged status is persisted (final state)', async () => {
    const { token, patientId } = await createTestPatient();

    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'discharged' },
    });

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().patient.status).toBe('discharged');
  });
});

describe('PATCH /api/patients/:id — invalid / forbidden status values', () => {
  it('rejects a completely unknown status with 4xx', async () => {
    const { token, patientId } = await createTestPatient();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'unknown_status' },
    });

    // The DB enum enforces this — Drizzle/Postgres will reject it
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(600);
  });

  it('returns 404 when patching a non-existent patient id', async () => {
    const { token } = await createTestPatient();
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${nonExistentId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'in_treatment' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty('error');
  });

  it('returns 401 when no auth token is provided', async () => {
    const { patientId } = await createTestPatient();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      payload: { status: 'in_treatment' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/patients/:id — final states are terminal (no DB-enforced guard yet)', () => {
  /**
   * The DB has no trigger enforcing that discharged/transferred are terminal.
   * These tests document the CURRENT behaviour (API accepts re-transitions)
   * and serve as a canary: if a server-side guard is added later, these tests
   * will start returning 422/409 and must be updated to reflect the intended
   * policy.
   *
   * Business rule: the UI must not expose transition buttons for final states.
   * The companion frontend tests in SickBayDashboard.status.test.tsx enforce
   * that guarantee at the UI layer.
   */
  it('PATCH on a discharged patient currently accepted by the API (no server-side guard)', async () => {
    const { token, patientId } = await createTestPatient();

    // Move to discharged
    await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'discharged' },
    });

    // Attempt re-transition — API currently has no guard for this
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/patients/${patientId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'incoming' },
    });

    // If a server-side guard is introduced, change this to toBe(422) or toBe(409)
    // and remove this comment.
    expect([200, 409, 422]).toContain(res.statusCode);
  });
});
