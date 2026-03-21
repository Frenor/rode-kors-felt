import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { store } from '../db/store.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcast } from './ws.js';

export async function incidentRoutes(app: FastifyInstance) {
  // List incidents for an event
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const user = (request as any).user;
    const { eventId } = request.query as { eventId?: string };
    const targetEventId = eventId || user.eventId;

    if (!targetEventId) {
      return { incidents: [] };
    }

    const incidents = Array.from(store.incidents.values())
      .filter((i) => i.eventId === targetEventId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { incidents };
  });

  // Get single incident
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const incident = store.incidents.get(id);
    if (!incident) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }
    return { incident };
  });

  // Create incident (first aiders)
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as {
      eventId: string;
      teamId?: string;
      type: string;
      source?: 'field' | 'coordinator';
      location: { lat: number; lng: number };
      acvpu?: string;
      vitals?: Record<string, unknown>;
      mist?: Record<string, unknown>;
      notes?: string;
      clientId?: string;
    };

    const eventId = body.eventId || user.eventId;
    if (!eventId) {
      return reply.code(400).send({ error: 'Mangler eventId' });
    }

    // Deduplicate by clientId
    if (body.clientId) {
      const existing = Array.from(store.incidents.values()).find(
        (i) => i.clientId === body.clientId,
      );
      if (existing) {
        return { incident: existing, deduplicated: true };
      }
    }

    const now = new Date().toISOString();
    const source = body.source ?? 'field';
    const incident = {
      id: randomUUID(),
      eventId,
      teamId: body.teamId,
      type: body.type,
      source,
      status: source === 'coordinator' ? 'dispatched' : 'on_scene',
      location: body.location ?? { lat: 59.9139, lng: 10.7522 },
      acvpu: body.acvpu,
      vitals: body.vitals,
      mist: body.mist,
      notes: body.notes,
      clientId: body.clientId,
      createdAt: now,
      updatedAt: now,
    };

    store.incidents.set(incident.id, incident);

    broadcast({
      type: 'incident.created',
      eventId,
      payload: { incident },
      timestamp: now,
    });

    return reply.code(201).send({ incident });
  });

  // Update incident status
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      status: string;
      teamId: string;
      acvpu: string;
      notes: string;
    }>;

    const incident = store.incidents.get(id);
    if (!incident) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }

    const updated = {
      ...incident,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    store.incidents.set(id, updated);

    broadcast({
      type: 'incident.updated',
      eventId: updated.eventId,
      payload: { incident: updated },
      timestamp: updated.updatedAt,
    });

    return { incident: updated };
  });

  // Escalate an incident
  app.post('/:id/escalate', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const body = request.body as { path: string; reason?: string };

    const incident = store.incidents.get(id);
    if (!incident) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }

    // Check for existing active escalation
    const existing = Array.from(store.escalations.values()).find(
      (e) => e.incidentId === id && !e.resolvedAt,
    );
    if (existing) {
      return reply.code(409).send({ error: 'Hendelsen er allerede eskalert' });
    }

    const now = new Date().toISOString();
    const escalation = {
      id: randomUUID(),
      incidentId: id,
      eventId: incident.eventId,
      path: body.path,
      reason: body.reason,
      raisedAt: now,
      raisedBy: user.sub || user.email || 'unknown',
    };

    store.escalations.set(escalation.id, escalation);

    broadcast({
      type: 'escalation.raised',
      eventId: incident.eventId,
      payload: { escalation, incidentId: id },
      timestamp: now,
    });

    return reply.code(201).send({ escalation });
  });

  // Resolve an escalation
  app.delete('/:id/escalate', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const incident = store.incidents.get(id);
    if (!incident) {
      return reply.code(404).send({ error: 'Hendelse ikke funnet' });
    }

    const escalation = Array.from(store.escalations.values()).find(
      (e) => e.incidentId === id && !e.resolvedAt,
    );
    if (!escalation) {
      return reply.code(404).send({ error: 'Ingen aktiv eskalering funnet' });
    }

    const now = new Date().toISOString();
    store.escalations.set(escalation.id, { ...escalation, resolvedAt: now });

    broadcast({
      type: 'escalation.resolved',
      eventId: incident.eventId,
      payload: { escalationId: escalation.id, incidentId: id },
      timestamp: now,
    });

    return { ok: true };
  });
}
