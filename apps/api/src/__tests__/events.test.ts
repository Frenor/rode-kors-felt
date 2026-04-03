import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getCoordinatorToken, getEventId } from './helpers.js';

let app: FastifyInstance;
let eventId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/events', () => {
  it('returns 200 with events array for coordinator auth', async () => {
    const token = getCoordinatorToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/events',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('events');
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/events/:id', () => {
  it('returns 200 with event and teams', async () => {
    const token = getCoordinatorToken();

    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('event');
    expect(body.event.id).toBe(eventId);
    expect(body).toHaveProperty('teams');
    expect(Array.isArray(body.teams)).toBe(true);
  });
});

describe('GET /api/events/:id/stats', () => {
  it('returns 200 with stat fields', async () => {
    const token = getCoordinatorToken();

    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/stats`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('totalIncidents');
    expect(body).toHaveProperty('activeIncidents');
    expect(body).toHaveProperty('resolvedIncidents');
    expect(body).toHaveProperty('totalPatients');
    expect(typeof body.totalIncidents).toBe('number');
    expect(typeof body.activeIncidents).toBe('number');
    expect(typeof body.resolvedIncidents).toBe('number');
    expect(typeof body.totalPatients).toBe('number');
  });
});

describe('MCI deactivation summary', () => {
  it('generates downloadable MCI handover summary when deactivated', async () => {
    const token = getCoordinatorToken();

    const incidentRes = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        type: 'medical',
        source: 'coordinator',
        teamId: null,
        location: { lat: 59.9139, lng: 10.7522 },
        triageTag: 'immediate',
      },
    });
    expect(incidentRes.statusCode).toBe(201);
    const incidentId = incidentRes.json().incident.id as string;

    const patientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        incidentId,
        ageGroup: 'adult',
        presentingComplaint: 'Brystsmerter',
      },
    });
    expect(patientRes.statusCode).toBe(201);

    const activateRes = await app.inject({
      method: 'PATCH',
      url: `/api/events/${eventId}/mci`,
      headers: { authorization: `Bearer ${token}` },
      payload: { mciActive: true },
    });
    expect(activateRes.statusCode).toBe(200);

    const deactivateRes = await app.inject({
      method: 'PATCH',
      url: `/api/events/${eventId}/mci`,
      headers: { authorization: `Bearer ${token}` },
      payload: { mciActive: false },
    });
    expect(deactivateRes.statusCode).toBe(200);

    const summaryRes = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/mci-summary`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(summaryRes.statusCode).toBe(200);
    expect(summaryRes.headers['content-type']).toContain('text/html');
    expect(summaryRes.headers['content-disposition']).toContain('rkf-mci-overlevering-');
    expect(summaryRes.body).toContain('MCI-overlevering');
    expect(summaryRes.body).toContain('Umiddelbar (rød)');
  });
});
