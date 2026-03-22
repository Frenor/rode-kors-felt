import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { escalations, incidents } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcast } from './ws.js';

export async function incidentRoutes(app: FastifyInstance) {
  // List incidents for an event
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const user = (request as any).user;
    const { eventId } = request.query as { eventId?: string };
    const targetEventId = eventId ?? user.eventId;

    if (!targetEventId) {
      return { incidents: [] };
    }

    const rows = await db
      .select()
      .from(incidents)
      .where(eq(incidents.eventId, targetEventId))
      .orderBy(desc(incidents.createdAt));

    return { incidents: rows.map(mapIncident) };
  });

  // Get single incident
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);

    if (!incident) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }

    return { incident: mapIncident(incident) };
  });

  // Create incident
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as {
      eventId?: string;
      teamId?: string;
      type: string;
      source?: 'field' | 'coordinator';
      location: { lat: number; lng: number };
      acvpu?: string;
      vitals?: Record<string, unknown>;
      mist?: Record<string, unknown>;
      triageTag?: string;
      notes?: string;
      clientId?: string;
    };

    const eventId = body.eventId ?? user.eventId;
    if (!eventId) {
      return reply.code(400).send({ error: 'Mangler eventId' });
    }

    // Deduplicate by clientId
    if (body.clientId) {
      const [existing] = await db
        .select()
        .from(incidents)
        .where(eq(incidents.clientId, body.clientId))
        .limit(1);

      if (existing) {
        return { incident: mapIncident(existing), deduplicated: true };
      }
    }

    const source = body.source ?? 'field';
    const [incident] = await db
      .insert(incidents)
      .values({
        eventId,
        teamId: body.teamId,
        type: body.type as typeof incidents.$inferInsert['type'],
        source,
        status: source === 'coordinator' ? 'dispatched' : 'on_scene',
        location: body.location ?? { lat: 59.9139, lng: 10.7522 },
        acvpu: body.acvpu as typeof incidents.$inferInsert['acvpu'],
        vitals: body.vitals,
        mist: body.mist,
        triageTag: body.triageTag as typeof incidents.$inferInsert['triageTag'],
        notes: body.notes,
        clientId: body.clientId,
      })
      .returning();

    const mapped = mapIncident(incident!);

    broadcast({
      type: 'incident.created',
      eventId,
      payload: { incident: mapped },
      timestamp: mapped.createdAt,
    });

    return reply.code(201).send({ incident: mapped });
  });

  // Update incident
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      status: string;
      teamId: string;
      acvpu: string;
      triageTag: string;
      notes: string;
    }>;

    const [existing] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }

    const [updated] = await db
      .update(incidents)
      .set({
        ...(body.status && { status: body.status as typeof incidents.$inferInsert['status'] }),
        ...(body.teamId !== undefined && { teamId: body.teamId }),
        ...(body.acvpu && { acvpu: body.acvpu as typeof incidents.$inferInsert['acvpu'] }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.triageTag !== undefined && { triageTag: body.triageTag as typeof incidents.$inferInsert['triageTag'] }),
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, id))
      .returning();

    const mapped = mapIncident(updated!);

    broadcast({
      type: 'incident.updated',
      eventId: mapped.eventId,
      payload: { incident: mapped },
      timestamp: mapped.updatedAt,
    });

    return { incident: mapped };
  });

  // Escalate an incident
  app.post('/:id/escalate', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const body = request.body as { path: string; reason?: string };

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);

    if (!incident) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }

    // Check for existing active escalation
    const [existing] = await db
      .select()
      .from(escalations)
      .where(and(eq(escalations.incidentId, id), isNull(escalations.resolvedAt)))
      .limit(1);

    if (existing) {
      return reply.code(409).send({ error: 'Hendelsen er allerede eskalert' });
    }

    const [escalation] = await db
      .insert(escalations)
      .values({
        incidentId: id,
        eventId: incident.eventId,
        path: body.path as typeof escalations.$inferInsert['path'],
        reason: body.reason,
        raisedBy: user.sub ?? user.email ?? 'unknown',
      })
      .returning();

    const mapped = mapEscalation(escalation!);

    broadcast({
      type: 'escalation.raised',
      eventId: incident.eventId,
      payload: { escalation: mapped, incidentId: id },
      timestamp: mapped.raisedAt,
    });

    return reply.code(201).send({ escalation: mapped });
  });

  // Resolve escalation
  app.delete('/:id/escalate', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);

    if (!incident) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }

    const [escalation] = await db
      .select()
      .from(escalations)
      .where(and(eq(escalations.incidentId, id), isNull(escalations.resolvedAt)))
      .limit(1);

    if (!escalation) {
      return reply.code(404).send({ error: 'Ingen aktiv eskalering funnet' });
    }

    const now = new Date();
    await db
      .update(escalations)
      .set({ resolvedAt: now })
      .where(eq(escalations.id, escalation.id));

    broadcast({
      type: 'escalation.resolved',
      eventId: incident.eventId,
      payload: { escalationId: escalation.id, incidentId: id },
      timestamp: now.toISOString(),
    });

    return { ok: true };
  });
}

function mapIncident(row: typeof incidents.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapEscalation(row: typeof escalations.$inferSelect) {
  return {
    ...row,
    raisedAt: row.raisedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
  };
}
