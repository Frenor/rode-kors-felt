import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getFirstAiderToken, getSickbayToken, getEventId } from './helpers.js';

let app: FastifyInstance;
let eventId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

async function createPatientForActions() {
  const token = getFirstAiderToken(eventId);
  const res = await app.inject({
    method: 'POST',
    url: '/api/patients',
    headers: { Authorization: `Bearer ${token}` },
    payload: { eventId, ageGroup: 'adult', presentingComplaint: 'Test' },
  });
  return res.json().patient;
}

describe('Reversible action APIs', () => {
  it('POST /api/patients/:id/actions writes action + status update', async () => {
    const patient = await createPatientForActions();
    const token = getSickbayToken(eventId);
    const actionRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'status.set', status: 'in_treatment' },
    });

    expect(actionRes.statusCode).toBe(200);
    const body = actionRes.json();
    expect(body.patient.status).toBe('in_treatment');
    expect(body.action.actionType).toBe('patient.status_set');
  });

  it('POST /api/actions/:id/undo reverts patient status', async () => {
    const patient = await createPatientForActions();
    const token = getSickbayToken(eventId);
    const updateRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'status.set', status: 'observation' },
    });
    const actionId = updateRes.json().action.id;

    const undoRes = await app.inject({
      method: 'POST',
      url: `/api/actions/${actionId}/undo`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { reason: 'test undo' },
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

  it('POST /api/patients/:id/actions supports multiple sequential status changes', async () => {
    const patient = await createPatientForActions();
    const token = getSickbayToken(eventId);

    const firstRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'status.set', status: 'in_treatment' },
    });
    expect(firstRes.statusCode).toBe(200);

    const secondRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'status.set', status: 'observation' },
    });
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.json().action.actionType).toBe('patient.status_set');
  });

  it('POST /api/patients/:id/actions writes action and can be undone', async () => {
    const patient = await createPatientForActions();
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

describe('AMK notified action (gap B2 data half)', () => {
  it('sets amkNotifiedAt/amkNotifiedBy and is idempotent on a second call', async () => {
    const patient = await createPatientForActions();
    const token = getFirstAiderToken(eventId);

    const first = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'amk.notified', by: 'Alpha' },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.patient.amkNotifiedBy).toBe('Alpha');
    expect(firstBody.patient.amkNotifiedAt).toBeTruthy();
    expect(firstBody.action.actionType).toBe('amk.notified');
    const firstNotifiedAt = firstBody.patient.amkNotifiedAt as string;

    const second = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'amk.notified', by: 'Bravo' },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    // Idempotent: keeps the first time and the first "by", no new action logged.
    expect(secondBody.patient.amkNotifiedAt).toBe(firstNotifiedAt);
    expect(secondBody.patient.amkNotifiedBy).toBe('Alpha');
    expect(secondBody.action).toBeNull();
  });

  it('defaults "by" to the actor when not provided', async () => {
    const patient = await createPatientForActions();
    const token = getSickbayToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'amk.notified' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().patient.amkNotifiedBy).toBe('sickbay');
  });

  it('amk.cleared nulls amkNotifiedAt/amkNotifiedBy', async () => {
    const patient = await createPatientForActions();
    const token = getFirstAiderToken(eventId);

    await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'amk.notified', by: 'Alpha' },
    });

    const clearRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'amk.cleared' },
    });
    expect(clearRes.statusCode).toBe(200);
    const body = clearRes.json();
    expect(body.patient.amkNotifiedAt).toBeNull();
    expect(body.patient.amkNotifiedBy).toBeNull();
    expect(body.action.actionType).toBe('amk.cleared');

    // A second amk.notified after clearing sets a fresh time again.
    const renotify = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'amk.notified' },
    });
    expect(renotify.statusCode).toBe(200);
    expect(renotify.json().patient.amkNotifiedAt).toBeTruthy();
  });
});
