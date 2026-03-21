import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { store } from '../db/store.js';
import { requireAuth } from '../middleware/auth.js';

export async function patientRoutes(app: FastifyInstance) {
  // List patients for an event
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const user = (request as any).user;
    const { eventId } = request.query as { eventId?: string };
    const targetEventId = eventId || user.eventId;

    if (!targetEventId) {
      return { patients: [] };
    }

    const patients = Array.from(store.patients.values())
      .filter((p) => p.eventId === targetEventId)
      .sort((a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime());

    // Attach latest vitals per patient
    const patientsWithVitals = patients.map((p) => {
      const patientVitals = Array.from(store.vitals.values())
        .filter((v) => v.patientId === p.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        ...p,
        latestVitals: patientVitals[0] || null,
        vitalsHistory: patientVitals,
      };
    });

    return { patients: patientsWithVitals };
  });

  // Create patient (from sickbay intake or incident handover)
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as {
      eventId: string;
      incidentId?: string;
      ageGroup?: string;
      gender?: string;
      presentingComplaint?: string;
      assignedClinician?: string;
    };

    const eventId = body.eventId || user.eventId;
    if (!eventId) {
      return reply.code(400).send({ error: 'Mangler eventId' });
    }

    const now = new Date().toISOString();
    const patient = {
      id: randomUUID(),
      eventId,
      incidentId: body.incidentId,
      status: 'incoming',
      ageGroup: body.ageGroup,
      gender: body.gender,
      presentingComplaint: body.presentingComplaint,
      arrivalTime: now,
      assignedClinician: body.assignedClinician,
      notes: [],
      diagnosisFlags: [],
      createdAt: now,
      updatedAt: now,
    };

    store.patients.set(patient.id, patient);

    // If linked to incident, update incident status
    if (body.incidentId) {
      const incident = store.incidents.get(body.incidentId);
      if (incident) {
        store.incidents.set(body.incidentId, {
          ...incident,
          status: 'at_sickbay',
          updatedAt: now,
        });
      }
    }

    return reply.code(201).send({ patient });
  });

  // Update patient
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      status: string;
      assignedClinician: string;
      diagnosisFlags: string[];
    }>;

    const patient = store.patients.get(id);
    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    const updated = {
      ...patient,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    store.patients.set(id, updated);
    return { patient: updated };
  });

  // Add clinical note
  app.post('/:id/notes', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { text, author } = request.body as { text: string; author: string };

    const patient = store.patients.get(id);
    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    patient.notes.push({
      text,
      timestamp: new Date().toISOString(),
      author,
    });
    patient.updatedAt = new Date().toISOString();

    return { patient };
  });

  // Record vitals (append-only — never overwrite)
  app.post('/:id/vitals', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      pulse?: number;
      spo2?: number;
      respiratoryRate?: number;
      painScore?: number;
      systolicBP?: number;
      temperature?: number;
      onSupplementalOxygen?: boolean;
      acvpu?: string;
    };

    const patient = store.patients.get(id);
    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    const reading = {
      id: randomUUID(),
      patientId: id,
      timestamp: new Date().toISOString(),
      pulse: body.pulse,
      spo2: body.spo2,
      respiratoryRate: body.respiratoryRate,
      painScore: body.painScore,
      systolicBP: body.systolicBP,
      temperature: body.temperature,
      onSupplementalOxygen: body.onSupplementalOxygen,
      acvpu: body.acvpu,
    };

    store.vitals.set(reading.id, reading);
    return reply.code(201).send({ vitals: reading });
  });
}
