import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { actionEvents, patients } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

type AuthUser = {
  sub?: string;
  email?: string;
  codeId?: string;
  role?: string;
  eventId?: string;
};

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
  const actor = user.sub ?? user.email ?? (user.codeId ? `code:${user.codeId}` : undefined) ?? user.role;
  if (!actor) {
    const err = new Error('Token mangler identitet') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  return actor;
}

async function logAction(params: {
  eventId: string;
  entityType: 'patient' | 'event' | 'team';
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
  entityType: 'patient' | 'event' | 'team';
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

  if (target.actionType === 'patient.status_set') {
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
