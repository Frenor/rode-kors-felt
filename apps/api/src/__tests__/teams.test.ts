import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  buildApp,
  getCoordinatorToken,
  getEventId,
  getFirstAiderToken,
  getSickbayToken,
} from './helpers.js';

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

describe('POST /api/teams/:teamId/actions', () => {
  it('creates a team status action and deduplicates on same clientActionId', async () => {
    const token = getFirstAiderToken(eventId);
    const payload = {
      type: 'team.status_set',
      status: 'needs_assistance',
      clientActionId: randomUUID(),
    };

    const first = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().action.actionType).toBe('team.status_set');

    const second = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().deduplicated).toBe(true);
  });

  it('returns 403 when event scope does not match', async () => {
    const token = getFirstAiderToken(randomUUID());
    const res = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'team.status_set',
        status: 'available',
        clientActionId: randomUUID(),
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('derives team status en_route when patient engagement is en_route_to_patient', async () => {
    const token = getFirstAiderToken(eventId);

    // Reset team status to available
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.status_set', status: 'available', clientActionId: randomUUID() },
    });

    const sickbayToken = getSickbayToken(eventId);
    const patientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${sickbayToken}` },
      payload: { eventId, ageGroup: 'adult', presentingComplaint: 'Hodepine' },
    });
    const patientId = patientRes.json().patient.id as string;

    const actionRes = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'team.patient_status_set',
        patientId,
        engagementStatus: 'en_route_to_patient',
        clientActionId: randomUUID(),
      },
    });
    expect(actionRes.statusCode).toBe(201);
    expect(actionRes.json().action.actionType).toBe('team.patient_status_set');

    const workspaceRes = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(workspaceRes.statusCode).toBe(200);
    expect(workspaceRes.json().latestStatus).toBe('en_route');
  });

  it('derives team status on_scene when patient engagement is monitoring', async () => {
    const token = getFirstAiderToken(eventId);

    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.status_set', status: 'available', clientActionId: randomUUID() },
    });

    const sickbayToken = getSickbayToken(eventId);
    const patientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${sickbayToken}` },
      payload: { eventId, ageGroup: 'adult', presentingComplaint: 'Svimmelhet' },
    });
    const patientId = patientRes.json().patient.id as string;

    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'team.patient_status_set',
        patientId,
        engagementStatus: 'monitoring',
        clientActionId: randomUUID(),
      },
    });

    const workspaceRes = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(workspaceRes.statusCode).toBe(200);
    expect(workspaceRes.json().latestStatus).toBe('on_scene');
  });

  it('does not override needs_assistance status with derived team status', async () => {
    const token = getFirstAiderToken(eventId);

    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.status_set', status: 'needs_assistance', clientActionId: randomUUID() },
    });

    const sickbayToken = getSickbayToken(eventId);
    const patientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${sickbayToken}` },
      payload: { eventId, ageGroup: 'adult', presentingComplaint: 'Brystsmerter' },
    });
    const patientId = patientRes.json().patient.id as string;

    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'team.patient_status_set',
        patientId,
        engagementStatus: 'monitoring',
        clientActionId: randomUUID(),
      },
    });

    const workspaceRes = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(workspaceRes.statusCode).toBe(200);
    expect(workspaceRes.json().latestStatus).toBe('needs_assistance');
  });
});

describe('GET /api/teams/:teamId/workspace', () => {
  it('returns assigned, monitored and unassigned patient buckets', async () => {
    const firstAiderToken = getFirstAiderToken(eventId);
    const sickbayToken = getSickbayToken(eventId);

    const incidentRes = await app.inject({
      method: 'POST',
      url: '/api/incidents',
      headers: { authorization: `Bearer ${firstAiderToken}` },
      payload: {
        eventId,
        teamId,
        type: 'medical',
        location: { lat: 59.91, lng: 10.75 },
      },
    });
    expect(incidentRes.statusCode).toBe(201);
    const incidentId = incidentRes.json().incident.id as string;

    const assignedPatientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${sickbayToken}` },
      payload: {
        eventId,
        incidentId,
        ageGroup: 'adult',
        presentingComplaint: 'Smerter',
      },
    });
    expect(assignedPatientRes.statusCode).toBe(201);
    const assignedPatientId = assignedPatientRes.json().patient.id as string;

    const unassignedPatientRes = await app.inject({
      method: 'POST',
      url: '/api/patients',
      headers: { authorization: `Bearer ${sickbayToken}` },
      payload: {
        eventId,
        ageGroup: 'adult',
        presentingComplaint: 'Kontroll',
      },
    });
    expect(unassignedPatientRes.statusCode).toBe(201);
    const unassignedPatientId = unassignedPatientRes.json().patient.id as string;

    const monitorAction = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
      payload: {
        type: 'team.monitor_started',
        patientId: unassignedPatientId,
        clientActionId: randomUUID(),
      },
    });
    expect(monitorAction.statusCode).toBe(201);

    const workspaceRes = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${firstAiderToken}` },
    });
    expect(workspaceRes.statusCode).toBe(200);

    const body = workspaceRes.json();
    expect(body.teamId).toBe(teamId);
    expect(Array.isArray(body.assignedPatients)).toBe(true);
    expect(Array.isArray(body.monitoredPatients)).toBe(true);
    expect(Array.isArray(body.unassignedPatients)).toBe(true);
    expect(body.assignedPatients.some((p: { id: string }) => p.id === assignedPatientId)).toBe(true);
    expect(body.monitoredPatients.some((p: { id: string }) => p.id === unassignedPatientId)).toBe(true);
  });
});

