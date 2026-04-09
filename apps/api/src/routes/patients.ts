import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  AmkAssistDraft,
  AmkCallLog,
  ConfirmAmkAssistRequest,
  CreateAmkCallLogRequest,
} from '@rkf/shared-types';
import { db } from '../db/index.js';
import { actionEvents, medicationRecords, patients, teams, vitalReadings } from '../db/schema.js';
import { canAccessEvent, requireAuth } from '../middleware/auth.js';
import { applyPatientAction, getActionHistoryByEntityIds } from './action-events.js';
import { broadcast } from './ws.js';
import { generateAmkAssistDraft } from '../lib/ai-assist.js';

type AuthUser = {
  role?: string;
  eventId?: string;
  sub?: string;
  email?: string;
  codeId?: string;
};

function getActor(user: AuthUser): string {
  const actor = user.sub ?? user.email ?? (user.codeId ? `code:${user.codeId}` : undefined) ?? user.role;
  if (!actor) {
    const err = new Error('Token mangler identitet') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  return actor;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_GENDERS = new Set(['male', 'female', 'other']);
const ALLOWED_PLACEMENT_TYPES = new Set(['chair', 'bed']);
const PLACEMENT_NUMBER_REGEX = /^\d{1,4}$/;

function normalizeGender(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_GENDERS.has(normalized) ? normalized : undefined;
}

function parseBirthDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!ISO_DATE_REGEX.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (date.toISOString().slice(0, 10) !== value) return undefined;
  const todayIso = new Date().toISOString().slice(0, 10);
  if (value > todayIso) return undefined;
  return value;
}

function normalizePlacementType(value: unknown): 'chair' | 'bed' | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_PLACEMENT_TYPES.has(normalized)) return undefined;
  return normalized as 'chair' | 'bed';
}

function normalizePlacementNumber(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!PLACEMENT_NUMBER_REGEX.test(normalized)) return undefined;
  return normalized;
}

function parsePlacementPair(
  placementTypeValue: unknown,
  placementNumberValue: unknown,
): { placementType: 'chair' | 'bed' | null; placementNumber: string | null } | { error: string } {
  const typeBlank = placementTypeValue == null || (typeof placementTypeValue === 'string' && !placementTypeValue.trim());
  const numberBlank = placementNumberValue == null || (typeof placementNumberValue === 'string' && !placementNumberValue.trim());
  if (typeBlank && numberBlank) {
    return { placementType: null, placementNumber: null };
  }

  const placementType = normalizePlacementType(placementTypeValue);
  const placementNumber = normalizePlacementNumber(placementNumberValue);

  if (!placementType || !placementNumber) {
    return { error: 'Plassering må være stol/seng og et nummer (1-9999)' };
  }
  return { placementType, placementNumber };
}

function calculateAgeYears(birthDate: string, reference: Date = new Date()): number {
  const parsedBirthDate = new Date(`${birthDate}T00:00:00Z`);
  let age = reference.getUTCFullYear() - parsedBirthDate.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - parsedBirthDate.getUTCMonth();
  const dayDiff = reference.getUTCDate() - parsedBirthDate.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 0 ? age : 0;
}

async function logPatientArtifactAction(params: {
  patientId: string;
  eventId: string;
  actionType: string;
  payload: Record<string, unknown>;
  createdBy: string;
}) {
  const [action] = await db
    .insert(actionEvents)
    .values({
      eventId: params.eventId,
      entityType: 'patient',
      entityId: params.patientId,
      actionType: params.actionType,
      payload: params.payload,
      createdBy: params.createdBy,
    })
    .returning();

  return {
    ...action!,
    createdAt: action!.createdAt.toISOString(),
    revertedAt: action!.revertedAt?.toISOString(),
  };
}

