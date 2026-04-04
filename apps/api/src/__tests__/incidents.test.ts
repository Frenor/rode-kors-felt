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

describe('GET /api/incidents', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/incidents?eventId=${eventId}`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with incidents array for first_aider auth', async () => {
    const token = getFirstAiderToken(eventId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/incidents?eventId=${eventId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('incidents');
    expect(Array.isArray(body.incidents)).toBe(true);
  });
});

describe('POST /api/incidents', () => {
  it('creates an incident and returns 201 with id, type, status on_scene', async () => {
    const token = getFirstAiderToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        type: 'medical',
        location: { lat: 59.9139, lng: 10.7522 },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('incident');
    expect(body.incident).toHaveProperty('id');
    expect(body.incident.type).toBe('medical');
    expect(body.incident.status).toBe('on_scene');
  });

  it('persists additive locationContext for indoor incidents', async () => {
    const token = getFirstAiderToken(eventId);
    const locationContext = {
      mode: 'indoor_zone' as const,
      venueId: 'venue-1',
      floorId: 'floor-2',
      zoneId: 'zone-b',
      zoneLabel: 'Sone B',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        type: 'medical',
        location: { lat: 59.9139, lng: 10.7522 },
        locationContext,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const incidentId = createRes.json().incident.id as string;
    expect(createRes.json().incident.locationContext).toEqual(locationContext);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/incidents/${incidentId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().incident.locationContext).toEqual(locationContext);
  });

  it('deduplicates: second POST with same clientId returns the original incident', async () => {
    const token = getFirstAiderToken(eventId);
    const clientId = `dedup-test-${Date.now()}`;

    const payload = {
      eventId,
      type: 'trauma',
      location: { lat: 59.9, lng: 10.75 },
      clientId,
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    expect(first.statusCode).toBe(201);
    const originalId = first.json().incident.id;

    const second = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    const secondBody = second.json();
    expect(secondBody).toHaveProperty('incident');
    expect(secondBody.incident.id).toBe(originalId);
    expect(secondBody.deduplicated).toBe(true);
  });
});

describe('PATCH /api/incidents/:id', () => {
  it('updates incident status and returns 200', async () => {
    const firstAiderToken = getFirstAiderToken(eventId);
    const coordinatorToken = getCoordinatorToken();

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { authorization: `Bearer ${firstAiderToken}` },
      payload: {
        eventId,
        type: 'medical',
        location: { lat: 59.9139, lng: 10.7522 },
      },
    });

    const incidentId = createRes.json().incident.id;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/incidents/${incidentId}`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: { status: 'resolved' },
    });

    expect(patchRes.statusCode).toBe(200);
    const body = patchRes.json();
    expect(body).toHaveProperty('incident');
    expect(body.incident.status).toBe('resolved');
  });
});

describe('Incident event scoping', () => {
  it('rejects access to an incident from another event', async () => {
    const coordinatorToken = getCoordinatorToken();
    const firstAiderToken = getFirstAiderToken(eventId);

    const eventRes = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        name: `Fremmed hendelse ${Date.now()}`,
        startDate: '2026-04-04T08:00:00.000Z',
        endDate: '2026-04-04T18:00:00.000Z',
      },
    });
    const foreignEventId = eventRes.json().event.id as string;

    const incidentRes = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        eventId: foreignEventId,
        type: 'medical',
        location: { lat: 59.9139, lng: 10.7522 },
      },
    });
    const foreignIncidentId = incidentRes.json().incident.id as string;

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/incidents/${foreignIncidentId}`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
    });

    expect(getRes.statusCode).toBe(403);
  });
});
