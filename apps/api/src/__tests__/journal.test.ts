import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getCoordinatorToken, getFirstAiderToken, getSickbayToken, getEventId } from './helpers.js';

let app: FastifyInstance;
let eventId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

async function createJournalPatient() {
  const token = getSickbayToken(eventId);
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/patients',
    headers: { Authorization: `Bearer ${token}` },
    payload: { eventId, ageGroup: 'adult', presentingComplaint: 'Journal export test' },
  });
  const patient = createRes.json().patient;

  await app.inject({
    method: 'POST',
    url: `/api/patients/${patient.id}/vitals`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { pulse: 80, spo2: 97 },
  });
  await app.inject({
    method: 'POST',
    url: `/api/patients/${patient.id}/notes`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { text: 'Journal test note', author: 'Sykepleier Bakke' },
  });
  await app.inject({
    method: 'POST',
    url: `/api/patients/${patient.id}/medications`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { drug: 'oxygen', dose: '4 L/min' },
  });
  await app.inject({
    method: 'POST',
    url: `/api/patients/${patient.id}/amk-calls`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { summaryGiven: 'Summary', amkGuidance: 'Guidance', followUpOwner: 'Lege Andersen' },
  });
  await app.inject({
    method: 'POST',
    url: `/api/patients/${patient.id}/actions`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { type: 'status.set', status: 'in_treatment' },
  });

  return patient.id as string;
}

describe('GET /api/patients/:id/journal (gap B7)', () => {
  it('returns the full journal shape for sickbay/coordinator/admin', async () => {
    const patientId = await createJournalPatient();
    const token = getSickbayToken(eventId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}/journal`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.patient.id).toBe(patientId);
    expect(body.vitalsHistory).toHaveLength(1);
    expect(body.vitalsHistory[0].pulse).toBe(80);
    expect(body.notes).toHaveLength(1);
    expect(body.notes[0].text).toBe('Journal test note');
    expect(body.medications).toHaveLength(1);
    expect(body.medications[0].drug).toBe('oxygen');
    expect(body.amkCallLogs).toHaveLength(1);
    expect(body.amkCallLogs[0].summaryGiven).toBe('Summary');
    expect(body.actionHistory.length).toBeGreaterThan(0);
    expect(body.actionHistory.some((a: { actionType: string }) => a.actionType === 'patient.status_set')).toBe(true);
    expect(Array.isArray(body.teams)).toBe(true);
    expect(body.teams.length).toBeGreaterThan(0);
    expect(body.teams[0]).toHaveProperty('name');
  });

  it('rejects a first aider (sickbay/coordinator/admin only)', async () => {
    const patientId = await createJournalPatient();
    const token = getFirstAiderToken(eventId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/patients/${patientId}/journal`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('404s for an unknown patient', async () => {
    const token = getCoordinatorToken();
    const res = await app.inject({
      method: 'GET',
      url: `/api/patients/00000000-0000-0000-0000-000000000000/journal`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/events/:id/journals (gap B7)', () => {
  it('returns one journal per patient in the event for coordinator/admin', async () => {
    const patientId = await createJournalPatient();
    const token = getCoordinatorToken();

    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/journals`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const { journals } = res.json();
    expect(Array.isArray(journals)).toBe(true);
    expect(journals.some((j: { patient: { id: string } }) => j.patient.id === patientId)).toBe(true);
  });

  it('rejects sickbay (coordinator/admin only)', async () => {
    const token = getSickbayToken(eventId);
    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/journals`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
