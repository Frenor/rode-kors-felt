import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { actionEvents, escalations, incidents, patients } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcast } from './ws.js';

type AuthUser = {
  sub?: string;
  email?: string;
  eventId?: string;
};

type IncidentActionBody =
  | { type: 'status.set'; status: string }
  | { type: 'escalation.raise'; path: string; reason?: string }
  | { type: 'escalation.resolve' }
  | { type: 'escalation.reopen'; escalationId?: string };

type PatientActionBody =
  | { type: 'status.set'; status: string };

type ActionMeta = {
  actionType?: string;
  undoOfActionId?: string;
  reason?: string;
};

export function mapAction(row: typeof actionEvents.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    revertedAt: row.revertedAt?.toISOString(),
  };
}

function getActor(user: AuthUser): string {
  return user.sub ?? user.email ?? 'unknown';
}

async function logAction(params: {
  eventId: string;
  entityType: 'incident' | 'patient' | 'event';
  entityId: string;
  actionType: string;
  payload: Record<string, unknown>;
  createdBy: string;
  undoOfActionId?: string;
}) {
  const [row] = await db
    .insert(actionEvents)
    .values({
      eventId: params.eventId,
      entityType: params.entityType,
      entityId: params.entityId,
      actionType: params.actionType,
      payload: params.payload,
      createdBy: params.createdBy,
      undoOfActionId: params.undoOfActionId,
    })
    .returning();
  return mapAction(row!);
}

export async function getActionHistoryByEntityIds(params: {
  eventId: string;
  entityType: 'incident' | 'patient' | 'event';
  entityIds: string[];
}) {
  if (params.entityIds.length === 0) return new Map<string, ReturnType<typeof mapAction>[]>();

  const rows = await db
    .select()
    .from(actionEvents)
    .where(and(
      eq(actionEvents.eventId, params.eventId),
      eq(actionEvents.entityType, params.entityType),
      inArray(actionEvents.entityId, params.entityIds),
    ))
    .orderBy(desc(actionEvents.createdAt));

  const grouped = new Map<string, ReturnType<typeof mapAction>[]>();
  for (const row of rows) {
    const key = row.entityId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(mapAction(row));
  }
  return grouped;
}

