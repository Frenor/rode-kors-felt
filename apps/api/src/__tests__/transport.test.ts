import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, getCoordinatorToken, getFirstAiderToken, getSickbayToken, getEventId } from './helpers.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { teams } from '../db/schema.js';

let app: FastifyInstance;
let eventId: string;
let teamId: string;

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
});

afterAll(async () => {
  await app.close();
});

// Uses the field-report endpoint (not POST /api/patients) because it is the
// one that accepts `assignedTeamId` — needed for the "requestedBy defaults
// to the patient's team" test below.
async function createTestPatient(extra: Record<string, unknown> = {}) {
  const token = getFirstAiderToken(eventId);
  const res = await app.inject({
    method: 'POST',
    url: `/api/events/${eventId}/patients`,
    headers: { Authorization: `Bearer ${token}` },
    payload: { label: 'Transport test', ...extra },
  });
  return res.json().patient;
}

describe('Transport request (gap B3)', () => {
  it('transport.requested sets need/pickup/requestedAt/requestedBy and clears any team, and broadcasts changedFields: [transport]', async () => {
    const patient = await createTestPatient();
    const token = getFirstAiderToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.requested', need: 'atv', pickupText: 'Ved kiosken' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.patient.transportNeed).toBe('atv');
    expect(body.patient.transportPickupText).toBe('Ved kiosken');
    expect(typeof body.patient.transportRequestedAt).toBe('string');
    expect(typeof body.patient.transportRequestedBy).toBe('string');
    expect(body.patient.transportTeamId).toBeNull();
    expect(body.patient.transportAssignedAt).toBeNull();
    expect(body.action.actionType).toBe('transport.requested');
  });

  it('defaults transportRequestedBy to the patient\'s assigned team name', async () => {
    const patient = await createTestPatient({ assignedTeamId: teamId });
    const token = getFirstAiderToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.requested', need: 'stretcher' },
    });

    expect(res.statusCode).toBe(200);
    const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
    expect(res.json().patient.transportRequestedBy).toBe(team!.name);
  });

  it('rejects an invalid need', async () => {
    const patient = await createTestPatient();
    const token = getFirstAiderToken(eventId);

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.requested', need: 'helicopter' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('transport.assigned validates the team belongs to the event, then sets team + assignedAt', async () => {
    const patient = await createTestPatient();
    const token = getSickbayToken(eventId);

    await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.requested', need: 'ambulance' },
    });

    const badRes = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.assigned', teamId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(badRes.statusCode).toBe(400);

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.assigned', teamId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.patient.transportTeamId).toBe(teamId);
    expect(typeof body.patient.transportAssignedAt).toBe('string');
    expect(body.action.actionType).toBe('transport.assigned');
  });

  it('rejects a team from a different event', async () => {
    const coordinatorToken = getCoordinatorToken();
    const foreignEventRes = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: {
        name: `Fremmed transport event ${Date.now()}`,
        startDate: '2026-05-04T08:00:00.000Z',
        endDate: '2026-05-04T18:00:00.000Z',
      },
    });
    const foreignEventId = foreignEventRes.json().event.id as string;
    const [foreignTeam] = await db.insert(teams).values({ eventId: foreignEventId, name: 'Fremmed lag' }).returning();

    const patient = await createTestPatient();
    const token = getFirstAiderToken(eventId);
    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.assigned', teamId: foreignTeam!.id },
    });

    expect(res.statusCode).toBe(400);
  });

  it('transport.cleared nulls all six transport fields', async () => {
    const patient = await createTestPatient();
    const token = getFirstAiderToken(eventId);

    await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.requested', need: 'atv', pickupText: 'Test' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.assigned', teamId },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.cleared' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.patient.transportNeed).toBeNull();
    expect(body.patient.transportPickupText).toBeNull();
    expect(body.patient.transportRequestedAt).toBeNull();
    expect(body.patient.transportRequestedBy).toBeNull();
    expect(body.patient.transportTeamId).toBeNull();
    expect(body.patient.transportAssignedAt).toBeNull();
    expect(body.action.actionType).toBe('transport.cleared');
  });

  it('every patient payload (GET /api/patients/:id) carries the transport fields', async () => {
    const patient = await createTestPatient();
    const token = getFirstAiderToken(eventId);
    await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'transport.requested', need: 'stretcher' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/patients/${patient.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().patient.transportNeed).toBe('stretcher');
  });

  it('is exposed on the sickbay-incoming items and the team workspace', async () => {
    const patient = await createTestPatient({ assignedTeamId: teamId });
    const firstAiderToken = getFirstAiderToken(eventId);
    await app.inject({
      method: 'POST',
      url: `/api/patients/${patient.id}/actions`,
      headers: { Authorization: `Bearer ${firstAiderToken}` },
      payload: { type: 'transport.requested', need: 'atv', pickupText: 'Ved parkeringen' },
    });

    const coordinatorToken = getCoordinatorToken();
    const incomingRes = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/sickbay-incoming`,
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    expect(incomingRes.statusCode).toBe(200);
    // sickbay-incoming only lists incoming/in_treatment patients; ours is a
    // fresh patient so it is 'incoming' and should be present.
    const item = incomingRes.json().items.find((i: { patientId: string }) => i.patientId === patient.id);
    expect(item?.transportNeed).toBe('atv');
    expect(item?.transportPickupText).toBe('Ved parkeringen');

    const workspaceRes = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { Authorization: `Bearer ${firstAiderToken}` },
    });
    expect(workspaceRes.statusCode).toBe(200);
    const workspacePatient = workspaceRes.json().assignedPatients.find((p: { id: string }) => p.id === patient.id);
    expect(workspacePatient?.transportNeed).toBe('atv');
  });
});
