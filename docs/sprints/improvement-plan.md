# RKF — Improvement Sprint Plan

## Context

Rødt Kors Felt (RKF) is a Norwegian Red Cross event medical PWA used by field first aiders,
sick bay staff, and coordinators during large public events. It is an offline-first, real-time
system with three role-based UIs, NEWS2 clinical scoring, MIST chip forms, and Claude-powered
triage assessment. The system handles real incidents where delayed or lost data directly
impacts patient outcomes.

This plan addresses the most impactful gaps, ordered strictly by **life-safety risk and
operational efficiency**. Six 2-week sprints, each with a clear goal and definition of done.

---

## Sprint Overview

| # | Name | Goal | Primary Beneficiaries |
|---|------|------|-----------------------|
| 1 | Persistent Database | Eliminate data-loss risk from server restart | All roles |
| 2 | Real-time Reliability | Ensure coordinators never miss critical updates | Coordinator |
| 3 | Clinical Intelligence | Detect patient deterioration earlier | Sick Bay, Coordinator |
| 4 | Mass Casualty Mode | Handle multi-patient incidents safely | All roles |
| 5 | Field Efficiency | Get first aiders to incidents faster | First Aider |
| 6 | Reporting & Production | Enable learning + production deployment | Operations |

---

## Sprint 1 — Persistent Database
**Goal:** Replace in-memory store with PostgreSQL + Drizzle ORM so no data is lost on server restart.

**Why:** Server restarts during a live event currently wipe ALL incidents, patients, and vitals.
This is the single greatest life-safety risk in the codebase.

### Tasks

**1.1 — Drizzle schema definitions**
- File: `rkf/apps/api/src/db/schema.ts` (create)
- Define tables: `events`, `teams`, `users`, `access_codes`, `incidents`, `escalations`,
  `patients`, `vital_readings`, `patient_notes`
- All UUIDs as primary keys, `event_id` FK on every clinical table (row-level security)
- Vitals table is insert-only (no update route)

**1.2 — Migration setup**
- File: `rkf/apps/api/drizzle.config.ts`
- Generate initial migration: `pnpm drizzle-kit generate`
- Add `pnpm db:migrate` script to `package.json`
- Seed script with Holmenkollen demo data (replaces `store.ts` seeding logic)

**1.3 — Replace in-memory store in all routes**
- File: `rkf/apps/api/src/db/store.ts` → replaced by `rkf/apps/api/src/db/index.ts` (Drizzle client)
- Update: `rkf/apps/api/src/routes/incidents.ts`, `patients.ts`, `events.ts`, `auth.ts`, `ws.ts`
- All queries use `db.select().from(table).where(eq(table.eventId, eventId))`
- Preserve `clientId` deduplication logic (now via `ON CONFLICT DO NOTHING`)

**1.4 — Connection pool + health check**
- File: `rkf/apps/api/src/server.ts`
- Add `postgres` connection pool (node-postgres)
- Extend `GET /health` to include DB connectivity status
- Graceful shutdown: drain pool before exit

**1.5 — Docker Compose update**
- File: `rkf/docker-compose.yml`
- Ensure `postgres` service has persistent volume
- Run migrations as part of API startup (`db:migrate` before `start`)

### Definition of Done
- `pnpm dev` starts against real PostgreSQL with migrated schema
- All existing Vitest API tests pass against DB (not mock)
- Server restart mid-test does not lose seeded data
- `GET /health` returns `{ db: "ok" }`

---

## Sprint 2 — Real-time Reliability
**Goal:** Ensure coordinators never silently lose real-time updates; WebSocket reconnects
automatically and UI clearly signals connection state.

**Why:** If a WebSocket drops and the coordinator doesn't notice, they make decisions on stale
incident data. A silently-stale map has directly caused delayed dispatch in field exercises.

### Tasks

