import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { escalations, incidents } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { applyIncidentAction, getActionHistoryByEntityIds } from './action-events.js';
import { broadcast } from './ws.js';

function canAccessEvent(user: { role?: string; eventId?: string }, eventId: string): boolean {
  if (user.role === 'admin') return true;
  if (!user.eventId) return true;
  return user.eventId === eventId;
}

export async function incidentRoutes(app: FastifyInstance) {
  // List incidents for an event
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const user = (request as any).user;
    const { eventId } = request.query as { eventId?: string };
    const targetEventId = eventId ?? user.eventId;

    if (!targetEventId) {
      return { incidents: [] };
    }
    if (!canAccessEvent(user, targetEventId)) {
      return { incidents: [] };
    }

    const rows = await db
      .select()
      .from(incidents)
      .where(eq(incidents.eventId, targetEventId))
      .orderBy(desc(incidents.createdAt));

    const incidentIds = rows.map((r) => r.id);
    const actionHistory = await getActionHistoryByEntityIds({
      eventId: targetEventId,
      entityType: 'incident',
      entityIds: incidentIds,
    });

    const escalationRows = incidentIds.length === 0
      ? []
      : await db
        .select()
        .from(escalations)
        .where(and(inArray(escalations.incidentId, incidentIds), isNull(escalations.resolvedAt)));

    const activeEscalationByIncident = new Map<string, ReturnType<typeof mapEscalation>>();
    for (const row of escalationRows) {
      activeEscalationByIncident.set(row.incidentId, mapEscalation(row));
    }

    return {
      incidents: rows.map((row) => mapIncident(row, {
        activeEscalation: activeEscalationByIncident.get(row.id) ?? null,
        actionHistory: actionHistory.get(row.id) ?? [],
      })),
    };
  });

  // Get single incident
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { role?: string; eventId?: string };
    const { id } = request.params as { id: string };

    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);

    if (!incident) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }
    if (!canAccessEvent(user, incident.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const [activeEscalation] = await db
      .select()
      .from(escalations)
      .where(and(eq(escalations.incidentId, id), isNull(escalations.resolvedAt)))
      .limit(1);

    const actionHistory = await getActionHistoryByEntityIds({
      eventId: incident.eventId,
      entityType: 'incident',
      entityIds: [incident.id],
    });

    return {
      incident: mapIncident(incident, {
        activeEscalation: activeEscalation ? mapEscalation(activeEscalation) : null,
        actionHistory: actionHistory.get(incident.id) ?? [],
      }),
    };
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
      locationContext?: {
        mode: 'gps' | 'indoor_zone';
        venueId?: string;
        floorId?: string;
        zoneId?: string;
        zoneLabel?: string;
      };
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
    if (!canAccessEvent(user, eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
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
        locationContext: body.locationContext,
        acvpu: body.acvpu as typeof incidents.$inferInsert['acvpu'],
        vitals: body.vitals,
        mist: body.mist,
        triageTag: body.triageTag as typeof incidents.$inferInsert['triageTag'],
        notes: body.notes,
        clientId: body.clientId,
      })
      .returning();

    const mapped = mapIncident(incident!, { actionHistory: [] });

    broadcast({
      type: 'incident.created',
      eventId,
      payload: { incident: mapped },
      timestamp: mapped.createdAt,
    });

    return reply.code(201).send({ incident: mapped });
  });

  // Update incident (legacy compatibility)
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { role?: string; eventId?: string };
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      status: string;
      teamId: string;
      acvpu: string;
      triageTag: string;
      notes: string;
      locationContext: {
        mode: 'gps' | 'indoor_zone';
        venueId?: string;
        floorId?: string;
        zoneId?: string;
        zoneLabel?: string;
      };
    }>;

    const [existing] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    if (!canAccessEvent(user, existing.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    // Status updates are now routed through action engine.
    if (body.status) {
      const result = await applyIncidentAction({
        incidentId: id,
        user,
        body: { type: 'status.set', status: body.status },
      });
      if (result.error) return reply.code(result.error.code).send({ error: result.error.message });
      return { incident: result.incident, action: result.action };
    }

    const [updated] = await db
      .update(incidents)
      .set({
        ...(body.teamId !== undefined && { teamId: body.teamId }),
        ...(body.acvpu && { acvpu: body.acvpu as typeof incidents.$inferInsert['acvpu'] }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.triageTag !== undefined && { triageTag: body.triageTag as typeof incidents.$inferInsert['triageTag'] }),
        ...(body.locationContext !== undefined && { locationContext: body.locationContext }),
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

  // Reversible incident action API
  app.post('/:id/actions', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { role?: string; eventId?: string };
    const { id } = request.params as { id: string };
    const body = request.body as
      | { type: 'status.set'; status: string }
      | { type: 'escalation.raise'; path: string; reason?: string }
      | { type: 'escalation.resolve' }
      | { type: 'escalation.reopen'; escalationId?: string };

    const [existing] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    if (!canAccessEvent(user, existing.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const result = await applyIncidentAction({
      incidentId: id,
      user,
      body,
    });

    if (result.error) return reply.code(result.error.code).send({ error: result.error.message });
    return result;
  });

  // Escalate an incident (legacy compatibility)
  app.post('/:id/escalate', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { role?: string; eventId?: string };
    const { id } = request.params as { id: string };
    const body = request.body as { path: string; reason?: string };

    const [existing] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    if (!canAccessEvent(user, existing.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const result = await applyIncidentAction({
      incidentId: id,
      user,
      body: { type: 'escalation.raise', path: body.path, reason: body.reason },
    });

    if (result.error) return reply.code(result.error.code).send({ error: result.error.message });
    return reply.code(201).send({ escalation: result.escalation, action: result.action });
  });

  // Resolve escalation (legacy compatibility) -> reversible action
  app.delete('/:id/escalate', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as { role?: string; eventId?: string };
    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    if (!canAccessEvent(user, existing.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const result = await applyIncidentAction({
      incidentId: id,
      user,
      body: { type: 'escalation.resolve' },
    });

    if (result.error) return reply.code(result.error.code).send({ error: result.error.message });
    return { ok: true, action: result.action };
  });
}

function mapIncident(
  row: typeof incidents.$inferSelect,
  extras?: { activeEscalation?: ReturnType<typeof mapEscalation> | null; actionHistory?: unknown[] },
) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    locationContext: row.locationContext ?? undefined,
    activeEscalation: extras?.activeEscalation,
    actionHistory: extras?.actionHistory ?? [],
  };
}

function mapEscalation(row: typeof escalations.$inferSelect) {
  return {
    ...row,
    raisedAt: row.raisedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
  };
}
