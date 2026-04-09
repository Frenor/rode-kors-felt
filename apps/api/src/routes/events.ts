import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { events, patients, teams, actionEvents, vitalReadings } from '../db/schema.js';
import { canAccessEvent, requireAuth, requireRole } from '../middleware/auth.js';
import { broadcast } from './ws.js';
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

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const teamList = await db.select().from(teams).where(eq(teams.eventId, id));

    return { event: mapEvent(event), teams: teamList.map(mapTeam) };
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

  // Create a field patient scoped to an event (coordinator-friendly, location optional)
  app.post('/:id/patients', { preHandler: [requireAuth, requireRole(['coordinator', 'admin'])] }, async (request, reply) => {
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

    const [created] = await db
      .insert(patients)
      .values({
        eventId,
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

    const mapped = {
      ...created!,
      label: created!.label ?? null,
      triageStatus: created!.triageStatus ?? null,
      description: created!.description ?? null,
      positionText: created!.positionText ?? null,
      lat: created!.lat ?? null,
      lon: created!.lon ?? null,
      assignedTeamId: created!.assignedTeamId ?? null,
      arrivalTime: created!.arrivalTime.toISOString(),
      createdAt: created!.createdAt.toISOString(),
      updatedAt: created!.updatedAt.toISOString(),
    };

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