**2.1 — WebSocket heartbeat (server)**
- File: `rkf/apps/api/src/routes/ws.ts`
- Ping clients every 30s; close connection if no pong within 10s
- Track `lastPongAt` per connection; clean up stale sockets

**2.2 — Client reconnection with backoff**
- File: `rkf/apps/web/src/stores/ws.ts`
- Reconnect on close with exponential backoff: 1s → 2s → 4s → 8s → 30s cap
- On reconnect: re-fetch all incidents + patients (stale data reconciliation)
- Expose `connectionState: 'connected' | 'reconnecting' | 'offline'`

**2.3 — Connection status indicator**
- File: `rkf/apps/web/src/components/AppShell.tsx`
- Persistent banner when `reconnecting` or `offline` (Norwegian text)
- Pulsing amber dot when reconnecting, red when offline
- ARIA live region announces state changes (screen reader support)
- Matches design tokens from `apps/web/src/styles/tokens.css`

**2.4 — Offline sync queue flush on reconnect**
- File: `rkf/apps/web/src/lib/offline-queue.ts`
- On transition `offline → connected`: automatically flush pending queue
- Show toast with count of synced items: "3 hendelser synkronisert"
- Handle 409 conflicts from server (clientId dedup) gracefully

**2.5 — WebSocket auth token refresh**
- File: `rkf/apps/web/src/stores/ws.ts`
- Detect 401 on WS connect; trigger token refresh before reconnect
- Prevents coordinators being permanently disconnected after token expiry

### Definition of Done
- Kill API server mid-session → client shows amber banner, reconnects within 35s, fetches fresh data
- Offline queue items created while disconnected sync automatically on reconnect
- All new UI passes axe-core accessibility check

---

## Sprint 3 — Clinical Intelligence
**Goal:** Alert clinicians to patient deterioration trends, add structured SBAR handovers,
and track medication administration.

**Why:** A NEWS2 score of 4 is concerning, but a score rising 4→5→6 over 90 minutes is
a medical emergency. Trend detection saves lives that threshold detection misses.

### Tasks

**3.1 — NEWS2 trend detection**
- File: `rkf/packages/shared-types/src/news2.ts`
- Add `calculateNEWS2Trend(readings: VitalReading[]): News2Trend` function
- Returns: `{ direction: 'rising' | 'stable' | 'falling', deltaScore: number, ratePerHour: number }`
- "Rising" defined as Δ ≥ 2 points in 60 min (clinical threshold per RCP guidance)

**3.2 — Deterioration alert in Sick Bay UI**
- File: `rkf/apps/web/src/pages/SickBayDashboard.tsx`
- Show trend arrow (↑↓→) next to NEWS2 badge on patient card
- Rapid rise (≥ 2 in 60 min): full-screen alert with vibration (`navigator.vibrate`)
- Alert text (Norwegian): "ADVARSEL: NEWS2 stiger raskt — umiddelbar vurdering påkrevd"
- Broadcast `patient.deterioration_alert` via WebSocket to coordinator

**3.3 — SBAR chip form (handover)**
- File: `rkf/apps/web/src/pages/SickBayDashboard.tsx`, new `SbarForm.tsx` component
- SBAR already in shared-types (`SbarForm` Zod schema exists at `index.ts:89`)
- Chip-based entry like MIST form (reuse pattern from `IncidentForm.tsx`)
- Accessible at patient handover (status → `transferred`): required before status change
- Pre-populate: Situation from presenting complaint, Assessment from latest NEWS2 score

**3.4 — Medication administration log**
- File: `rkf/packages/shared-types/src/index.ts` — add `MedicationRecord` Zod schema
- Fields: `drug` (enum: oxygen, aspirin, GTN, morphine, naloxone, glucose, adrenaline, other),
  `dose`, `route` (oral/IV/IM/inhaled/sublingual), `givenAt`, `givenBy`
