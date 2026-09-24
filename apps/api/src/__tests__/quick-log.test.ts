import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getCoordinatorToken, getFirstAiderToken, getEventId } from './helpers.js';

let app: FastifyInstance;
let eventId: string;
let teamId: string;
let teamName: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
  const coordinatorToken = getCoordinatorToken();
  const eventRes = await app.inject({
    method: 'GET',
    url: `/api/events/${eventId}`,
    headers: { authorization: `Bearer ${coordinatorToken}` },
  });
  teamId = eventRes.json().teams[0].id as string;
  teamName = eventRes.json().teams[0].name as string;
});

afterAll(async () => {
  await app.close();
});

describe('Quick log (gap A8) — POST /api/events/:id/patients', () => {
  it('creates an open patient when neither status nor fieldOutcome is given', async () => {
    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Quick log open test' },
    });

    expect(res.statusCode).toBe(201);
    const patient = res.json().patient;
    expect(patient.status).toBe('incoming');
    expect(patient.notes).toHaveLength(0);
  });

  it('creates a closed patient with a "Behandlet på stedet av <team>" note when fieldOutcome + status are both given', async () => {
    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Quick log closed test',
        assignedTeamId: teamId,
        ageGroup: 'adult',
        triageStatus: 'green',
        fieldOutcome: 'treated_on_scene',
        status: 'discharged',
      },
    });

    expect(res.statusCode).toBe(201);
    const patient = res.json().patient;
    expect(patient.status).toBe('discharged');
    expect(patient.fieldOutcome).toBe('treated_on_scene');
    expect(patient.ageGroup).toBe('adult');
    expect(patient.notes).toHaveLength(1);
    expect(patient.notes[0].text).toBe(`Behandlet på stedet av ${teamName}`);
  });

  it('uses the outcome-specific Norwegian label for a non-treated_on_scene outcome', async () => {
    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        label: 'Quick log false alarm test',
        assignedTeamId: teamId,
        fieldOutcome: 'false_alarm',
        status: 'discharged',
      },
    });

    expect(res.statusCode).toBe(201);
    const patient = res.json().patient;
    expect(patient.notes[0].text).toBe(`Falsk alarm av ${teamName}`);
  });

  it('allows fieldOutcome alone (no status) — patient stays open, no note', async () => {
    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Quick log outcome-only test', fieldOutcome: 'treated_on_scene' },
    });

    expect(res.statusCode).toBe(201);
    const patient = res.json().patient;
    expect(patient.status).toBe('incoming');
    expect(patient.fieldOutcome).toBe('treated_on_scene');
    expect(patient.notes).toHaveLength(0);
  });

  it('rejects status without fieldOutcome with a Norwegian 400', async () => {
    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Quick log invalid test', status: 'discharged' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Utfall kreves for å lukke ved registrering');
  });

  it('rejects a status other than discharged even with a fieldOutcome', async () => {
    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Quick log bad status test', fieldOutcome: 'treated_on_scene', status: 'transferred' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('rejects an invalid fieldOutcome', async () => {
    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: 'Quick log bad outcome test', fieldOutcome: 'not-a-real-outcome' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });
});
