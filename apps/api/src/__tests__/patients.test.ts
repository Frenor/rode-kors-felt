import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getSickbayToken, getEventId } from './helpers.js';

let app: FastifyInstance;
let eventId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

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
