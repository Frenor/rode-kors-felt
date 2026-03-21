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