- File: `rkf/apps/api/src/routes/patients.ts` — add `POST /patients/:id/medications`
- File: `rkf/apps/web/src/pages/SickBayDashboard.tsx` — medication log UI, append-only
- Medications displayed in timeline alongside vitals

**3.5 — Coordinator deterioration panel**
- File: `rkf/apps/web/src/pages/CoordinatorDashboard.tsx`
- New "Kritiske pasienter" panel: lists patients with rising NEWS2 trend
- Sorted by deterioration rate (fastest first)
- One-click to raise escalation from panel

### Definition of Done
- Vitals entered 3× with rising score triggers alert in < 2s (Vitest test)
- SBAR form blocks status change to `transferred` until all 4 fields filled
- Medication log visible in patient timeline, append-only, no edit/delete
- Coordinator sees deterioration panel update via WebSocket

---

## Sprint 4 — Mass Casualty Incident (MCI) Mode
**Goal:** Enable coordinators to activate MCI mode for multi-patient incidents, with
START triage tagging and sector-based casualty management.

**Why:** A pile-up at a ski race or crowd crush can produce 10–50 patients in minutes.
The current system has no triage tagging or MCI coordination workflow.

### Tasks

**4.1 — MCI mode activation**
- File: `rkf/packages/shared-types/src/index.ts` — add `MciMode` schema to `Event`
- Fields: `mciActive: boolean`, `mciActivatedAt`, `mciActivatedBy`, `mciSectors: string[]`
- File: `rkf/apps/api/src/routes/events.ts` — `PATCH /events/:id/mci` (coordinator only)
- WebSocket broadcast: `event.mci_activated` — all clients receive alert banner

**4.2 — START triage tagging on incidents**
- File: `rkf/packages/shared-types/src/index.ts` — add `TriageTag` enum:
  `immediate` (red), `delayed` (yellow), `minor` (green), `expectant` (black)
- Add `triageTag: TriageTag.optional()` to `Incident` schema
- File: `rkf/apps/web/src/pages/IncidentForm.tsx` — 4-button triage selector
  (color-coded, 56×56px min, visible in daylight, Norwegian labels)
- File: `rkf/apps/api/src/routes/incidents.ts` — accept `triageTag` on create/update

**4.3 — MCI overview for coordinator**
- File: `rkf/apps/web/src/pages/CoordinatorDashboard.tsx`
- MCI mode panel: triage tag counts (immediate N, delayed N, minor N, expectant N)
- Map overlay: incidents colored by triage tag (not type)
- Sector assignment: drag incident to sector on map

**4.4 — Resource allocation board**
- File: `rkf/apps/web/src/pages/CoordinatorDashboard.tsx` (new sub-panel)
- Grid: teams × sectors — coordinator assigns teams to sectors
- Visual: team avatar, transport icon, estimated distance to sector
- Broadcast: `team.sector_assigned` via WebSocket → first aider sees assignment on their dashboard

**4.5 — MCI deactivation + handover summary**
- `PATCH /events/:id/mci` with `{ mciActive: false }` deactivates
- Generates MCI summary: total by triage tag, time-to-first-response, team deployments
- Summary stored as event attachment, downloadable (print CSS for field use)

### Definition of Done
- Coordinator can activate MCI mode → all clients show MCI banner within 1s
- First aider can tag incident with START triage color in ≤ 3 taps
- Map shows color-coded triage tags, counts update in real-time
- MCI deactivation generates summary accessible from event details

---

## Sprint 5 — Field Efficiency
**Goal:** Reduce time-to-scene for first aiders and improve field communication quality.

**Why:** Every minute faster to an incident directly improves patient outcomes. Field teams
currently navigate by memory or generic maps.

### Tasks

**5.1 — Route guidance to incident**
- File: `rkf/apps/web/src/pages/FirstAiderDashboard.tsx`
- When incident is dispatched to team: "Naviger hit" button
- Uses `window.open(\`https://maps.google.com/maps?daddr=\${lat},\${lng}\`)` on mobile
  (opens native maps app without requiring extra API key)
