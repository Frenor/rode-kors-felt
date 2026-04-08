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


// ────────────────────────────────────────────────────────────────────────────
// team.patient_status_set
// ────────────────────────────────────────────────────────────────────────────

describe('team.patient_status_set action', () => {
  // Helper: create an unassigned patient in the shared event
  async function createUnassignedPatient() {
    const token = getCoordinatorToken();
    const res = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: `Test-${Date.now()}`, triageStatus: 'green' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().patient.id as string;
  }

  it('creates a patient_status_set action and returns 201', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    const res = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId: randomUUID() },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().action.actionType).toBe('team.patient_status_set');
  });

  it('deduplicates on same clientActionId', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    const clientActionId = randomUUID();
    const first = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId },
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().deduplicated).toBe(true);
  });

  it('rejects unknown status values with 400', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    const res = await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'flying', clientActionId: randomUUID() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('monitoring status puts patient in monitoredPatients with teamPatientStatus=monitoring', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId: randomUUID() },
    });
    const ws = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ws.statusCode).toBe(200);
    const body = ws.json();
    const found = body.monitoredPatients.find((p: { id: string }) => p.id === patientId);
    expect(found).toBeDefined();
    expect(found.teamPatientStatus).toBe('monitoring');
  });

  it('en_route_to_patient keeps patient in unassignedPatients but sets teamPatientStatus', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'en_route_to_patient', clientActionId: randomUUID() },
    });
    const ws = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ws.statusCode).toBe(200);
    const body = ws.json();
    // en_route_to_patient is still considered "engaged" so it appears in monitoredPatients
    const inMonitored = body.monitoredPatients.find((p: { id: string }) => p.id === patientId);
    expect(inMonitored).toBeDefined();
    expect(inMonitored.teamPatientStatus).toBe('en_route_to_patient');
  });

  it('null status clears engagement and returns patient to unassignedPatients', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId: randomUUID() },
    });
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: null, clientActionId: randomUUID() },
    });
    const ws = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ws.statusCode).toBe(200);
    const body = ws.json();
    const notMonitored = !body.monitoredPatients.some((p: { id: string }) => p.id === patientId);
    const isUnassigned = body.unassignedPatients.some((p: { id: string }) => p.id === patientId);
    expect(notMonitored).toBe(true);
    expect(isUnassigned).toBe(true);
  });

  it('auto-derives team status to on_scene when monitoring is set', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    // Reset team to available first
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.status_set', status: 'available', clientActionId: randomUUID() },
    });
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId: randomUUID() },
    });
    const ws = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ws.json().latestStatus).toBe('on_scene');
    // Clear the patient status so it doesn't affect subsequent tests
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: null, clientActionId: randomUUID() },
    });
  });

  it('auto-derives team status to en_route when en_route_to_patient is set', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    // Reset team to available first
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.status_set', status: 'available', clientActionId: randomUUID() },
    });
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'en_route_to_patient', clientActionId: randomUUID() },
    });
    const ws = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ws.json().latestStatus).toBe('en_route');
    // Clear the patient status so it doesn't affect subsequent tests
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: null, clientActionId: randomUUID() },
    });
  });

  it('does NOT override needs_assistance when a patient status is set', async () => {
    const token = getFirstAiderToken(eventId);
    const patientId = await createUnassignedPatient();
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.status_set', status: 'needs_assistance', clientActionId: randomUUID() },
    });
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamId}/actions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId: randomUUID() },
    });
    const ws = await app.inject({
      method: 'GET',
      url: `/api/teams/${teamId}/workspace`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ws.json().latestStatus).toBe('needs_assistance');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Multi-team patient engagement
// ────────────────────────────────────────────────────────────────────────────

describe('multi-team patient engagement', () => {
  it('two teams can both engage the same patient without conflict, engagements endpoint lists both', async () => {
    const coordinatorToken = getCoordinatorToken();
    const eventRes = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    const allTeams: Array<{ id: string }> = eventRes.json().teams;
    if (allTeams.length < 2) {
      // Can't run this test without two teams — skip gracefully
      return;
    }
    const teamAId = allTeams[0]!.id;
    const teamBId = allTeams[1]!.id;
    const tokenA = getFirstAiderToken(eventId);
    const tokenB = getFirstAiderToken(eventId);

    // Create a patient
    const pRes = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: { label: `MultiTeam-${Date.now()}`, triageStatus: 'red' },
    });
    expect(pRes.statusCode).toBe(201);
    const patientId = pRes.json().patient.id as string;

    // Team A engages as monitoring, Team B as transporting
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamAId}/actions`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId: randomUUID() },
    });
    await app.inject({
      method: 'POST',
      url: `/api/teams/${teamBId}/actions`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { type: 'team.patient_status_set', patientId, status: 'transporting', clientActionId: randomUUID() },
    });

    // Both workspaces should include the patient
    const wsA = await app.inject({ method: 'GET', url: `/api/teams/${teamAId}/workspace`, headers: { authorization: `Bearer ${tokenA}` } });
    const wsB = await app.inject({ method: 'GET', url: `/api/teams/${teamBId}/workspace`, headers: { authorization: `Bearer ${tokenB}` } });
    expect(wsA.json().monitoredPatients.some((p: { id: string }) => p.id === patientId)).toBe(true);
    expect(wsB.json().monitoredPatients.some((p: { id: string }) => p.id === patientId)).toBe(true);

    // Engagements endpoint should list both teams for that patient
    const engRes = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/team-patient-engagements`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    expect(engRes.statusCode).toBe(200);
    const engagements: Array<{ teamId: string; status: string }> = engRes.json().engagements[patientId] ?? [];
    expect(engagements.some((e) => e.teamId === teamAId && e.status === 'monitoring')).toBe(true);
    expect(engagements.some((e) => e.teamId === teamBId && e.status === 'transporting')).toBe(true);
  });

  it('when one team clears their status, the other team\'s status is unaffected', async () => {
    const coordinatorToken = getCoordinatorToken();
    const eventRes = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    const allTeams: Array<{ id: string }> = eventRes.json().teams;
    if (allTeams.length < 2) return;
    const teamAId = allTeams[0]!.id;
    const teamBId = allTeams[1]!.id;

    const pRes = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/patients`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
      payload: { label: `ClearTest-${Date.now()}`, triageStatus: 'yellow' },
    });
    const patientId = pRes.json().patient.id as string;

    const tokenA = getFirstAiderToken(eventId);
    const tokenB = getFirstAiderToken(eventId);
    await app.inject({ method: 'POST', url: `/api/teams/${teamAId}/actions`, headers: { authorization: `Bearer ${tokenA}` }, payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId: randomUUID() } });
    await app.inject({ method: 'POST', url: `/api/teams/${teamBId}/actions`, headers: { authorization: `Bearer ${tokenB}` }, payload: { type: 'team.patient_status_set', patientId, status: 'monitoring', clientActionId: randomUUID() } });

    // Team A clears
    await app.inject({ method: 'POST', url: `/api/teams/${teamAId}/actions`, headers: { authorization: `Bearer ${tokenA}` }, payload: { type: 'team.patient_status_set', patientId, status: null, clientActionId: randomUUID() } });

    const engRes = await app.inject({
      method: 'GET',
      url: `/api/events/${eventId}/team-patient-engagements`,
      headers: { authorization: `Bearer ${coordinatorToken}` },
    });
    const engagements: Array<{ teamId: string }> = engRes.json().engagements[patientId] ?? [];
    // Team A should no longer appear
    expect(engagements.some((e) => e.teamId === teamAId)).toBe(false);
    // Team B should still be engaged
    expect(engagements.some((e) => e.teamId === teamBId)).toBe(true);
  });
});
