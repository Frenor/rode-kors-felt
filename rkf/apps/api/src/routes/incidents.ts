import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { store } from '../db/store.js';
import { requireAuth } from '../middleware/auth.js';

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
    const incident = {
      id: randomUUID(),
      eventId,
      teamId: body.teamId,
      type: body.type,
      status: 'on_scene',
      location: body.location,
      acvpu: body.acvpu,
      vitals: body.vitals,
      mist: body.mist,
      notes: body.notes,
      clientId: body.clientId,
      createdAt: now,
      updatedAt: now,
    };

    store.incidents.set(incident.id, incident);
    return reply.code(201).send({ incident });
  });

  // Update incident status
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      status: string;
      teamId: string;
      avpu: string;
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
    return { incident: updated };
  });
}
