# RKF — Development TODO

> Track sprint progress here. Check off tasks as they are completed.
> Full plan with rationale in [`docs/sprints/improvement-plan.md`](docs/sprints/improvement-plan.md).
>
> Priority order: life-safety first. Do not reorder sprints without team discussion.

---

## Sprint 1 — Persistent Database
> **Goal:** Replace in-memory store with PostgreSQL + Drizzle ORM. No data lost on restart.

- [x] 1.1 Drizzle schema definitions — `apps/api/src/db/schema.ts`
- [x] 1.2 Migration setup + seed script — `drizzle.config.ts`, `pnpm db:migrate`
- [x] 1.3 Replace in-memory store in all API routes
- [x] 1.4 Connection pool + `{ db: "ok" }` in `/health`
- [x] 1.5 Docker Compose persistent volume + auto-migrate on API startup

---

## Sprint 2 — Real-time Reliability
> **Goal:** Coordinators never silently lose real-time updates.

- [x] 2.1 WebSocket heartbeat on server (30s ping, 10s timeout)
- [x] 2.2 Client reconnection with exponential backoff (1→2→4→8→30s cap)
- [x] 2.3 Connection status banner in AppShell (amber = reconnecting, red = offline)
- [x] 2.4 Offline sync queue auto-flush on reconnect
- [x] 2.5 WebSocket auth token refresh on 401

---

## Sprint 3 — Clinical Intelligence
> **Goal:** Detect patient deterioration earlier. Structured handovers. Medication tracking.

- [x] 3.1 NEWS2 trend detection — `calculateNEWS2Trend()` in `shared-types/src/news2.ts`
- [x] 3.2 Deterioration alert in Sick Bay UI + vibration API
- [x] 3.3 SBAR chip form — required before patient status → `transferred`
- [x] 3.4 Medication administration log (schema + `POST /patients/:id/medications` + UI)
- [x] 3.5 "Kritiske pasienter" deterioration panel in coordinator dashboard

---

## Sprint 4 — Mass Casualty Incident (MCI) Mode
> **Goal:** Handle multi-patient incidents with START triage and sector coordination.

- [x] 4.1 MCI mode activation — `PATCH /events/:id/mci`, WebSocket broadcast to all clients
- [x] 4.2 START triage tag selector on incidents (Umiddelbar/Utsatt/Mindre/Forventet)
- [x] 4.3 MCI overview panel — live triage counts + color-coded map overlay
- [x] 4.4 Resource allocation board — teams × sectors grid
- [x] 4.5 MCI deactivation + downloadable handover summary

---

## Sprint 5 — Field Efficiency
> **Goal:** Faster to scene, better field communication.

- [x] 5.1 "Naviger hit" button — opens native maps app at incident coordinates
- [x] 5.2 Voice-to-text for incident notes (Web Speech API, `nb-NO`)
- [x] 5.3 Team-to-team direct messaging via WebSocket
- [x] 5.4 ETA calculator on coordinator dispatch panel (Haversine + transport mode speed)
- [ ] 5.5 MIST chip pre-fill from START triage tag in MCI mode

---

## Sprint 6 — Reporting & Production
> **Goal:** Learn from incidents. Deploy to production AWS.

- [x] 6.1 Post-event debrief report — `GET /events/:id/report` + Markdown narrative + "⬇ Rapport" button
- [ ] 6.2 Complete Terraform modules — ECS Fargate, RDS Multi-AZ, ElastiCache, ALB + ACM
- [x] 6.3 GitHub Actions production deploy pipeline with rollback (.github/workflows/deploy.yml)
- [x] 6.4 Request tracing — X-Request-Id correlation + structured latency logs via Fastify hooks
- [ ] 6.5 Load test — p95 incident create < 200ms, 60 GPS updates/s sustained
- [ ] 6.6 Remove temporary commitlint ignores added for legacy PR commit subjects after CI is green and this branch is merged

---

## Quick Reference

```
pnpm dev          # start web (3000) + API (4000)
pnpm test         # vitest unit tests
pnpm test:e2e     # playwright e2e
pnpm typecheck    # tsc strict
pnpm lint         # eslint + prettier
pnpm db:migrate   # run drizzle migrations (Sprint 1+)
```

**Branch convention:** `feature/fe-XX-description` or `feature/be-XX-description`

**Commit convention:** `feat(web):`, `fix(api):`, `a11y(ui):`, `docs:`, `infra:`
