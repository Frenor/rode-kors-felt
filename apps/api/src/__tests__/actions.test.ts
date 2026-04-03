import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getFirstAiderToken, getSickbayToken, getCoordinatorToken, getEventId } from './helpers.js';

let app: FastifyInstance;
let eventId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

async function createIncident() {
  const token = getFirstAiderToken(eventId);
  const res = await app.inject({
    method: 'POST',
    url: '/api/incidents',
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      eventId,
      type: 'medical',
      location: { lat: 59.964, lng: 10.776 },
    },
  });
  return res.json().incident;
}

async function createPatient() {
  const token = getSickbayToken(eventId);
  const res = await app.inject({
    method: 'POST',
    url: '/api/patients',
    headers: { Authorization: `Bearer ${token}` },
    payload: { eventId, ageGroup: 'adult', presentingComplaint: 'Test' },
  });
  return res.json().patient;
}

describe('Reversible action APIs', () => {
  it('POST /api/incidents/:id/actions writes action + status update', async () => {
    const incident = await createIncident();
    const token = getCoordinatorToken();
    const actionRes = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incident.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'status.set', status: 'transporting' },
    });

    expect(actionRes.statusCode).toBe(200);
    const body = actionRes.json();
    expect(body.incident.status).toBe('transporting');
    expect(body.action.actionType).toBe('incident.status_set');
  });

  it('POST /api/actions/:id/undo reverts incident status', async () => {
    const incident = await createIncident();
    const token = getCoordinatorToken();
    const updateRes = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incident.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'status.set', status: 'resolved' },
    });
    const actionId = updateRes.json().action.id;

    const undoRes = await app.inject({
      method: 'POST',
      url: `/api/actions/${actionId}/undo`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { reason: 'test undo' },
    });
    expect(undoRes.statusCode).toBe(200);
    expect(undoRes.json().undoAction.actionType).toBe('incident.status_undo');

    const readRes = await app.inject({
      method: 'GET',
      url: `/api/incidents/${incident.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(readRes.statusCode).toBe(200);
    expect(readRes.json().incident.status).toBe('on_scene');
  });

  it('DELETE /api/incidents/:id/escalate stays compatible and emits action metadata', async () => {
    const incident = await createIncident();
    const token = getCoordinatorToken();

    await app.inject({
      method: 'POST',
      url: `/api/incidents/${incident.id}/escalate`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { path: 'path_a_rk_ambulance' },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/incidents/${incident.id}/escalate`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().action.actionType).toBe('incident.escalation_resolved');
  });

  it('POST /api/patients/:id/actions writes action and can be undone', async () => {
    const patient = await createPatient();
    const token = getSickbayToken(eventId);

    const actionRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'status.set', status: 'observation' },
    });
    expect(actionRes.statusCode).toBe(200);
    expect(actionRes.json().action.actionType).toBe('patient.status_set');
    const actionId = actionRes.json().action.id;

    const undoRes = await app.inject({
      method: 'POST',
      url: `/api/actions/${actionId}/undo`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(undoRes.statusCode).toBe(200);
    expect(undoRes.json().undoAction.actionType).toBe('patient.status_undo');

    const readRes = await app.inject({
      method: 'GET',
      url: `/api/patients/${patient.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(readRes.statusCode).toBe(200);
    expect(readRes.json().patient.status).toBe('incoming');
  });
});
