import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  TeamActionRequest,
  TeamWorkspaceResponse,
  type TeamOperationalStatus,
} from '@rkf/shared-types';
import { db } from '../db/index.js';
import { actionEvents, incidents, patients, teams } from '../db/schema.js';
import { canAccessEvent, requireAuth, requireRole } from '../middleware/auth.js';
import { mapAction } from './action-events.js';
import { broadcast } from './ws.js';

type AuthUser = {
  role?: string;
  eventId?: string;
  sub?: string;
  email?: string;
  codeId?: string;
};

function getActor(user: AuthUser): string {
  const actor = user.sub ?? user.email ?? (user.codeId ? `code:${user.codeId}` : undefined) ?? user.role;
  if (!actor) {
    const err = new Error('Token mangler identitet') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  return actor;
}

const TransportUpdateBody = z.object({
  transport: z.enum(['foot', 'bike', 'vehicle', 'atv']),
});

const TeamProfileBody = z.object({
  gear: z.array(z.string().max(50)).max(30).optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  contactRadio: z.string().max(50).nullable().optional(),
});

export async function teamRoutes(app: FastifyInstance) {
  app.get('/:teamId', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { teamId } = request.params as { teamId: string };
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return reply.code(404).send({ error: 'Lag ikke funnet' });
    if (!canAccessEvent(user, team.eventId)) return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    return { team: { ...team, lastPositionUpdate: team.lastPositionUpdate?.toISOString() ?? null } };
  });

  app.patch('/:teamId/transport', { preHandler: [requireAuth, requireRole(['first_aider', 'coordinator', 'admin'])] }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { teamId } = request.params as { teamId: string };
    const parsed = TransportUpdateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Ugyldig transporttype', details: parsed.error.flatten() });
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return reply.code(404).send({ error: 'Lag ikke funnet' });
    if (!canAccessEvent(user, team.eventId)) return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });

    const [updated] = await db
      .update(teams)
      .set({ transport: parsed.data.transport })
      .where(eq(teams.id, teamId))
      .returning();

    broadcast({
      type: 'team.transport_changed',
      eventId: team.eventId,
      payload: { teamId, transport: parsed.data.transport },
      timestamp: new Date().toISOString(),
    });

    return { team: { id: updated!.id, transport: updated!.transport } };
  });

  app.patch('/:teamId/profile', { preHandler: [requireAuth, requireRole(['first_aider', 'coordinator', 'admin'])] }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { teamId } = request.params as { teamId: string };
    const parsed = TeamProfileBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Ugyldig profildata', details: parsed.error.flatten() });
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return reply.code(404).send({ error: 'Lag ikke funnet' });
    if (!canAccessEvent(user, team.eventId)) return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });

    const updates: Partial<typeof teams.$inferInsert> = {};
    if (parsed.data.gear !== undefined) updates.gear = parsed.data.gear;
    if (parsed.data.contactPhone !== undefined) updates.contactPhone = parsed.data.contactPhone;
    if (parsed.data.contactRadio !== undefined) updates.contactRadio = parsed.data.contactRadio;

    const [updated] = await db.update(teams).set(updates).where(eq(teams.id, teamId)).returning();

    broadcast({
      type: 'team.profile_updated',
      eventId: team.eventId,
      payload: { teamId, contactPhone: updated!.contactPhone, contactRadio: updated!.contactRadio },
      timestamp: new Date().toISOString(),
    });

    return { team: { id: updated!.id, gear: updated!.gear, contactPhone: updated!.contactPhone, contactRadio: updated!.contactRadio } };
  });

  app.post('/:teamId/actions', { preHandler: [requireAuth, requireRole(['first_aider', 'coordinator', 'admin'])] }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { teamId } = request.params as { teamId: string };
    const parsed = TeamActionRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Ugyldig team action payload', details: parsed.error.flatten() });
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) {
      return reply.code(404).send({ error: 'Lag ikke funnet' });
    }
    if (!canAccessEvent(user, team.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const payload = parsed.data;
    const existingRows = await db
      .select()
      .from(actionEvents)
      .where(and(
        eq(actionEvents.eventId, team.eventId),
        eq(actionEvents.entityType, 'team'),
        eq(actionEvents.entityId, team.id),
        eq(actionEvents.actionType, payload.type),
      ))
      .orderBy(desc(actionEvents.createdAt))
      .limit(200);

    const existing = existingRows.find((row) => {
      const data = row.payload as { clientActionId?: string };
      return data.clientActionId === payload.clientActionId;
    });
    if (existing) {
      return { action: mapAction(existing), deduplicated: true };
    }

    const actionPayload: Record<string, unknown> = { clientActionId: payload.clientActionId };
    if (payload.type === 'team.status_set') {
      actionPayload.status = payload.status;
      actionPayload.incidentId = payload.incidentId ?? null;
      actionPayload.note = payload.note ?? null;
    } else {
      actionPayload.patientId = payload.patientId;
    }

    const [created] = await db
      .insert(actionEvents)
      .values({
        eventId: team.eventId,
        entityType: 'team',
        entityId: team.id,
        actionType: payload.type,
        payload: actionPayload,
        createdBy: getActor(user),
      })
      .returning();

    const action = mapAction(created!);
    const wsType = payload.type === 'team.status_set' ? 'team.status_changed' : 'team.session_changed';
    broadcast({
      type: wsType,
      eventId: team.eventId,
      payload: {
        teamId: team.id,
        actionType: payload.type,
        action,
      },
      timestamp: action.createdAt,
    });

    return reply.code(201).send({ action });
  });

  app.get('/:teamId/workspace', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { teamId } = request.params as { teamId: string };

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) {
      return reply.code(404).send({ error: 'Lag ikke funnet' });
    }
    if (!canAccessEvent(user, team.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const [incidentRows, patientRows, teamActionRows] = await Promise.all([
      db.select().from(incidents).where(and(eq(incidents.eventId, team.eventId), eq(incidents.teamId, team.id))).orderBy(desc(incidents.updatedAt)),
      db.select().from(patients).where(eq(patients.eventId, team.eventId)).orderBy(desc(patients.updatedAt)),
      db
        .select()
        .from(actionEvents)
        .where(and(
          eq(actionEvents.eventId, team.eventId),
          eq(actionEvents.entityType, 'team'),
          eq(actionEvents.entityId, team.id),
        ))
        .orderBy(desc(actionEvents.createdAt)),
    ]);

    const assignedIncidentIds = new Set(incidentRows.map((row) => row.id));
    const assignedPatients = patientRows.filter((row) => row.incidentId && assignedIncidentIds.has(row.incidentId));

    const monitorSet = new Set<string>();
    const statusAction = teamActionRows.find((row) => row.actionType === 'team.status_set');
    let latestStatus: TeamOperationalStatus = 'available';
    if (statusAction) {
      const status = (statusAction.payload as { status?: TeamOperationalStatus }).status;
      if (status) latestStatus = status;
    }

    // Replay monitor actions oldest->newest
    const monitorActions = [...teamActionRows]
      .filter((row) => row.actionType === 'team.monitor_started' || row.actionType === 'team.monitor_stopped')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let activePatientId: string | null = null;
    for (const row of monitorActions) {
      const patientId = (row.payload as { patientId?: string }).patientId;
      if (!patientId) continue;
      if (row.actionType === 'team.monitor_started') {
        monitorSet.add(patientId);
        activePatientId = patientId;
      } else {
        monitorSet.delete(patientId);
        if (activePatientId === patientId) activePatientId = null;
      }
    }

    const assignedSet = new Set(assignedPatients.map((row) => row.id));
    const monitoredPatients = patientRows.filter((row) => monitorSet.has(row.id) && !assignedSet.has(row.id));
    const monitoredSet = new Set(monitoredPatients.map((row) => row.id));
    const unassignedPatients = patientRows.filter((row) => !assignedSet.has(row.id) && !monitoredSet.has(row.id));

    const response = TeamWorkspaceResponse.parse({
      teamId: team.id,
      eventId: team.eventId,
      latestStatus,
      activePatientId,
      assignedPatients: assignedPatients.map((row) => ({
        id: row.id,
        incidentId: row.incidentId ?? null,
        status: row.status,
        presentingComplaint: row.presentingComplaint ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      monitoredPatients: monitoredPatients.map((row) => ({
        id: row.id,
        incidentId: row.incidentId ?? null,
        status: row.status,
        presentingComplaint: row.presentingComplaint ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      unassignedPatients: unassignedPatients.map((row) => ({
        id: row.id,
        incidentId: row.incidentId ?? null,
        status: row.status,
        presentingComplaint: row.presentingComplaint ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      updatedAt: new Date().toISOString(),
    });

    return response;
  });
}
