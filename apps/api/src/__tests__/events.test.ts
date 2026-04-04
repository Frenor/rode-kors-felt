import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getCoordinatorToken, getEventId, getFirstAiderToken } from './helpers.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events as eventsTable } from '../db/schema.js';

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

describe('Indoor layout and map config', () => {
  it('returns an indoor layout stored on the event', async () => {
    const token = getCoordinatorToken();
    const indoorLayout = {
      venueId: 'venue-1',
      venueName: 'Hovedarena',
      floors: [
        {
          id: 'floor-1',
          label: '1. etasje',
          zones: [
            { id: 'zone-a', label: 'Sone A', center: { lat: 59.9139, lng: 10.7522 } },
          ],
        },
      ],
    };

    await db
      .update(eventsTable)
      .set({ indoorLayout })
      .where(eq(eventsTable.id, eventId));

    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/indoor-layout`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().layout).toEqual(indoorLayout);
  });

  it('falls back to MAP_CONFIG_JSON for map config', async () => {
    const token = getCoordinatorToken();
    const previous = process.env.MAP_CONFIG_JSON;
    process.env.MAP_CONFIG_JSON = JSON.stringify({
      default: {
        provider: 'maplibre',
        styleUrl: 'https://maps.example/style.json',
        enable3d: true,
        layers: [
          {
            id: 'base-xyz',
            type: 'xyz',
            url: 'https://tiles.example/{z}/{x}/{y}.png',
            attribution: 'Example Maps',
          },
        ],
      },
    });

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/events/${eventId}/map-config`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().config).toMatchObject({
        provider: 'maplibre',
        styleUrl: 'https://maps.example/style.json',
        enable3d: true,
      });
      expect(res.json().config.layers).toHaveLength(1);
    } finally {
      if (previous === undefined) {
        delete process.env.MAP_CONFIG_JSON;
      } else {
        process.env.MAP_CONFIG_JSON = previous;
      }
    }
  });

  it('blocks access to another event', async () => {
    const coordinatorToken = getCoordinatorToken();
    const firstAiderToken = getFirstAiderToken(eventId);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        name: `Fremmed arrangement ${Date.now()}`,
        startDate: '2026-04-04T08:00:00.000Z',
        endDate: '2026-04-04T18:00:00.000Z',
      },
    });
    const foreignEventId = createRes.json().event.id as string;

    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${foreignEventId}/indoor-layout`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