export async function patientRoutes(app: FastifyInstance) {
  // List patients for an event (with latest vitals attached)
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const user = (request as any).user as AuthUser;
    const { eventId, assignedTeamId } = request.query as { eventId?: string; assignedTeamId?: string };
    const targetEventId = eventId ?? user.eventId;

    if (!targetEventId) {
      return { patients: [] };
    }
    if (!canAccessEvent(user, targetEventId)) {
      return { patients: [] };
    }

    const whereClause = assignedTeamId
      ? and(eq(patients.eventId, targetEventId), eq(patients.assignedTeamId, assignedTeamId))
      : eq(patients.eventId, targetEventId);

    const patientRows = await db
      .select()
      .from(patients)
      .where(whereClause)
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
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
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
    const user = (request as any).user as AuthUser;
    const body = request.body as {
      eventId?: string;
      incidentId?: string;
      ageGroup?: string;
      gender?: string;
      fullName?: string;
      birthDate?: string;
      placementType?: string;
      placementNumber?: string;
      presentingComplaint?: string;
      assignedClinician?: string;
    };

    const eventId = body.eventId ?? user.eventId;
    if (!eventId) {
      return reply.code(400).send({ error: 'Mangler eventId' });
    }
    if (!canAccessEvent(user, eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const parsedBirthDate = body.birthDate ? parseBirthDate(body.birthDate) : undefined;
    if (body.birthDate && !parsedBirthDate) {
      return reply.code(400).send({ error: 'Ugyldig fødselsdato' });
    }

    const normalizedGender = body.gender ? normalizeGender(body.gender) : undefined;
    if (body.gender && !normalizedGender) {
      return reply.code(400).send({ error: 'Ugyldig kjønn' });
    }

    const hasPlacementInput = body.placementType !== undefined || body.placementNumber !== undefined;
    const parsedPlacement = hasPlacementInput
      ? parsePlacementPair(body.placementType, body.placementNumber)
      : null;
    if (parsedPlacement && 'error' in parsedPlacement) {
      return reply.code(400).send({ error: parsedPlacement.error });
    }

    const fullName = body.fullName?.trim() || undefined;
    const placementType = parsedPlacement?.placementType ?? undefined;
    const placementNumber = parsedPlacement?.placementNumber ?? undefined;
    const [patient] = await db
      .insert(patients)
      .values({
        eventId,
        incidentId: body.incidentId,
        ageGroup: body.ageGroup,
        gender: normalizedGender,
        fullName,
        birthDate: parsedBirthDate,
        placementType,
        placementNumber,
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
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      status: string;
      assignedClinician: string;
      diagnosisFlags: string[];
      fullName: string;
      gender: string;
      birthDate: string;
      placementType: string | null;
      placementNumber: string | null;
      // Field patient fields
      label: string | null;
      triageStatus: string | null;
      description: string | null;
      positionText: string | null;
      lat: number | null;
      lon: number | null;
      assignedTeamId: string | null;
    }>;

    const [existing] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, id))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }
    if (!canAccessEvent(user, existing.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const normalizedGender = body.gender ? normalizeGender(body.gender) : undefined;
    if (body.gender && !normalizedGender) {
      return reply.code(400).send({ error: 'Ugyldig kjønn' });
    }

    const parsedBirthDate = body.birthDate ? parseBirthDate(body.birthDate) : undefined;
    if (body.birthDate && !parsedBirthDate) {
      return reply.code(400).send({ error: 'Ugyldig fødselsdato' });
    }

    const hasPlacementType = Object.prototype.hasOwnProperty.call(body, 'placementType');
    const hasPlacementNumber = Object.prototype.hasOwnProperty.call(body, 'placementNumber');
    if (hasPlacementType !== hasPlacementNumber) {
      return reply.code(400).send({ error: 'placementType og placementNumber må oppgis sammen' });
    }

    const parsedPlacement = hasPlacementType
      ? parsePlacementPair(body.placementType, body.placementNumber)
      : null;
    if (parsedPlacement && 'error' in parsedPlacement) {
      return reply.code(400).send({ error: parsedPlacement.error });
    }

    if (body.status) {
      const result = await applyPatientAction({
        patientId: id,
        user,
        body: { type: 'status.set', status: body.status },
      });
      if (result.error) {
        return reply.code(result.error.code).send({ error: result.error.message });
      }
      return result;
    }

    // Validate assignedTeamId if provided
    if (body.assignedTeamId !== undefined && body.assignedTeamId !== null) {
      const [teamRow] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, body.assignedTeamId)).limit(1);
      if (!teamRow) return reply.code(400).send({ error: 'Ukjent lag' });
    }

    const VALID_TRIAGE = new Set(['green', 'yellow', 'red', 'black']);
    if (body.triageStatus !== undefined && body.triageStatus !== null && !VALID_TRIAGE.has(body.triageStatus)) {
      return reply.code(400).send({ error: 'Ugyldig triagstatus' });
    }

    // Compute changedFields by comparing with existing
    const changedFields: string[] = [];
    const fieldChecks: Array<[string, unknown, unknown]> = [
      ['label', existing.label, body.label],
      ['triageStatus', existing.triageStatus, body.triageStatus],
      ['description', existing.description, body.description],
      ['positionText', existing.positionText, body.positionText],
      ['lat', existing.lat, body.lat],
      ['lon', existing.lon, body.lon],
      ['assignedTeamId', existing.assignedTeamId, body.assignedTeamId],
      ['assignedClinician', existing.assignedClinician, body.assignedClinician],
      ['fullName', existing.fullName, body.fullName !== undefined ? body.fullName?.trim() : undefined],
    ];
    for (const [field, oldVal, newVal] of fieldChecks) {
      if (newVal !== undefined && newVal !== oldVal) changedFields.push(field);
    }

    const [updated] = await db
      .update(patients)
      .set({
        ...(body.assignedClinician !== undefined && { assignedClinician: body.assignedClinician }),
        ...(body.diagnosisFlags && { diagnosisFlags: body.diagnosisFlags }),
        ...(body.fullName !== undefined && { fullName: body.fullName.trim() }),
        ...(normalizedGender !== undefined && { gender: normalizedGender }),
        ...(parsedBirthDate && { birthDate: parsedBirthDate }),
        ...(parsedPlacement && {
          placementType: parsedPlacement.placementType,
          placementNumber: parsedPlacement.placementNumber,
        }),
        ...(body.label !== undefined && { label: body.label }),
        ...(body.triageStatus !== undefined && { triageStatus: body.triageStatus as 'green' | 'yellow' | 'red' | 'black' | null }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.positionText !== undefined && { positionText: body.positionText }),
        ...(body.lat !== undefined && { lat: body.lat }),
        ...(body.lon !== undefined && { lon: body.lon }),
        ...(body.assignedTeamId !== undefined && { assignedTeamId: body.assignedTeamId }),
        updatedAt: new Date(),
      })
      .where(eq(patients.id, id))
      .returning();

    const mapped = mapPatient(updated!);
    broadcast({
      type: 'patient.updated',
      eventId: existing.eventId,
      payload: { patient: mapped, changedFields },
      timestamp: mapped.updatedAt,
    });

    return { patient: mapped };
  });

  app.post('/:id/actions', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const body = request.body as { type: 'status.set'; status: string };
    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) return reply.code(404).send({ error: 'Pasient ikke funnet' });
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }
    const result = await applyPatientAction({
      patientId: id,
      user,
      body,
    });
    if (result.error) return reply.code(result.error.code).send({ error: result.error.message });
    return result;
  });

  // Add clinical note (append-only)
  app.post('/:id/notes', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
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
    if (!canAccessEvent(user, existing.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
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

  // Structured AMK (113) call log (append-only)
  app.post('/:id/amk-calls', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const parsed = CreateAmkCallLogRequest.safeParse(request.body);

    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) return reply.code(404).send({ error: 'Pasient ikke funnet' });
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    if (!parsed.success) {
      return reply.code(400).send({
        error: 'summaryGiven, amkGuidance og followUpOwner er påkrevd',
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    if (!body.summaryGiven.trim() || !body.amkGuidance.trim() || !body.followUpOwner.trim()) {
      return reply.code(400).send({ error: 'summaryGiven, amkGuidance og followUpOwner er påkrevd' });
    }
    const calledAt = body.calledAt ? new Date(body.calledAt) : new Date();
    if (Number.isNaN(calledAt.getTime())) {
      return reply.code(400).send({ error: 'calledAt må være gyldig ISO-tid' });
    }

    const callLog = {
      id: crypto.randomUUID(),
      eventId: patient.eventId,
      patientId: id,
      calledAt: calledAt.toISOString(),
      summaryGiven: body.summaryGiven.trim(),
      amkGuidance: body.amkGuidance.trim(),
      followUpOwner: body.followUpOwner.trim(),
      referenceId: body.referenceId?.trim() || undefined,
      eta: body.eta?.trim() || undefined,
      recordedBy: getActor(user),
    };

    const action = await logPatientArtifactAction({
      patientId: id,
      eventId: patient.eventId,
      actionType: 'patient.amk_call_logged',
      payload: { callLog },
      createdBy: getActor(user),
    });

    return reply.code(201).send({ callLog, action });
  });

  app.get('/:id/amk-calls', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };

    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) return reply.code(404).send({ error: 'Pasient ikke funnet' });
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const rows = await db
      .select()
      .from(actionEvents)
      .where(eq(actionEvents.entityId, id))
      .orderBy(desc(actionEvents.createdAt));

    const callLogs = rows
      .filter((row) =>
        row.entityType === 'patient'
        && row.eventId === patient.eventId
        && row.actionType === 'patient.amk_call_logged',
      )
      .map((row) => (row.payload as { callLog?: unknown }).callLog)
      .filter((log): log is unknown => Boolean(log))
      .map((log) => AmkCallLog.parse(log));

    return { callLogs };
  });

  app.post('/:id/amk-assist/draft', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };

    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) return reply.code(404).send({ error: 'Pasient ikke funnet' });
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const [latestVitals] = await db
      .select()
      .from(vitalReadings)
      .where(eq(vitalReadings.patientId, id))
      .orderBy(desc(vitalReadings.timestamp))
      .limit(1);

    const latestNote = patient.notes?.length
      ? `Tidligere notater: ${patient.notes.slice(-1)[0]?.text ?? 'Ingen'}`
      : 'Ingen kjente tilleggsopplysninger.';
    const { draft, provenance } = await generateAmkAssistDraft({
      presentingComplaint: patient.presentingComplaint,
      latestVitals: latestVitals
        ? {
            pulse: latestVitals.pulse,
            spo2: latestVitals.spo2,
            respiratoryRate: latestVitals.respiratoryRate,
            systolicBp: latestVitals.systolicBp,
            temperature: latestVitals.temperature,
            acvpu: latestVitals.acvpu,
            onSupplementalOxygen: latestVitals.onSupplementalOxygen,
          }
        : null,
      sbar: { latestNote },
    });
    const parsedDraft = AmkAssistDraft.parse(draft);

    await logPatientArtifactAction({
      patientId: id,
      eventId: patient.eventId,
      actionType: 'patient.amk_ai_draft_generated',
      payload: { draft: parsedDraft, provenance },
      createdBy: getActor(user),
    });

    return parsedDraft;
  });

  app.post('/:id/amk-assist/confirm', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const parsed = ConfirmAmkAssistRequest.safeParse(request.body);

    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) return reply.code(404).send({ error: 'Pasient ikke funnet' });
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    if (!parsed.success || !parsed.data.spokenScript.trim()) {
      return reply.code(400).send({ error: 'spokenScript og criticality er påkrevd' });
    }
    const body = parsed.data;

    const confirmed = {
      criticality: body.criticality,
      spokenScript: body.spokenScript.trim(),
      rationale: body.rationale?.trim() || undefined,
      sayFirst: body.sayFirst?.filter((line) => line.trim().length > 0) ?? [],
      sbarDraft: body.sbarDraft ?? undefined,
      confirmedAt: new Date().toISOString(),
      confirmedBy: getActor(user),
    };

    const action = await logPatientArtifactAction({
      patientId: id,
      eventId: patient.eventId,
      actionType: 'patient.amk_ai_script_confirmed',
      payload: { confirmed },
      createdBy: getActor(user),
    });

    return { ok: true, action, confirmed };
  });

  // Record medication administration (append-only)
  app.post('/:id/medications', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
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
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
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
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };

    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) {
      return reply.code(404).send({ error: 'Pasient ikke funnet' });
    }
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
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
    const user = (request as any).user as AuthUser;
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
    if (!canAccessEvent(user, patient.eventId)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
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
  const birthDateString = typeof row.birthDate === 'string' ? row.birthDate : undefined;
  const ageYears = birthDateString ? calculateAgeYears(birthDateString) : undefined;
  return {
    ...row,
    fullName: row.fullName ?? undefined,
    gender: row.gender ?? undefined,
    birthDate: birthDateString,
    placementType: row.placementType ?? undefined,
    placementNumber: row.placementNumber ?? undefined,
    ageYears,
    // Field patient fields
    label: row.label ?? null,
    triageStatus: row.triageStatus ?? null,
    description: row.description ?? null,
    positionText: row.positionText ?? null,
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    assignedTeamId: row.assignedTeamId ?? null,
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
