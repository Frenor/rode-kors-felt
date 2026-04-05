import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { calculateNEWS2 } from '@rkf/shared-types';
import { db } from '../db/index.js';
import { actionEvents, escalations, events, incidents, patients, teams, vitalReadings } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcast } from './ws.js';

type AuthUser = { role?: string; eventId?: string };

function canAccessEvent(user: AuthUser, eventId: string): boolean {
  if (user.role === 'admin') return true;
  if (!user.eventId) return true;
  return user.eventId === eventId;
}

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

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const incomingIncidentStatuses = ['dispatched', 'on_scene', 'transporting', 'at_sickbay'] as const;
    const incidentRows = await db
      .select()
      .from(incidents)
      .where(eq(incidents.eventId, id))
      .orderBy(desc(incidents.updatedAt));

    const incomingIncidents = incidentRows.filter((row) => incomingIncidentStatuses.includes(row.status));
    if (incomingIncidents.length === 0) {
      return { items: [] };
    }

    const incidentIds = incomingIncidents.map((row) => row.id);
    const teamIds = [...new Set(incomingIncidents.map((row) => row.teamId).filter((value): value is string => Boolean(value)))];

    const [patientRows, escalationRows, teamStatusRows] = await Promise.all([
      db.select().from(patients).where(eq(patients.eventId, id)).orderBy(desc(patients.updatedAt)),
      db
        .select()
        .from(escalations)
        .where(and(eq(escalations.eventId, id), isNull(escalations.resolvedAt), inArray(escalations.incidentId, incidentIds))),
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

    const patientByIncident = new Map<string, typeof patients.$inferSelect>();
    for (const patient of patientRows) {
      if (patient.incidentId && !patientByIncident.has(patient.incidentId)) {
        patientByIncident.set(patient.incidentId, patient);
      }
    }

    const patientIds = [...new Set([...patientByIncident.values()].map((row) => row.id))];
    const vitalsRows = patientIds.length === 0
      ? []
      : await db
        .select()
        .from(vitalReadings)
        .where(inArray(vitalReadings.patientId, patientIds))
        .orderBy(desc(vitalReadings.timestamp));

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

    const activeEscalations = new Set(escalationRows.map((row) => row.incidentId));
    const items = incomingIncidents.map((incident) => {
      const patient = patientByIncident.get(incident.id) ?? null;
      const latestVitals = patient ? latestVitalsByPatientId.get(patient.id) ?? null : null;

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
      const criticalReasons: Array<'needs_assistance' | 'open_escalation' | 'triage_immediate' | 'news2_high'> = [];

      if (incident.teamId && teamStatusByTeamId.get(incident.teamId) === 'needs_assistance') {
        criticalReasons.push('needs_assistance');
      }
      if (activeEscalations.has(incident.id)) {
        criticalReasons.push('open_escalation');
      }
      if (incident.triageTag === 'immediate') {
        criticalReasons.push('triage_immediate');
      }
      if (news2?.alertLevel === 'high') {
        criticalReasons.push('news2_high');
      }

      return {
        incidentId: incident.id,
        patientId: patient?.id ?? null,
        teamId: incident.teamId ?? null,
        progressStage: incident.status,
        critical: criticalReasons.length > 0,
        criticalReasons,
        latestVitals: mappedVitals,
        news2: news2 ? { total: news2.total, alertLevel: news2.alertLevel } : null,
        triageTag: incident.triageTag ?? null,
        updatedAt: incident.updatedAt.toISOString(),
      };
    });

    items.sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return { items };
  });

  // Create event (coordinator/admin only)
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'coordinator' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Kun admin kan opprette arrangement' });
    }

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

  // MCI mode toggle (coordinator only)
  app.patch('/:id/mci', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'coordinator' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Kun koordinator kan aktivere MCI-modus' });
    }

    const { id } = request.params as { id: string };
    const body = request.body as { mciActive: boolean; mciSectors?: string[] };

    const [existing] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!existing) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const now = new Date();
    const deactivatingMci = existing.mciActive && !body.mciActive;
    const summaryAttachment = deactivatingMci
      ? await buildMciSummaryAttachment({
          eventId: id,
          eventName: existing.name,
          generatedBy: user.email ?? 'koordinator',
        })
      : null;

    const [updated] = await db
      .update(events)
      .set({
        mciActive: body.mciActive,
        mciActivatedAt: body.mciActive ? (existing.mciActivatedAt ?? now) : null,
        mciActivatedBy: body.mciActive ? (existing.mciActivatedBy ?? user.email ?? 'koordinator') : null,
        mciSectors: body.mciSectors ?? existing.mciSectors,
        mciSummaryHtml: summaryAttachment?.html ?? existing.mciSummaryHtml,
        mciSummaryGeneratedAt: summaryAttachment?.generatedAt ?? existing.mciSummaryGeneratedAt,
        mciSummaryGeneratedBy: summaryAttachment?.generatedBy ?? existing.mciSummaryGeneratedBy,
        updatedAt: now,
      })
      .where(eq(events.id, id))
      .returning();

    const wsType = body.mciActive ? 'event.mci_activated' : 'event.mci_deactivated';
    broadcast({
      type: wsType,
      eventId: id,
      payload: {
        mciActive: body.mciActive,
        activatedBy: user.email ?? 'koordinator',
        summaryGenerated: Boolean(summaryAttachment),
      },
      timestamp: now.toISOString(),
    });

    return { event: mapEvent(updated!) };
  });

  // Download latest MCI handover summary
  app.get('/:id/mci-summary', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'coordinator' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Kun koordinator kan laste ned MCI-overlevering' });
    }

    const { id } = request.params as { id: string };

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    if (!event.mciSummaryHtml) {
      return reply.code(404).send({ error: 'Ingen MCI-overlevering er generert ennå' });
    }

    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header(
      'Content-Disposition',
      `attachment; filename="rkf-mci-overlevering-${id.slice(0, 8)}.html"`,
    );
    return reply.send(event.mciSummaryHtml);
  });

  // Post-event debrief report
  app.get('/:id/report', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'coordinator' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Kun koordinator kan laste ned rapport' });
    }

    const { id } = request.params as { id: string };

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const [eventIncidents, eventPatients, eventTeams, eventEscalations] = await Promise.all([
      db.select().from(incidents).where(eq(incidents.eventId, id)).orderBy(desc(incidents.createdAt)),
      db.select().from(patients).where(eq(patients.eventId, id)).orderBy(desc(patients.createdAt)),
      db.select().from(teams).where(eq(teams.eventId, id)),
      db.select().from(escalations).where(eq(escalations.eventId, id)).orderBy(desc(escalations.raisedAt)),
    ]);

    // Compute summary stats
    const durationMs = event.endDate.getTime() - event.startDate.getTime();
    const durationHours = (durationMs / 3_600_000).toFixed(1);
    const transferredPatients = eventPatients.filter((p) => p.status === 'transferred');
    const dischargedPatients = eventPatients.filter((p) => p.status === 'discharged');

    const typeBreakdown = eventIncidents.reduce<Record<string, number>>((acc, inc) => {
      acc[inc.type] = (acc[inc.type] ?? 0) + 1;
      return acc;
    }, {});

    const triageBreakdown = eventIncidents.reduce<Record<string, number>>((acc, inc) => {
      if (inc.triageTag) acc[inc.triageTag] = (acc[inc.triageTag] ?? 0) + 1;
      return acc;
    }, {});

    const now = new Date().toISOString();

    // Build Markdown report
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
      `| Totale hendelser | ${eventIncidents.length} |`,
      `| Løste hendelser | ${eventIncidents.filter((i) => i.status === 'resolved').length} |`,
      `| Eskaleringer | ${eventEscalations.length} |`,
      `| Pasienter totalt | ${eventPatients.length} |`,
      `| Overført til sykehus | ${transferredPatients.length} |`,
      `| Utskrevet | ${dischargedPatients.length} |`,
      `| Aktive lag | ${eventTeams.length} |`,
      ``,
      `## Hendelsestyper`,
      ``,
      ...Object.entries(typeBreakdown).map(([type, count]) => `- ${type}: ${count}`),
      ``,
      ...(Object.keys(triageBreakdown).length > 0 ? [
        `## START-triage (MCI)`,
        ``,
        ...Object.entries(triageBreakdown).map(([tag, count]) => `- ${tag}: ${count}`),
        ``,
      ] : []),
      `## Hendelseslogg`,
      ``,
      ...eventIncidents.map((inc, i) =>
        `${i + 1}. **${inc.type.toUpperCase()}** — ${inc.status} — ${new Date(inc.createdAt).toLocaleString('nb-NO')}${inc.notes ? ` — ${inc.notes}` : ''}`
      ),
      ``,
      `## Pasienter`,
      ``,
      ...eventPatients.map((p, i) =>
        `${i + 1}. ${p.presentingComplaint ?? '(ukjent)'} — ${p.ageGroup ?? ''} — Status: ${p.status}`
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

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }
    if (!canAccessEvent(user, id)) {
      return reply.code(403).send({ error: 'Ingen tilgang til dette arrangementet' });
    }

    const [eventIncidents, eventPatients] = await Promise.all([
      db.select().from(incidents).where(eq(incidents.eventId, id)),
      db.select().from(patients).where(eq(patients.eventId, id)),
    ]);

    return {
      totalIncidents: eventIncidents.length,
      activeIncidents: eventIncidents.filter(
        (i) => i.status === 'on_scene' || i.status === 'transporting',
      ).length,
      resolvedIncidents: eventIncidents.filter((i) => i.status === 'resolved').length,
      totalPatients: eventPatients.length,
      patientsInTreatment: eventPatients.filter((p) => p.status === 'in_treatment').length,
      discharged: eventPatients.filter((p) => p.status === 'discharged').length,
    };
  });
}