export async function applyIncidentAction(params: {
  incidentId: string;
  user: AuthUser;
  body: IncidentActionBody;
  meta?: ActionMeta;
}) {
  const [incident] = await db.select().from(incidents).where(eq(incidents.id, params.incidentId)).limit(1);
  if (!incident) {
    return { error: { code: 404, message: 'Hendelse ikke funnet' } };
  }

  const actor = getActor(params.user);

  if (params.body.type === 'status.set') {
    const previousStatus = incident.status;
    const [updated] = await db
      .update(incidents)
      .set({
        status: params.body.status as typeof incidents.$inferInsert['status'],
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, incident.id))
      .returning();

    const action = await logAction({
      eventId: incident.eventId,
      entityType: 'incident',
      entityId: incident.id,
      actionType: params.meta?.actionType ?? 'incident.status_set',
      payload: {
        previousStatus,
        nextStatus: params.body.status,
        reason: params.meta?.reason,
      },
      createdBy: actor,
      undoOfActionId: params.meta?.undoOfActionId,
    });

    const mappedIncident = {
      ...updated!,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };

    broadcast({
      type: 'incident.updated',
      eventId: mappedIncident.eventId,
      payload: { incident: mappedIncident },
      timestamp: mappedIncident.updatedAt,
    });

    return { incident: mappedIncident, action };
  }

  if (params.body.type === 'escalation.raise') {
    const [active] = await db
      .select()
      .from(escalations)
      .where(and(eq(escalations.incidentId, incident.id), isNull(escalations.resolvedAt)))
      .limit(1);
    if (active) {
      return { error: { code: 409, message: 'Hendelsen er allerede eskalert' } };
    }

    const [created] = await db
      .insert(escalations)
      .values({
        incidentId: incident.id,
        eventId: incident.eventId,
        path: params.body.path as typeof escalations.$inferInsert['path'],
        reason: params.body.reason,
        raisedBy: actor,
      })
      .returning();

    const escalation = {
      ...created!,
      raisedAt: created!.raisedAt.toISOString(),
      resolvedAt: created!.resolvedAt?.toISOString(),
    };

    const action = await logAction({
      eventId: incident.eventId,
      entityType: 'incident',
      entityId: incident.id,
      actionType: params.meta?.actionType ?? 'incident.escalation_raised',
      payload: {
        escalationId: escalation.id,
        path: escalation.path,
        reason: escalation.reason ?? null,
        raisedAt: escalation.raisedAt,
        undoReason: params.meta?.reason,
      },
      createdBy: actor,
      undoOfActionId: params.meta?.undoOfActionId,
    });

    broadcast({
      type: 'escalation.raised',
      eventId: incident.eventId,
      payload: { escalation, incidentId: incident.id },
      timestamp: escalation.raisedAt,
    });

    return { escalation, action };
  }

  if (params.body.type === 'escalation.resolve') {
    const [active] = await db
      .select()
      .from(escalations)
      .where(and(eq(escalations.incidentId, incident.id), isNull(escalations.resolvedAt)))
      .limit(1);
    if (!active) {
      return { error: { code: 404, message: 'Ingen aktiv eskalering funnet' } };
    }

    const now = new Date();
    await db.update(escalations).set({ resolvedAt: now }).where(eq(escalations.id, active.id));

    const action = await logAction({
      eventId: incident.eventId,
      entityType: 'incident',
      entityId: incident.id,
      actionType: params.meta?.actionType ?? 'incident.escalation_resolved',
      payload: {
        escalationId: active.id,
        path: active.path,
        reason: active.reason ?? null,
        resolvedAt: now.toISOString(),
        undoReason: params.meta?.reason,
      },
      createdBy: actor,
      undoOfActionId: params.meta?.undoOfActionId,
    });

    broadcast({
      type: 'escalation.resolved',
      eventId: incident.eventId,
      payload: { escalationId: active.id, incidentId: incident.id },
      timestamp: now.toISOString(),
    });

    return { ok: true, action };
  }

  const targetEscalationId = params.body.escalationId;
  const [existingEscalation] = targetEscalationId
    ? await db.select().from(escalations).where(eq(escalations.id, targetEscalationId)).limit(1)
    : await db
      .select()
      .from(escalations)
      .where(eq(escalations.incidentId, incident.id))
      .orderBy(desc(escalations.raisedAt))
      .limit(1);

  if (!existingEscalation) {
    return { error: { code: 404, message: 'Eskalering ikke funnet' } };
  }

  await db.update(escalations).set({ resolvedAt: null }).where(eq(escalations.id, existingEscalation.id));

  const action = await logAction({
    eventId: incident.eventId,
    entityType: 'incident',
    entityId: incident.id,
    actionType: params.meta?.actionType ?? 'incident.escalation_reopened',
    payload: {
      escalationId: existingEscalation.id,
      path: existingEscalation.path,
      reason: existingEscalation.reason ?? null,
      undoReason: params.meta?.reason,
    },
    createdBy: actor,
    undoOfActionId: params.meta?.undoOfActionId,
  });

  const escalation = {
    ...existingEscalation,
    raisedAt: existingEscalation.raisedAt.toISOString(),
    resolvedAt: undefined,
  };

  broadcast({
    type: 'escalation.raised',
    eventId: incident.eventId,
    payload: { escalation, incidentId: incident.id },
    timestamp: new Date().toISOString(),
  });

  return { escalation, action };
}

