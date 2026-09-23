import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { events, patients, teams, actionEvents, vitalReadings, accessCodes } from '../db/schema.js';
import { canAccessEvent, requireAuth, requireRole } from '../middleware/auth.js';
import { broadcast } from './ws.js';
import { getLatestTeamStatuses } from './teams.js';
import { mapPatient } from './patients.js';
import { calculateNEWS2 } from '@rkf/shared-types';

type AuthUser = { role?: string; eventId?: string };

type IndoorLayout = {
  venueId: string;
  venueName?: string;
  floors: Array<{
    id: string;
    label: string;
    zones: Array<{ id: string; label: string; center: { lat: number; lng: number } }>;
  }>;
};

type MapRuntimeConfig = {
  provider?: 'leaflet' | 'maplibre';
  styleUrl?: string;
  enable3d?: boolean;
  layers?: Array<{
    id: string;
    type: 'xyz' | 'wmts';
    url: string;
    attribution?: string;
    token?: string;
    minZoom?: number;
    maxZoom?: number;
  }>;
};

type EnvMapConfig = {
  default?: MapRuntimeConfig;
  events?: Record<string, MapRuntimeConfig & { indoorLayout?: IndoorLayout }>;
  indoorLayouts?: Record<string, IndoorLayout>;
};

/** Capacity settings (gap B6): `events.settings`. */
type EventSettings = {
  sickbay?: { chairs?: number; beds?: number };
};