- Fallback: display coordinates + compass bearing from current GPS position
- Works fully offline (no routing API dependency)

**5.2 — Voice-to-text for incident notes**
- File: `rkf/apps/web/src/pages/IncidentForm.tsx`
- Add mic button next to notes textarea (Web Speech API — no external dependency)
- `SpeechRecognition` in `nb-NO` locale
- Visual feedback: pulsing red dot while recording
- Graceful fallback: hide button if Speech API unavailable (`'SpeechRecognition' in window`)

**5.3 — Team-to-team direct messaging**
- File: `rkf/packages/shared-types/src/index.ts` — add `TeamMessage` Zod schema
- Fields: `id`, `eventId`, `fromTeamId`, `toTeamId` (null = broadcast), `text`, `sentAt`
- File: `rkf/apps/api/src/routes/ws.ts` — handle `team.message` WS event, broadcast to target
- File: `rkf/apps/web/src/pages/FirstAiderDashboard.tsx` — compact message thread
  (last 10 messages, send field; no persistent storage required for MVP)

**5.4 — Estimated response time on map**
- File: `rkf/apps/web/src/pages/CoordinatorDashboard.tsx`
- When selecting a team for dispatch: show ETA based on transport mode + Haversine distance
  - foot: 5 km/h, bike: 15 km/h, vehicle: 40 km/h, atv: 20 km/h
- Display: "ca. 4 min" next to team name in dispatch panel
- Pure client-side calculation (no external API)

**5.5 — MIST pre-fill from triage tags**
- File: `rkf/apps/web/src/pages/IncidentForm.tsx`
- In MCI mode: selecting triage tag pre-fills MIST "Signs" chip set
  - Immediate: "Livstruende tilstand", "Kritisk ABC"
  - Delayed: "Stabil, trenger behandling"
  - Minor: "Gående, mindre skade"
- Chips remain editable — pre-fill is a time-saving hint, not a lock

### Definition of Done
- "Naviger hit" opens native maps in < 2 taps on iOS and Android
- Voice-to-text transcribes Norwegian field phrases ("pasient bevisstløs")
- Team message appears on recipient's dashboard within 500ms (LAN conditions)
- ETA calculation matches manual calculation within ±10%

---

## Sprint 6 — Reporting & Production Readiness
**Goal:** Enable post-event learning through analytics/reporting, and complete infrastructure
for production deployment on AWS.

**Why:** Learning from incidents is how Red Cross improves future event medical responses.
Production-grade infrastructure ensures the system can be trusted at real events.

### Tasks

**6.1 — Post-event debrief report**
- File: `rkf/apps/api/src/routes/events.ts` — `GET /events/:id/report`
- Returns: total incidents by type, avg time-to-on-scene, escalation count,
  NEWS2 distribution, patient outcomes (discharged/transferred)
- File: `rkf/apps/web/src/pages/CoordinatorDashboard.tsx` — "Last ned rapport" button
- LLM-generated narrative summary using Claude API (same pattern as triage assessment)
- GDPR: report contains no PII — age groups only, no names

**6.2 — Terraform production modules**
- File: `rkf/infra/terraform/main.tf`, `ecs.tf`, `rds.tf`, `elasticache.tf`
- Complete ECS Fargate task definitions for API + web
- RDS PostgreSQL 16 with Multi-AZ in eu-central-1
- ElastiCache Redis 7 for session store
- ALB with HTTPS termination, ACM cert
- Parameter Store for secrets (JWT_SECRET, DATABASE_URL)

**6.3 — GitHub Actions production deploy**
- File: `rkf/.github/workflows/deploy-prod.yml`
- Triggered on merge to `main`
- Steps: build → push ECR → run migrations → ECS rolling deploy
- Rollback: previous task definition if health check fails

