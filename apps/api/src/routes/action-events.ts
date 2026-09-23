import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { TransportNeed } from '@rkf/shared-types';
import { db } from '../db/index.js';
import { actionEvents, patients, teams } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

type AuthUser = {
  sub?: string;
  email?: string;
  codeId?: string;
  role?: string;
  eventId?: string;
};

export type PatientActionBody =
  | { type: 'status.set'; status: string }
  | { type: 'amk.notified'; by?: string }
  | { type: 'amk.cleared' }
  // Transport request (gap B3)
  | { type: 'transport.requested'; need: string; pickupText?: string }
  | { type: 'transport.assigned'; teamId: string }
  | { type: 'transport.cleared' };

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

const AMK_NOTIFIED_BY_MAX_LENGTH = 100;

/** Mirrors patients.ts's mapPatient date handling for the subset returned by patient actions. */
function mapActionPatient(row: typeof patients.$inferSelect) {
  return {
    ...row,
    arrivalTime: row.arrivalTime.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    handedOverAt: row.handedOverAt ? row.handedOverAt.toISOString() : null,
    amkNotifiedAt: row.amkNotifiedAt ? row.amkNotifiedAt.toISOString() : null,
    // Transport request (gap B3)
    transportRequestedAt: row.transportRequestedAt ? row.transportRequestedAt.toISOString() : null,
    transportAssignedAt: row.transportAssignedAt ? row.transportAssignedAt.toISOString() : null,
  };
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

  if (params.body.type === 'status.set') {
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

    return { patient: mapActionPatient(updated!), action };
  }

  if (params.body.type === 'amk.notified') {
    const by = params.body.by?.trim();
    if (by !== undefined && by.length > AMK_NOTIFIED_BY_MAX_LENGTH) {
      return { error: { code: 400, message: `Varslingskilde er for lang (maks ${AMK_NOTIFIED_BY_MAX_LENGTH} tegn)` } };
    }

    // Idempotent: once AMK has been notified, a repeat call keeps the first
    // time and does not log a new action or change anything.
    if (patient.amkNotifiedAt) {
      return { patient: mapActionPatient(patient), action: null };
    }

    const actor = getActor(params.user);
    const amkNotifiedBy = by || actor;
    const now = new Date();
    const [updated] = await db
      .update(patients)
      .set({ amkNotifiedAt: now, amkNotifiedBy, updatedAt: now })
      .where(eq(patients.id, patient.id))
      .returning();

    const action = await logAction({
      eventId: patient.eventId,
      entityType: 'patient',
      entityId: patient.id,
      actionType: 'amk.notified',
      payload: { amkNotifiedAt: now.toISOString(), amkNotifiedBy },
      createdBy: actor,
    });

    return { patient: mapActionPatient(updated!), action };
  }

  if (params.body.type === 'amk.cleared') {
    const [updated] = await db
      .update(patients)
      .set({ amkNotifiedAt: null, amkNotifiedBy: null, updatedAt: new Date() })
      .where(eq(patients.id, patient.id))
      .returning();

    const action = await logAction({
      eventId: patient.eventId,
      entityType: 'patient',
      entityId: patient.id,
      actionType: 'amk.cleared',
      payload: {},
      createdBy: getActor(params.user),
    });

    return { patient: mapActionPatient(updated!), action };
  }

  // Transport request (gap B3): a field team asks for a stretcher/ATV/ambulance
  // to move a patient; the coordinator later assigns a team to carry it out.
  if (params.body.type === 'transport.requested') {
    const parsedNeed = TransportNeed.safeParse(params.body.need);
    if (!parsedNeed.success) {
      return { error: { code: 400, message: 'Ugyldig transportbehov' } };
    }
    const pickupText = params.body.pickupText?.trim() || null;
    if (pickupText && pickupText.length > 500) {
      return { error: { code: 400, message: 'Hentested er for langt (maks 500 tegn)' } };
    }

    const actor = getActor(params.user);
    // "Requested by" defaults to the requesting patrol's team name (the
    // patient's own assigned team) and falls back to the actor's role when
    // the patient has no team (e.g. a sick bay tent patient).
    let requestedBy: string = params.user.role ?? actor;
    if (patient.assignedTeamId) {
      const [team] = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, patient.assignedTeamId))
        .limit(1);
      if (team) requestedBy = team.name;
    }

    const now = new Date();
    const [updated] = await db
      .update(patients)
      .set({
        transportNeed: parsedNeed.data,
        transportPickupText: pickupText,
        transportRequestedAt: now,
        transportRequestedBy: requestedBy,
        transportTeamId: null,
        transportAssignedAt: null,
        updatedAt: now,
      })
      .where(eq(patients.id, patient.id))
      .returning();

    const action = await logAction({
      eventId: patient.eventId,
      entityType: 'patient',
      entityId: patient.id,
      actionType: 'transport.requested',
      payload: { need: parsedNeed.data, pickupText, requestedBy },
      createdBy: actor,
    });

    return { patient: mapActionPatient(updated!), action };
  }

  if (params.body.type === 'transport.assigned') {
    const [team] = await db
      .select({ id: teams.id, eventId: teams.eventId })
      .from(teams)
      .where(eq(teams.id, params.body.teamId))
      .limit(1);
    if (!team || team.eventId !== patient.eventId) {
      return { error: { code: 400, message: 'Ukjent lag for transport' } };
    }

    const now = new Date();
    const [updated] = await db
      .update(patients)
      .set({ transportTeamId: team.id, transportAssignedAt: now, updatedAt: now })
      .where(eq(patients.id, patient.id))
      .returning();

    const action = await logAction({
      eventId: patient.eventId,
      entityType: 'patient',
      entityId: patient.id,
      actionType: 'transport.assigned',
      payload: { teamId: team.id },
      createdBy: getActor(params.user),
    });

    return { patient: mapActionPatient(updated!), action };
  }

  if (params.body.type === 'transport.cleared') {
    const now = new Date();
    const [updated] = await db
      .update(patients)
      .set({
        transportNeed: null,
        transportPickupText: null,
        transportRequestedAt: null,
        transportRequestedBy: null,
        transportTeamId: null,
        transportAssignedAt: null,
        updatedAt: now,
      })
      .where(eq(patients.id, patient.id))
      .returning();

    const action = await logAction({
      eventId: patient.eventId,
      entityType: 'patient',
      entityId: patient.id,
      actionType: 'transport.cleared',
      payload: {},
      createdBy: getActor(params.user),
    });

    return { patient: mapActionPatient(updated!), action };
  }

  return { error: { code: 400, message: 'Ugyldig handling' } };
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
