import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getCoordinatorToken, getEventId, getFirstAiderToken } from './helpers.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events as eventsTable } from '../db/schema.js';
import { createToken } from '../middleware/auth.js';

let app: FastifyInstance;
let eventId: string;
let teamId: string;

beforeAll(async () => {
  app = await buildApp();
  eventId = await getEventId(app);
  const eventRes = await app.inject({
    method: 'GET',
    url: `/api/events/${eventId}`,
    headers: { authorization: `Bearer ${getCoordinatorToken()}` },
  });
  teamId = eventRes.json().teams[0].id as string;
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

  it('returns 403 for non-privileged token without event scope', async () => {
    const token = createToken({ role: 'first_aider' });
    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
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
    expect(body).toHaveProperty('totalPatients');
    expect(body).toHaveProperty('patientsIncoming');
    expect(body).toHaveProperty('patientsInTreatment');
    expect(body).toHaveProperty('patientsObservation');
    expect(body).toHaveProperty('discharged');
    expect(body).toHaveProperty('transferred');
    expect(typeof body.totalPatients).toBe('number');
    expect(typeof body.patientsIncoming).toBe('number');
    expect(typeof body.patientsInTreatment).toBe('number');
    expect(typeof body.discharged).toBe('number');
    expect(typeof body.transferred).toBe('number');
  });
});

describe('Event debrief report', () => {
  it('downloads a markdown report for the event', async () => {
    const token = getCoordinatorToken();

    const patientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        presentingComplaint: 'Brystsmerter',
      },
    });
    expect(patientRes.statusCode).toBe(201);

    const reportRes = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/report`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(reportRes.statusCode).toBe(200);
    expect(reportRes.headers['content-type']).toContain('text/markdown');
    expect(reportRes.headers['content-disposition']).toContain('rkf-rapport-');
    expect(reportRes.body).toContain('Pasienter totalt');
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

describe('GET /api/events/:id/sickbay-incoming', () => {
  it('returns incoming items with critical reasons', async () => {
    const firstAiderToken = getFirstAiderToken(eventId);
    const coordinatorToken = getCoordinatorToken();

    // Create a patient assigned to the team so needs_assistance applies
    const patientRes = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        label: 'Innkommende-testpasient',
        assignedTeamId: teamId,
      },
    });
    expect(patientRes.statusCode).toBe(201);
    const patientId = patientRes.json().patient.id as string;

    // Set team status to needs_assistance
    const statusActionRes = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
      payload: {
        type: 'team.status_set',
        status: 'needs_assistance',
        clientActionId: crypto.randomUUID(),
      },
    });
    expect(statusActionRes.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/sickbay-incoming`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    const item = body.items.find((row: { patientId: string }) => row.patientId === patientId);
    expect(item).toBeTruthy();
    expect(item.critical).toBe(true);
    expect(item.criticalReasons).toContain('needs_assistance');
  });
});