**6.4 — OpenTelemetry tracing**
- File: `rkf/apps/api/src/server.ts`
- Add `@opentelemetry/sdk-node` instrumentation
- Trace: all route handlers, DB queries, WebSocket events
- Export to CloudWatch X-Ray + Sentry error tracking
- Custom span: `news2.calculate` to track clinical decision latency

**6.5 — Load test for event-day conditions**
- File: `rkf/apps/api/src/__tests__/load.test.ts` (autocannon)
- Simulate: 50 concurrent first aiders + 5 coordinators + 3 sick bay
- Target: p95 incident create < 200ms, p95 vitals append < 100ms
- WebSocket: 60 team position updates/second sustained without dropped messages
- Gate: CI fails if p95 exceeds threshold

### Definition of Done
- `terraform plan` shows no drift on staging environment
- Production deploy completes with zero downtime (rolling update verified)
- Load test passes thresholds in CI
- Report endpoint returns in < 3s for events with 200 incidents

---

## Critical Files Reference

| File | Sprint | Change |
|------|--------|--------|
| `rkf/apps/api/src/db/store.ts` | 1 | Delete — replaced by Drizzle |
| `rkf/apps/api/src/db/schema.ts` | 1 | Create — Drizzle table definitions |
| `rkf/apps/api/src/db/index.ts` | 1 | Create — DB client + pool |
| `rkf/apps/api/src/routes/*.ts` | 1 | Update — use Drizzle queries |
| `rkf/apps/web/src/stores/ws.ts` | 2 | Reconnect logic + state |
| `rkf/apps/web/src/components/AppShell.tsx` | 2 | Connection status banner |
| `rkf/packages/shared-types/src/news2.ts` | 3 | Add trend calculation |
| `rkf/packages/shared-types/src/index.ts` | 3, 4, 5 | Add schemas for medications, MCI, messages |
| `rkf/apps/web/src/pages/SickBayDashboard.tsx` | 3 | Deterioration alerts, SBAR, meds |
| `rkf/apps/web/src/pages/CoordinatorDashboard.tsx` | 3, 4, 5, 6 | MCI, deterioration panel, ETA |
| `rkf/apps/web/src/pages/IncidentForm.tsx` | 4, 5 | Triage tag, voice input, MIST pre-fill |
| `rkf/apps/web/src/pages/FirstAiderDashboard.tsx` | 5 | Navigation, messaging |
| `rkf/infra/terraform/` | 6 | Complete production IaC |
| `rkf/.github/workflows/deploy-prod.yml` | 6 | Production CI/CD |

---

## Reusable Patterns

- **Chip-based form entry**: `IncidentForm.tsx` MIST chips — reuse for SBAR (Sprint 3), triage (Sprint 4)
- **NEWS2 scoring**: `packages/shared-types/src/news2.ts:calculateNEWS2()` — extend, don't replace
- **Offline queue**: `apps/web/src/lib/offline-queue.ts` — all new writes go through this
- **WebSocket broadcasting**: `apps/api/src/routes/ws.ts` — add new event types to existing broadcaster
- **LLM assessment**: `apps/web/src/lib/llm-triage.ts` — same pattern for report narrative
- **Design tokens**: `apps/web/src/styles/tokens.css` — use existing color tokens for new components
- **Zod schema extension**: all new domain types added to `packages/shared-types/src/index.ts`

---

## End-to-End Verification Checklist

1. **Sprint 1**: `docker compose up -d && pnpm dev` → login, create incident, restart API, incident still present
2. **Sprint 2**: Kill API → UI shows amber banner → restart API → banner clears, offline-created incidents sync
3. **Sprint 3**: Enter rising vitals 3× → alert fires → SBAR required before patient transfer
4. **Sprint 4**: Activate MCI → create incident with triage tag → coordinator map shows color-coded tags
5. **Sprint 5**: Dispatch incident to team → first aider taps "Naviger hit" → native maps opens at correct coords
6. **Sprint 6**: `terraform apply` → zero-downtime deploy → load test passes