function parseEnvMapConfig(): EnvMapConfig {
  const raw = process.env.MAP_CONFIG_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as EnvMapConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizeRuntimeConfig(input?: MapRuntimeConfig | null): MapRuntimeConfig | null {
  if (!input) return null;
  return {
    provider: input.provider,
    styleUrl: input.styleUrl,
    enable3d: input.enable3d,
    layers: (input.layers ?? []).map((layer) => ({
      id: layer.id,
      type: layer.type,
      url: layer.url,
      attribution: layer.attribution,
      token: layer.token,
      minZoom: layer.minZoom,
      maxZoom: layer.maxZoom,
    })),
  };
}

function mergeRuntimeConfig(base?: MapRuntimeConfig, override?: MapRuntimeConfig): MapRuntimeConfig | null {
  const merged: MapRuntimeConfig = {
    ...(base ?? {}),
    ...(override ?? {}),
    layers: override?.layers ?? base?.layers ?? [],
  };
  return sanitizeRuntimeConfig(merged);
}

export async function eventRoutes(app: FastifyInstance) {
  // List events
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const user = (request as any).user;

    const rows = user.eventId
      ? await db.select().from(events).where(eq(events.id, user.eventId))
      : await db.select().from(events);

    return { events: rows.map(mapEvent) };
  });

  // Get single event with teams
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    // Event set-up (gap B5): a stood-down team is hidden by default so the
    // coordinator's dropdowns don't fill up with retired patrols.
    const { includeInactive } = request.query as { includeInactive?: string };

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const [teamList, teamStatuses] = await Promise.all([
      db.select().from(teams).where(eq(teams.eventId, id)),
      getLatestTeamStatuses(id),
    ]);

    const visibleTeams = includeInactive === '1' ? teamList : teamList.filter((row) => row.active);

    return {
      event: mapEvent(event),
      teams: visibleTeams.map((row) => {
        const snapshot = teamStatuses.get(row.id);
        return {
          ...mapTeam(row),
          operationalStatus: snapshot?.status ?? 'available',
          statusNote: snapshot?.note ?? null,
          statusUpdatedAt: snapshot?.updatedAt ?? null,
        };
      }),
    };
  });

  // ── Lane 8 batch 3 (B): event set-up, capacity settings, access codes ──

  const EventPatchBody = z.object({
    name: z.string().min(1).max(200).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
  });

  // Event set-up (gap B5): rename, reschedule or change the event's status.
  app.patch('/:id', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = EventPatchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Ugyldig arrangementdata', details: parsed.error.flatten() });
    }

    const [existing] = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Arrangement ikke funnet' });

    const updates: Partial<typeof events.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.startDate !== undefined) updates.startDate = new Date(parsed.data.startDate);
    if (parsed.data.endDate !== undefined) updates.endDate = new Date(parsed.data.endDate);
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    const [updated] = await db.update(events).set(updates).where(eq(events.id, id)).returning();
    const mapped = mapEvent(updated!);

    broadcast({
      type: 'event.updated',
      eventId: id,
      payload: { event: mapped },
      timestamp: mapped.updatedAt,
    });

    return { event: mapped };
  });

  const EventSettingsBody = z.object({
    sickbay: z.object({
      chairs: z.number().int().min(0).max(999).optional(),
      beds: z.number().int().min(0).max(999).optional(),
    }).optional(),
  });

  // Capacity settings (gap B6): merges into whatever is already stored, so a
  // beds-only update never clobbers a previously-set chairs count.
  app.patch('/:id/settings', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = EventSettingsBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Ugyldige innstillinger', details: parsed.error.flatten() });
    }

    const [existing] = await db.select({ settings: events.settings }).from(events).where(eq(events.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'Arrangement ikke funnet' });

    const current = (existing.settings ?? {}) as EventSettings;
    const merged: EventSettings = {
      ...current,
      sickbay: parsed.data.sickbay === undefined
        ? current.sickbay
        : { ...current.sickbay, ...parsed.data.sickbay },
    };

    const [updated] = await db
      .update(events)
      .set({ settings: merged, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();

    broadcast({
      type: 'event.settings_updated',
      eventId: id,
      payload: { settings: updated!.settings },
      timestamp: new Date().toISOString(),
    });

    return { settings: updated!.settings ?? {} };
  });

  // Event set-up (gap B5): list the event's access codes (code is shown in
  // full — it is already how the role gets in, so nothing is hidden here).
  app.get('/:id/access-codes', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });

    const rows = await db
      .select()
      .from(accessCodes)
      .where(eq(accessCodes.eventId, id))
      .orderBy(desc(accessCodes.expiresAt));

    return { codes: rows.map(mapAccessCode) };
  });

  const CreateAccessCodeBody = z.object({
    role: z.enum(['first_aider', 'sickbay', 'coordinator']),
    hours: z.number().int().min(1).max(168).optional(),
  });

  const ACCESS_CODE_GENERATION_ATTEMPTS = 10;

  function generateSixDigitCode(): string {
    return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  }

  // Event set-up (gap B5): a fresh unique 6-digit code, shown once here —
  // afterwards only its metadata is listable via GET .../access-codes.
  app.post('/:id/access-codes', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = CreateAccessCodeBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Ugyldig kode-forespørsel', details: parsed.error.flatten() });
    }

    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });

    const hours = parsed.data.hours ?? 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    let created: typeof accessCodes.$inferSelect | undefined;
    for (let attempt = 0; attempt < ACCESS_CODE_GENERATION_ATTEMPTS && !created; attempt += 1) {
      const code = generateSixDigitCode();
      const [collision] = await db.select({ id: accessCodes.id }).from(accessCodes).where(eq(accessCodes.code, code)).limit(1);
      if (collision) continue;
      const [row] = await db
        .insert(accessCodes)
        .values({ eventId: id, role: parsed.data.role, code, expiresAt })
        .returning();
      created = row;
    }

    if (!created) {
      return reply.code(500).send({ error: 'Kunne ikke generere en unik kode — prøv igjen' });
    }

    return reply.code(201).send({ code: mapAccessCode(created) });
  });

  const CreateTeamBody = z.object({
    name: z.string().min(1).max(100),
    transport: z.enum(['foot', 'bike', 'vehicle', 'atv']).optional(),
    contactPhone: z.string().max(50).nullable().optional(),
    contactRadio: z.string().max(50).nullable().optional(),
  });

  // Event set-up (gap B5): add a new team/patrol to the event.
  app.post('/:id/teams', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = CreateTeamBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Ugyldig lagdata', details: parsed.error.flatten() });
    }

    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });

    const [created] = await db
      .insert(teams)
      .values({
        eventId: id,
        name: parsed.data.name.trim(),
        transport: parsed.data.transport ?? 'foot',
        contactPhone: parsed.data.contactPhone ?? null,
        contactRadio: parsed.data.contactRadio ?? null,
      })
      .returning();
    const mapped = mapTeam(created!);

    broadcast({
      type: 'team.created',
      eventId: id,
      payload: { team: mapped },
      timestamp: new Date().toISOString(),
    });

    return reply.code(201).send({ team: mapped });
  });

  app.get('/:id/indoor-layout', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const envConfig = parseEnvMapConfig();
    const envLayout = envConfig.indoorLayouts?.[id] ?? envConfig.events?.[id]?.indoorLayout;
    const layout = (event.indoorLayout ?? envLayout ?? null) as IndoorLayout | null;
    return { layout };
  });

  app.get('/:id/map-config', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };
    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const envConfig = parseEnvMapConfig();
    const envDefault = envConfig.default;
    const envEvent = envConfig.events?.[id];
    const resolved = mergeRuntimeConfig(
      envDefault,
      (event.mapRuntimeConfig as MapRuntimeConfig | null) ?? envEvent,
    );
    return { config: resolved };
  });

  app.get('/:id/sickbay-incoming', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };

    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const incomingPatients = await db
      .select()
      .from(patients)
      .where(and(eq(patients.eventId, id), eq(patients.status, 'incoming')))
      .orderBy(desc(patients.updatedAt));

    if (incomingPatients.length === 0) {
      return { items: [] };
    }

    const patientIds = incomingPatients.map((p) => p.id);
    const teamIds = [...new Set(incomingPatients.map((p) => p.assignedTeamId).filter((v): v is string => Boolean(v)))];

    const [vitalsRows, teamStatusRows] = await Promise.all([
      db.select().from(vitalReadings).where(inArray(vitalReadings.patientId, patientIds)).orderBy(desc(vitalReadings.timestamp)),
      teamIds.length === 0
        ? Promise.resolve([])
        : db
          .select()
          .from(actionEvents)
          .where(and(
            eq(actionEvents.eventId, id),
            eq(actionEvents.entityType, 'team'),
            eq(actionEvents.actionType, 'team.status_set'),
            inArray(actionEvents.entityId, teamIds),
          ))
          .orderBy(desc(actionEvents.createdAt)),
    ]);

    const latestVitalsByPatientId = new Map<string, typeof vitalReadings.$inferSelect>();
    for (const row of vitalsRows) {
      if (!latestVitalsByPatientId.has(row.patientId)) {
        latestVitalsByPatientId.set(row.patientId, row);
      }
    }

    const teamStatusByTeamId = new Map<string, string>();
    for (const row of teamStatusRows) {
      if (!teamStatusByTeamId.has(row.entityId)) {
        const status = (row.payload as { status?: string }).status;
        if (status) teamStatusByTeamId.set(row.entityId, status);
      }
    }

    const items = incomingPatients.map((patient) => {
      const latestVitals = latestVitalsByPatientId.get(patient.id) ?? null;
      const mappedVitals = latestVitals
        ? {
            id: latestVitals.id,
            patientId: latestVitals.patientId,
            timestamp: latestVitals.timestamp.toISOString(),
            pulse: latestVitals.pulse ?? undefined,
            spo2: latestVitals.spo2 ?? undefined,
            respiratoryRate: latestVitals.respiratoryRate ?? undefined,
            painScore: latestVitals.painScore ?? undefined,
            systolicBP: latestVitals.systolicBp ?? undefined,
            temperature: latestVitals.temperature ?? undefined,
            onSupplementalOxygen: latestVitals.onSupplementalOxygen ?? undefined,
            acvpu: latestVitals.acvpu ?? undefined,
          }
        : null;

      const news2 = mappedVitals ? calculateNEWS2(mappedVitals) : null;
      const criticalReasons: Array<'needs_assistance' | 'triage_red' | 'news2_high'> = [];

      if (patient.assignedTeamId && teamStatusByTeamId.get(patient.assignedTeamId) === 'needs_assistance') {
        criticalReasons.push('needs_assistance');
      }
      if (patient.triageStatus === 'red') {
        criticalReasons.push('triage_red');
      }
      if (news2?.alertLevel === 'high') {
        criticalReasons.push('news2_high');
      }

      return {
        patientId: patient.id,
        label: patient.label ?? null,
        triageStatus: patient.triageStatus ?? null,
        teamId: patient.assignedTeamId ?? null,
        critical: criticalReasons.length > 0,
        criticalReasons,
        latestVitals: mappedVitals,
        news2: news2 ? { total: news2.total, alertLevel: news2.alertLevel } : null,
        updatedAt: patient.updatedAt.toISOString(),
        seq: patient.seq ?? null,
        handedOverAt: patient.handedOverAt ? patient.handedOverAt.toISOString() : null,
        handedOverByTeamId: patient.handedOverByTeamId ?? null,
        fieldOutcome: patient.fieldOutcome ?? null,
        amkNotifiedAt: patient.amkNotifiedAt ? patient.amkNotifiedAt.toISOString() : null,
        amkNotifiedBy: patient.amkNotifiedBy ?? null,
      };
    });

    items.sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return { items };
  });

  // Create event (coordinator/admin only)
  app.post('/', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
    const body = request.body as { name: string; startDate: string; endDate: string };

    const [event] = await db
      .insert(events)
      .values({
        name: body.name,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: 'draft',
      })
      .returning();

    return reply.code(201).send({ event: mapEvent(event!) });
  });

  // Post-event debrief report
  app.get('/:id/report', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
    const user = (request as any).user;

    const { id } = request.params as { id: string };

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const [eventPatients, eventTeams] = await Promise.all([
      db.select().from(patients).where(eq(patients.eventId, id)).orderBy(desc(patients.createdAt)),
      db.select().from(teams).where(eq(teams.eventId, id)),
    ]);

    const durationMs = event.endDate.getTime() - event.startDate.getTime();
    const durationHours = (durationMs / 3_600_000).toFixed(1);
    const transferredPatients = eventPatients.filter((p) => p.status === 'transferred');
    const dischargedPatients = eventPatients.filter((p) => p.status === 'discharged');

    const triageBreakdown = eventPatients.reduce<Record<string, number>>((acc, p) => {
      if (p.triageStatus) acc[p.triageStatus] = (acc[p.triageStatus] ?? 0) + 1;
      return acc;
    }, {});

    const now = new Date().toISOString();

    const report = [
      `# Debrief-rapport: ${event.name}`,
      ``,
      `**Generert:** ${new Date(now).toLocaleString('nb-NO')}`,
      `**Arrangementet:** ${event.startDate.toLocaleString('nb-NO')} – ${event.endDate.toLocaleString('nb-NO')} (${durationHours} timer)`,
      ``,
      `---`,
      ``,
      `## Oppsummering`,
      ``,
      `| Parameter | Verdi |`,
      `|-----------|-------|`,
      `| Pasienter totalt | ${eventPatients.length} |`,
      `| Under behandling | ${eventPatients.filter((p) => p.status === 'in_treatment').length} |`,
      `| Overført til sykehus | ${transferredPatients.length} |`,
      `| Utskrevet | ${dischargedPatients.length} |`,
      `| Aktive lag | ${eventTeams.length} |`,
      ``,
      ...(Object.keys(triageBreakdown).length > 0 ? [
        `## Triage-oversikt`,
        ``,
        ...Object.entries(triageBreakdown).map(([tag, count]) => `- ${tag}: ${count}`),
        ``,
      ] : []),
      `## Pasienter`,
      ``,
      ...eventPatients.map((p, i) =>
        `${i + 1}. ${p.label ?? p.presentingComplaint ?? '(ukjent)'} — ${p.ageGroup ?? ''} — Status: ${p.status}${p.triageStatus ? ` — Triage: ${p.triageStatus}` : ''}`
      ),
      ``,
      `---`,
      ``,
      `*Rapporten er generert automatisk av RKF-systemet og bør verifiseres mot journal.*`,
    ].join('\n');

    reply.header('Content-Type', 'text/markdown; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="rkf-rapport-${id.slice(0, 8)}.md"`);
    return reply.send(report);
  });

  // Event statistics
  app.get('/:id/stats', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as { id: string };

    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const eventPatients = await db.select().from(patients).where(eq(patients.eventId, id));

    return {
      totalPatients: eventPatients.length,
      patientsIncoming: eventPatients.filter((p) => p.status === 'incoming').length,
      patientsInTreatment: eventPatients.filter((p) => p.status === 'in_treatment').length,
      patientsObservation: eventPatients.filter((p) => p.status === 'observation').length,
      discharged: eventPatients.filter((p) => p.status === 'discharged').length,
      transferred: eventPatients.filter((p) => p.status === 'transferred').length,
    };
  });

  // Create a field patient scoped to an event (location optional).
  // First aiders report patients from the field with this endpoint ("Meld pasient"),
  // so it must be open to every role in the event; canAccessEvent still enforces
  // that code-based roles only write into their own event.
  app.post('/:id/patients', { preHandler: [requireAuth, requireRole(['first_aider', 'sickbay', 'coordinator', 'admin'])] }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id: eventId } = request.params as { id: string };

    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    if (!canAccessEvent(user, eventId)) return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });

    const body = request.body as {
      label?: string;
      triageStatus?: string;
      description?: string;
      positionText?: string;
      lat?: number;
      lon?: number;
      assignedTeamId?: string;
    };

    const label = body.label?.trim();
    if (!label) return reply.code(400).send({ error: 'label er påkrevd' });

    const VALID_TRIAGE = new Set(['green', 'yellow', 'red', 'black']);
    if (body.triageStatus && !VALID_TRIAGE.has(body.triageStatus)) {
      return reply.code(400).send({ error: 'Ugyldig triagstatus' });
    }

    if (body.assignedTeamId) {
      const [teamRow] = await db.select({ id: teams.id, eventId: teams.eventId }).from(teams).where(eq(teams.id, body.assignedTeamId)).limit(1);
      if (!teamRow || teamRow.eventId !== eventId) return reply.code(400).send({ error: 'Ukjent lag' });
    }

    // Shared patient number (gap A5): allocate the next seq atomically in the
    // same transaction as the insert, so a field report and a sick bay intake
    // in the same event never collide.
    const created = await db.transaction(async (tx) => {
      const [counter] = await tx
        .update(events)
        .set({ patientCounter: sql`${events.patientCounter} + 1` })
        .where(eq(events.id, eventId))
        .returning({ patientCounter: events.patientCounter });

      const [row] = await tx
        .insert(patients)
        .values({
          eventId,
          seq: counter?.patientCounter,
          label,
          triageStatus: body.triageStatus as 'green' | 'yellow' | 'red' | 'black' | undefined,
          description: body.description ?? null,
          positionText: body.positionText ?? null,
          lat: body.lat ?? null,
          lon: body.lon ?? null,
          assignedTeamId: body.assignedTeamId ?? null,
          notes: [],
          diagnosisFlags: [],
        })
        .returning();
      return row!;
    });

    const mapped = mapPatient(created);

    broadcast({
      type: 'patient.created',
      eventId,
      payload: { patient: mapped, changedFields: Object.keys(body).filter((k) => (body as any)[k] !== undefined) },
      timestamp: mapped.createdAt,
    });

    return reply.code(201).send({ patient: mapped });
  });

  // Team-patient engagements: all active team→patient statuses in this event
  // Used by the coordinator to see which teams are responding to each patient.
  app.get('/:id/team-patient-engagements', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id: eventId } = request.params as { id: string };

    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    if (!canAccessEvent(user, eventId)) return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });

    // All team.patient_status_set actions for this event, oldest first
    const psRows = await db
      .select()
      .from(actionEvents)
      .where(and(
        eq(actionEvents.eventId, eventId),
        eq(actionEvents.entityType, 'team'),
        eq(actionEvents.actionType, 'team.patient_status_set'),
      ))
      .orderBy(desc(actionEvents.createdAt));

    // Also legacy monitor_started/stopped for backward compat
    const monitorRows = await db
      .select()
      .from(actionEvents)
      .where(and(
        eq(actionEvents.eventId, eventId),
        eq(actionEvents.entityType, 'team'),
      ))
      .orderBy(desc(actionEvents.createdAt));

    const eventTeams = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.eventId, eventId));
    const teamNameMap = new Map(eventTeams.map((t) => [t.id, t.name]));

    // Build engagement map: teamId+patientId → status (latest wins, oldest-first sort)
    type EngagementKey = string; // `${teamId}:${patientId}`
    const engagementMap = new Map<EngagementKey, { teamId: string; patientId: string; status: string }>();
    const psSeen = new Set<EngagementKey>(); // patient-status-set actions take precedence

    const sorted = [...psRows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const row of sorted) {
      const p = row.payload as { patientId?: string; status?: string | null };
      if (!p.patientId) continue;
      const key: EngagementKey = `${row.entityId}:${p.patientId}`;
      psSeen.add(key);
      if (p.status != null) {
        engagementMap.set(key, { teamId: row.entityId, patientId: p.patientId, status: p.status });
      } else {
        engagementMap.delete(key);
      }
    }

    // Legacy monitor_started/stopped
    const monitorSorted = [...monitorRows]
      .filter((r) => r.actionType === 'team.monitor_started' || r.actionType === 'team.monitor_stopped')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const row of monitorSorted) {
      const p = row.payload as { patientId?: string };
      if (!p.patientId) continue;
      const key: EngagementKey = `${row.entityId}:${p.patientId}`;
      if (psSeen.has(key)) continue;
      if (row.actionType === 'team.monitor_started') {
        engagementMap.set(key, { teamId: row.entityId, patientId: p.patientId, status: 'monitoring' });
      } else {
        engagementMap.delete(key);
      }
    }

    // Group by patientId
    const result: Record<string, Array<{ teamId: string; teamName: string; patientId: string; status: string }>> = {};
    for (const { teamId, patientId, status } of engagementMap.values()) {
      if (!result[patientId]) result[patientId] = [];
      result[patientId]!.push({ teamId, teamName: teamNameMap.get(teamId) ?? teamId, patientId, status });
    }

    return { engagements: result };
  });
}

