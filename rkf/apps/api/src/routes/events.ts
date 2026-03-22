import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { escalations, events, incidents, patients, teams } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcast } from './ws.js';

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
    const { id } = request.params as { id: string };

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
    }

    const teamList = await db.select().from(teams).where(eq(teams.eventId, id));

    return { event: mapEvent(event), teams: teamList.map(mapTeam) };
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

    const now = new Date();
    const [updated] = await db
      .update(events)
      .set({
        mciActive: body.mciActive,
        mciActivatedAt: body.mciActive ? (existing.mciActivatedAt ?? now) : null,
        mciActivatedBy: body.mciActive ? (existing.mciActivatedBy ?? user.email ?? 'koordinator') : null,
        mciSectors: body.mciSectors ?? existing.mciSectors,
        updatedAt: now,
      })
      .where(eq(events.id, id))
      .returning();

    const wsType = body.mciActive ? 'event.mci_activated' : 'event.mci_deactivated';
    broadcast({
      type: wsType,
      eventId: id,
      payload: { mciActive: body.mciActive, activatedBy: user.email ?? 'koordinator' },
      timestamp: now.toISOString(),
    });

    return { event: mapEvent(updated!) };
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
    const { id } = request.params as { id: string };

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      return reply.code(404).send({ error: 'Arrangement ikke funnet' });
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

function mapEvent(row: typeof events.$inferSelect) {
  return {
    ...row,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTeam(row: typeof teams.$inferSelect) {
  return {
    ...row,
    lastPositionUpdate: row.lastPositionUpdate?.toISOString(),
  };
}