export async function applyPatientAction(params: {
  patientId: string;
  user: AuthUser;
  body: PatientActionBody;
  meta?: ActionMeta;
}) {
  const [patient] = await db.select().from(patients).where(eq(patients.id, params.patientId)).limit(1);
  if (!patient) {
    return { error: { code: 404, message: 'Pasient ikke funnet' } };
  }

  if (params.body.type !== 'status.set') {
    return { error: { code: 400, message: 'Ugyldig handling' } };
  }

  const previousStatus = patient.status;
  const [updated] = await db
    .update(patients)
    .set({
      status: params.body.status as typeof patients.$inferInsert['status'],
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patient.id))
    .returning();

  const action = await logAction({
    eventId: patient.eventId,
    entityType: 'patient',
    entityId: patient.id,
    actionType: params.meta?.actionType ?? 'patient.status_set',
    payload: {
      previousStatus,
      nextStatus: params.body.status,
      reason: params.meta?.reason,
    },
    createdBy: getActor(params.user),
    undoOfActionId: params.meta?.undoOfActionId,
  });

  return {
    patient: {
      ...updated!,
      arrivalTime: updated!.arrivalTime.toISOString(),
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    },
    action,
  };
}

export async function undoActionById(params: {
  actionId: string;
  user: AuthUser;
  reason?: string;
}) {
  const [target] = await db
    .select()
    .from(actionEvents)
    .where(eq(actionEvents.id, params.actionId))
    .limit(1);

  if (!target) return { error: { code: 404, message: 'Handling ikke funnet' } };
  if (target.revertedAt) return { error: { code: 409, message: 'Handling er allerede angret' } };

  let undoResult: any;
  const payload = (target.payload ?? {}) as Record<string, unknown>;

  if (target.actionType === 'incident.status_set') {
    const previousStatus = payload.previousStatus as string | undefined;
    if (!previousStatus) return { error: { code: 400, message: 'Kan ikke angre denne handlingen' } };
    undoResult = await applyIncidentAction({
      incidentId: target.entityId,
      user: params.user,
      body: { type: 'status.set', status: previousStatus },
      meta: {
        actionType: 'incident.status_undo',
        undoOfActionId: target.id,
        reason: params.reason,
      },
    });
  } else if (target.actionType === 'incident.escalation_raised') {
    undoResult = await applyIncidentAction({
      incidentId: target.entityId,
      user: params.user,
      body: { type: 'escalation.resolve' },
      meta: {
        actionType: 'incident.escalation_raise_undo',
        undoOfActionId: target.id,
        reason: params.reason,
      },
    });
  } else if (target.actionType === 'incident.escalation_resolved') {
    undoResult = await applyIncidentAction({
      incidentId: target.entityId,
      user: params.user,
      body: { type: 'escalation.reopen', escalationId: payload.escalationId as string | undefined },
      meta: {
        actionType: 'incident.escalation_resolve_undo',
        undoOfActionId: target.id,
        reason: params.reason,
      },
    });
  } else if (target.actionType === 'patient.status_set') {
    const previousStatus = payload.previousStatus as string | undefined;
    if (!previousStatus) return { error: { code: 400, message: 'Kan ikke angre denne handlingen' } };
    undoResult = await applyPatientAction({
      patientId: target.entityId,
      user: params.user,
      body: { type: 'status.set', status: previousStatus },
      meta: {
        actionType: 'patient.status_undo',
        undoOfActionId: target.id,
        reason: params.reason,
      },
    });
  } else {
    return { error: { code: 400, message: 'Kan ikke angre denne handlingen' } };
  }

  if (undoResult?.error) return undoResult;

  await db
    .update(actionEvents)
    .set({
      revertedAt: new Date(),
      revertedBy: getActor(params.user),
      revertReason: params.reason,
    })
    .where(eq(actionEvents.id, target.id));

  const [updatedOriginal] = await db
    .select()
    .from(actionEvents)
    .where(eq(actionEvents.id, target.id))
    .limit(1);

  return {
    undoneAction: mapAction(updatedOriginal!),
    undoAction: undoResult.action,
    result: undoResult,
  };
}

export async function actionRoutes(app: import('fastify').FastifyInstance) {
  app.post('/:id/undo', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user as AuthUser;
    const body = request.body as { reason?: string } | undefined;
    const result = await undoActionById({ actionId: id, user, reason: body?.reason });
    if (result.error) return reply.code(result.error.code).send({ error: result.error.message });
    return result;
  });
}