function mapEvent(row: typeof events.$inferSelect) {
  const {
    mapRuntimeConfig: _mapRuntimeConfig,
    indoorLayout: _indoorLayout,
    ...rest
  } = row;
  const envConfig = parseEnvMapConfig();
  const envEvent = envConfig.events?.[row.id];
  const resolvedMapConfig = mergeRuntimeConfig(
    envConfig.default,
    (_mapRuntimeConfig as MapRuntimeConfig | null) ?? envEvent,
  );
  const resolvedIndoorLayout =
    (_indoorLayout as IndoorLayout | null)
    ?? envConfig.indoorLayouts?.[row.id]
    ?? envEvent?.indoorLayout
    ?? null;

  return {
    ...rest,
    mapRuntimeConfig: resolvedMapConfig,
    indoorLayout: resolvedIndoorLayout,
    // Capacity settings (gap B6) — never null on the wire, so the client can
    // always read `event.settings.sickbay?.chairs` without a guard.
    settings: (rest.settings ?? {}) as EventSettings,
    startDate: rest.startDate.toISOString(),
    endDate: rest.endDate.toISOString(),
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  };
}

function mapTeam(row: typeof teams.$inferSelect) {
  return {
    ...row,
    lastPositionUpdate: row.lastPositionUpdate?.toISOString(),
  };
}

// ── Lane 8 batch 3 (B): access codes (gap B5) ──────────────────────
function mapAccessCode(row: typeof accessCodes.$inferSelect) {
  return {
    id: row.id,
    role: row.role,
    code: row.code,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}