async function buildMciSummaryAttachment(input: {
  eventId: string;
  eventName: string;
  generatedBy: string;
}) {
  const [eventIncidents, eventPatients, eventTeams] = await Promise.all([
    db.select().from(incidents).where(eq(incidents.eventId, input.eventId)),
    db.select().from(patients).where(eq(patients.eventId, input.eventId)),
    db.select().from(teams).where(eq(teams.eventId, input.eventId)),
  ]);

  const triageCounts = {
    immediate: 0,
    delayed: 0,
    minor: 0,
    expectant: 0,
    untagged: 0,
  };
  for (const incident of eventIncidents) {
    if (incident.triageTag) {
      triageCounts[incident.triageTag] += 1;
    } else {
      triageCounts.untagged += 1;
    }
  }

  const patientArrivalsByIncident = new Map<string, number>();
  for (const patient of eventPatients) {
    if (!patient.incidentId) continue;
    const arrivalMs = patient.arrivalTime.getTime();
    const current = patientArrivalsByIncident.get(patient.incidentId);
    if (current === undefined || arrivalMs < current) {
      patientArrivalsByIncident.set(patient.incidentId, arrivalMs);
    }
  }

  const firstResponseMinutes = eventIncidents
    .map((incident) => {
      const firstArrivalMs = patientArrivalsByIncident.get(incident.id);
      if (firstArrivalMs === undefined) return null;
      return Math.max(
        0,
        Math.round((firstArrivalMs - incident.createdAt.getTime()) / 60000),
      );
    })
    .filter((value): value is number => value !== null);

  const averageFirstResponseMinutes = firstResponseMinutes.length > 0
    ? Math.round(firstResponseMinutes.reduce((sum, value) => sum + value, 0) / firstResponseMinutes.length)
    : null;

  const teamNames = new Map(eventTeams.map((team) => [team.id, team.name]));
  const deploymentMap = new Map<string, number>();
  for (const incident of eventIncidents) {
    if (!incident.teamId) continue;
    deploymentMap.set(incident.teamId, (deploymentMap.get(incident.teamId) ?? 0) + 1);
  }

  const deployments = [...deploymentMap.entries()]
    .map(([teamId, count]) => ({
      teamId,
      teamName: teamNames.get(teamId) ?? 'Ukjent lag',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const generatedAt = new Date();

  const html = `<!doctype html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MCI-overlevering — ${escapeHtml(input.eventName)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "IBM Plex Sans", Arial, sans-serif; margin: 24px; color: #111827; line-height: 1.5; }
    h1, h2 { margin: 0 0 10px; }
    h1 { font-size: 28px; }
    h2 { margin-top: 24px; font-size: 20px; }
    .muted { color: #4b5563; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { text-align: left; padding: 10px 12px; border: 1px solid #d1d5db; }
    th { background: #f3f4f6; font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #ffffff; }
    @media print {
      body { margin: 12mm; font-size: 12pt; }
      .card { break-inside: avoid; }
      a { color: #111827; text-decoration: none; }
    }
  </style>
</head>
<body>
  <h1>MCI-overlevering</h1>
  <p class="muted"><strong>Arrangement:</strong> ${escapeHtml(input.eventName)}</p>
  <p class="muted"><strong>Generert:</strong> ${generatedAt.toLocaleString('nb-NO')}</p>
  <p class="muted"><strong>Generert av:</strong> ${escapeHtml(input.generatedBy)}</p>

  <h2>START-triage</h2>
  <div class="grid">
    <div class="card"><strong>Umiddelbar (rød):</strong> ${triageCounts.immediate}</div>
    <div class="card"><strong>Utsatt (gul):</strong> ${triageCounts.delayed}</div>
    <div class="card"><strong>Mindre (grønn):</strong> ${triageCounts.minor}</div>
    <div class="card"><strong>Forventet (sort):</strong> ${triageCounts.expectant}</div>
    <div class="card"><strong>Uklassifisert:</strong> ${triageCounts.untagged}</div>
    <div class="card"><strong>Totalt:</strong> ${eventIncidents.length}</div>
  </div>

  <h2>Tid til første respons</h2>
  <table>
    <thead>
      <tr>
        <th>Målepunkt</th>
        <th>Verdi</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Gjennomsnitt (minutter)</td>
        <td>${averageFirstResponseMinutes ?? 'Ingen data'}</td>
      </tr>
      <tr>
        <td>Hendelser med målt respons</td>
        <td>${firstResponseMinutes.length} / ${eventIncidents.length}</td>
      </tr>
    </tbody>
  </table>

  <h2>Lagdisponering</h2>
  <table>
    <thead>
      <tr>
        <th>Lag</th>
        <th>Antall tildelte hendelser</th>
      </tr>
    </thead>
    <tbody>
      ${
        deployments.length > 0
          ? deployments
              .map((row) => `<tr><td>${escapeHtml(row.teamName)}</td><td>${row.count}</td></tr>`)
              .join('')
          : '<tr><td colspan="2">Ingen registrerte lagdisponeringer</td></tr>'
      }
    </tbody>
  </table>
</body>
</html>`;

  return {
    html,
    generatedAt,
    generatedBy: input.generatedBy,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mapEvent(row: typeof events.$inferSelect) {
  const {
    mciSummaryHtml: _mciSummaryHtml,
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
    hasMciSummary: Boolean(_mciSummaryHtml),
    mapRuntimeConfig: resolvedMapConfig,
    indoorLayout: resolvedIndoorLayout,
    startDate: rest.startDate.toISOString(),
    endDate: rest.endDate.toISOString(),
    mciSummaryGeneratedAt: rest.mciSummaryGeneratedAt?.toISOString(),
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
