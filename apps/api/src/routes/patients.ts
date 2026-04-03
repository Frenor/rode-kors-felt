import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { incidents, medicationRecords, patients, vitalReadings } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { applyPatientAction, getActionHistoryByEntityIds } from './action-events.js';
import { broadcast } from './ws.js';

export async function patientRoutes(app: FastifyInstance) {
  // List patients for an event (with latest vitals attached)
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const user = (request as any).user;
    const { eventId } = request.query as { eventId?: string };
    const targetEventId = eventId ?? user.eventId;

    if (!targetEventId) {
      return { patients: [] };
    }

    const patientRows = await db
      .select()
      .from(patients)
      .where(eq(patients.eventId, targetEventId))
      .orderBy(desc(patients.arrivalTime));

    const actionHistoryByPatientId = await getActionHistoryByEntityIds({
      eventId: targetEventId,
      entityType: 'patient',
      entityIds: patientRows.map((p) => p.id),
    });

    const patientsWithVitals = await Promise.all(
      patientRows.map(async (p) => {
        const vitalsHistory = await db
          .select()
          .from(vitalReadings)
          .where(eq(vitalReadings.patientId, p.id))
          .orderBy(desc(vitalReadings.timestamp));

        return {
          ...mapPatient(p, { actionHistory: actionHistoryByPatientId.get(p.id) ?? [] }),
          latestVitals: vitalsHistory.length > 0 ? mapVitals(vitalsHistory[0]!) : null,
          vitalsHistory: vitalsHistory.map(mapVitals),
        };
      }),
    );

    return { patients: patientsWithVitals };
  });

  // Get single patient with full vitals history
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    const vitalsHistory = await db
      .select()
      .from(vitalReadings)
      .where(eq(vitalReadings.patientId, id))
      .orderBy(desc(vitalReadings.timestamp));

    const actionHistoryByPatientId = await getActionHistoryByEntityIds({
      eventId: patient.eventId,
      entityType: 'patient',
      entityIds: [id],
    });

    return {
      patient: {
        ...mapPatient(patient, { actionHistory: actionHistoryByPatientId.get(id) ?? [] }),
        latestVitals: vitalsHistory.length > 0 ? mapVitals(vitalsHistory[0]!) : null,
        vitalsHistory: vitalsHistory.map(mapVitals),
      },
    };
  });

  // Create patient
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as {
      eventId?: string;
      incidentId?: string;
      ageGroup?: string;
      gender?: string;
      presentingComplaint?: string;
      assignedClinician?: string;
    };

    const eventId = body.eventId ?? user.eventId;
    if (!eventId) {
      return reply.code(400).send({ error: 'Mangler eventId' });
    }

    const [patient] = await db
      .insert(patients)
      .values({
        eventId,
        incidentId: body.incidentId,
        ageGroup: body.ageGroup,
        gender: body.gender,
        presentingComplaint: body.presentingComplaint,
        assignedClinician: body.assignedClinician,
        notes: [],
        diagnosisFlags: [],
      })
      .returning();

    // If linked to incident, update incident status
    if (body.incidentId) {
      await db
        .update(incidents)
        .set({ status: 'at_sickbay', updatedAt: new Date() })
        .where(eq(incidents.id, body.incidentId));
    }

    return reply.code(201).send({ patient: mapPatient(patient!) });
  });

  // Update patient
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      status: string;
      assignedClinician: string;
      diagnosisFlags: string[];
    }>;

    const [existing] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    if (body.status) {
      const result = await applyPatientAction({
        patientId: id,
        user: (request as any).user,
        body: { type: 'status.set', status: body.status },
      });
      if (result.error) {
        return reply.code(result.error.code).send({ error: result.error.message });
      }
      return result;
    }

    const [updated] = await db
      .update(patients)
      .set({
        ...(body.assignedClinician !== undefined && { assignedClinician: body.assignedClinician }),
        ...(body.diagnosisFlags && { diagnosisFlags: body.diagnosisFlags }),
        updatedAt: new Date(),
      })
      .where(eq(patients.id, id))
      .returning();

    return { patient: mapPatient(updated!) };
  });

  app.post('/:id/actions', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { type: 'status.set'; status: string };
    const result = await applyPatientAction({
      patientId: id,
      user: (request as any).user,
      body,
    });
    if (result.error) return reply.code(result.error.code).send({ error: result.error.message });
    return result;
  });

  // Add clinical note (append-only)
  app.post('/:id/notes', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { text, author } = request.body as { text: string; author: string };

    const [existing] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    const newNote = { text, timestamp: new Date().toISOString(), author };

    const [updated] = await db
      .update(patients)
      .set({
        notes: sql`${patients.notes} || ${JSON.stringify([newNote])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, id))
      .returning();

    return { patient: mapPatient(updated!) };
  });

  // Record medication administration (append-only)
  app.post('/:id/medications', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      drug: string;
      dose?: string;
      route?: string;
      givenBy?: string;
    };

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    const [record] = await db
      .insert(medicationRecords)
      .values({
        patientId: id,
        eventId: patient.eventId,
        drug: body.drug,
        dose: body.dose,
        route: body.route,
        givenBy: body.givenBy,
      })
      .returning();

    return reply.code(201).send({
      medication: {
        ...record!,
        givenAt: record!.givenAt.toISOString(),
      },
    });
  });

  // List medication records for a patient
  app.get('/:id/medications', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    const records = await db
      .select()
      .from(medicationRecords)
      .where(eq(medicationRecords.patientId, id))
      .orderBy(desc(medicationRecords.givenAt));

    return {
      medications: records.map((r) => ({ ...r, givenAt: r.givenAt.toISOString() })),
    };
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

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }

    const [reading] = await db
      .insert(vitalReadings)
      .values({
        patientId: id,
        pulse: body.pulse,
        spo2: body.spo2,
        respiratoryRate: body.respiratoryRate,
        painScore: body.painScore,
        systolicBp: body.systolicBP,
        temperature: body.temperature,
        onSupplementalOxygen: body.onSupplementalOxygen,
        acvpu: body.acvpu as typeof vitalReadings.$inferInsert['acvpu'],
      })
      .returning();

    const mapped = mapVitals(reading!);

    broadcast({
      type: 'patient.vitals_updated',
      eventId: patient.eventId,
      payload: { patientId: id, vitals: mapped },
      timestamp: mapped.timestamp,
    });

    return reply.code(201).send({ vitals: mapped });
  });
}

function mapPatient(row: typeof patients.$inferSelect, extras?: { actionHistory?: unknown[] }) {
  return {
    ...row,
    arrivalTime: row.arrivalTime.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    actionHistory: extras?.actionHistory ?? [],
  };
}

function mapVitals(row: typeof vitalReadings.$inferSelect) {
  return {
    id: row.id,
    patientId: row.patientId,
    timestamp: row.timestamp.toISOString(),
    pulse: row.pulse ?? undefined,
    spo2: row.spo2 ?? undefined,
    respiratoryRate: row.respiratoryRate ?? undefined,
    painScore: row.painScore ?? undefined,
    systolicBP: row.systolicBp ?? undefined,
    temperature: row.temperature ?? undefined,
    onSupplementalOxygen: row.onSupplementalOxygen ?? undefined,
    acvpu: row.acvpu ?? undefined,
  };
}
