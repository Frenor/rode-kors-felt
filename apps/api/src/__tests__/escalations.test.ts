import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getFirstAiderToken, getCoordinatorToken, getEventId } from './helpers.js';

let app: FastifyInstance;
let eventId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

async function createIncident(token: string) {
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

describe('POST /api/incidents/:id/actions (escalation)', () => {
  it('returns 200 with escalation containing path and incidentId', async () => {
    const token = getFirstAiderToken(eventId);
    const coordToken = getCoordinatorToken();
    const incident = await createIncident(token);

    const res = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incident.id}/actions`,
      headers: { Authorization: `Bearer ${coordToken}` },
      payload: { type: 'escalation.raise', path: 'path_a_rk_ambulance', reason: 'Kritisk pasient' },
    });

    expect(res.statusCode).toBe(200);
    const { escalation } = res.json();
    expect(escalation.path).toBe('path_a_rk_ambulance');
    expect(escalation.incidentId).toBe(incident.id);
    expect(escalation.raisedAt).toBeDefined();
  });

  it('returns 409 when incident is already escalated', async () => {
    const token = getFirstAiderToken(eventId);
    const coordToken = getCoordinatorToken();
    const incident = await createIncident(token);

    await app.inject({
      method: 'POST',
      url: `/api/incidents/${incident.id}/actions`,
      headers: { Authorization: `Bearer ${coordToken}` },
      payload: { type: 'escalation.raise', path: 'path_b_113' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/incidents/${incident.id}/actions`,
      headers: { Authorization: `Bearer ${coordToken}` },
      payload: { type: 'escalation.raise', path: 'path_a_rk_ambulance' },
    });

    expect(res.statusCode).toBe(409);
  });
});
