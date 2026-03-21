import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { store } from '../db/store.js';
import { requireAuth } from '../middleware/auth.js';

export async function eventRoutes(app: FastifyInstance) {
  // List events
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const user = (request as any).user;
    let events = Array.from(store.events.values());

    // If event-scoped user, only show their event
    if (user.eventId) {
      events = events.filter((e) => e.id === user.eventId);
    }

    return { events };
  });

  // Get single event with teams
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = store.events.get(id);

    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }

    const teams = Array.from(store.teams.values()).filter((t) => t.eventId === id);

    return { event, teams };
  });

  // Create event (admin only)
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'coordinator' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Kun admin kan opprette arrangement' });
    }

    const body = request.body as {
      name: string;
      startDate: string;
      endDate: string;
    };

    const now = new Date().toISOString();
    const event = {
      id: randomUUID(),
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'draft' as const,
      createdAt: now,
      updatedAt: now,
    };

    store.events.set(event.id, event);
    return reply.code(201).send({ event });
  });

  // Get event stats
  app.get('/:id/stats', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = store.events.get(id);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }

    const incidents = Array.from(store.incidents.values()).filter((i) => i.eventId === id);
    const patients = Array.from(store.patients.values()).filter((p) => p.eventId === id);

    return {
      totalIncidents: incidents.length,
      activeIncidents: incidents.filter((i) => i.status === 'on_scene' || i.status === 'transporting').length,
      resolvedIncidents: incidents.filter((i) => i.status === 'resolved').length,
      totalPatients: patients.length,
      patientsInTreatment: patients.filter((p) => p.status === 'in_treatment').length,
      discharged: patients.filter((p) => p.status === 'discharged').length,
    };
  });
}
