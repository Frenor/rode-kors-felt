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
