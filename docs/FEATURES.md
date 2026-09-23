# Feature register

One place for what the product does, what has been verified and how, what is waiting to be
verified, and what was removed. Update it in the same commit as the feature: when it lands
(→ *To test*), when it is verified (→ *Tested*, with the evidence), when it is taken out
(→ *Removed*, with the reason). `PLAN.md` says what is being built and in which order; this file
says what exists.

**Evidence codes:** `unit` = vitest in `apps/web/src/__tests__` or `apps/api/src/__tests__` ·
`e2e-local` = Playwright `local-full` against the real API and Postgres ·
`e2e-demo` = Playwright `pages-demo` against the demo build ·
`field` = supervised field trial (date) · `manual` = captured and checked by hand (date).

---

## To test

Built or being built; verification still owed. Move a row down when it has evidence.

| Feature | Area | Build status | Verification owed | Ref |
|---|---|---|---|---|
| Hand-over model: `handedOverAt`, `handedOverByTeamId`, `fieldOutcome`; workspace drops handed-over patients | API | In build (lane 8, 8.1) | API unit (PATCH validation, workspace bucket), demo parity unit | PLAN §13.1 |
| Per-event patient number `seq` with atomic allocation; `#12` helper | API + web | In build (8.2) | API unit (sequential, concurrent inserts unique), helper unit | PLAN §13.1 |
| AMK notified / cleared patient actions | API | In build (8.3) | API unit (idempotent set, clear, broadcast) | PLAN §13.1 |
| Field close flow → outcomes (hand-over keeps the patient open) | Field | Planned (8.6) | unit, e2e-demo (hand-over keeps the patient visible to the sick bay) | gap A1 |
| Assistance reason chips after "Trenger bistand" | Field | Planned (8.7) | unit, e2e-demo | gap A3 |
| Unassigned patients sorted by distance with "≈ 1,2 km NØ" | Field | Planned (8.8) | unit (sorting), manual | gap A10 |
| "Ring 113" and "AMK er varslet" on red/yellow field cards | Field | Planned (8.9) | unit, e2e-demo | gap B2 |
| Triage chips in the field summary editor and sick bay "Rediger detaljer" | Field, Sick bay | Planned (8.10, 8.16) | unit | gap A2 |
| Assignment banner with "Vi drar" acknowledgement; coordinator sees "Bekreftet av" | Field, Coordinator | Planned (8.11, 8.21) | unit both sides, e2e-local | gap A4 |
| "Mottatt" on directed messages; coordinator sees the receipt | Field, Coordinator | Planned (8.12, 8.24) | unit | gap B10 |
| Patient number pill on every card, row, marker and toast | All | Planned (8.13, 8.18, 8.19) | unit, e2e-demo | gap A5 |
| "På vei" / "Venter i teltet" split with distance | Sick bay | Planned (8.14) | unit, e2e-demo | gap A9, A7 |
| "Overlevert av Alpha kl." on the sick bay card | Sick bay | Planned (8.15) | unit | gap A1 |
| "AMK varslet kl." pill in all three views | All | Planned (8.17, 8.25) | unit | gap B2 |
| Time-based escalation "Venter for lenge" (yellow > 10 min, green > 30 min) | Coordinator | Planned (8.20) | unit | gap A6 |
| "I sykestua" badge; queue excludes handed-over patients | Coordinator | Planned (8.22) | unit | gap A1 |
| Dispatch a team to a sector or map position | Coordinator | Planned (8.23) | unit, e2e-local | gap B4 |
| Transport request (stretcher / ATV / ambulance) end to end | Field, Coordinator, Sick bay | Planned (8.26) | API unit, unit, e2e-local | gap B3 |
| Sick bay offline queue for vitals, notes, status, edits | Sick bay | Planned (8.27) | unit (queue, replay), manual offline | gap B1 |
| Quick log "Behandlet på stedet" | Field | Planned (8.28) | unit, e2e-demo | gap A8 |
| Persisted chat history, loaded on connect | API, Field, Coordinator | Planned (8.29) | API unit, e2e-local | gap B9 |
| Sick bay capacity and occupancy | Sick bay, Coordinator | Planned (8.30) | unit | gap B6 |
| Event set-up page: event, teams, codes with QR, sectors | Coordinator | Planned (8.31) | API unit, e2e-local | gap B5 |
| Per-patient journal export and event export | Sick bay, API | Planned (8.32) | API unit, manual print | gap B7 |
| Retention: end-of-event anonymisation, scheduled purge, device clear on logout | API, all | Planned (8.33) | API unit, manual | gap B8 |
| Web Push for assignment, directed message, needs-assistance | Field | Planned (8.35) | manual on device | gap C2 |
| People per team; voice notes; archive the stale ideation doc | Field | Planned (8.36) | unit, manual | gap C3–C5 |
| Second supervised field run after the lane 7 fixes | All | Waiting for a date | field | PLAN §9 |
| Production smoke against a deployed environment (`gce-prod-smoke`) | Ops | Needs `PLAYWRIGHT_GCE_BASE_URL` | e2e | CLAUDE.md |

---

## Tested

| Feature | Area | Evidence | Last verified |
|---|---|---|---|
| Six-digit code login, event binding, team pick, "Bytt patrulje" | Field | `e2e-local`, `e2e-demo`, `unit` (CodeEntryPage, session) | 2026-09-23 |
| "Meld pasient": triage, GPS position with text fallback, description; lands with sick bay and coordinator | Field → all | `e2e-local`, `e2e-demo` | 2026-09-23 |
| Engagement statuses (På vei / Transporterer / Overvåker) with two-phone reconciliation | Field | `e2e-demo`, `field` (2026-09 trial finding 10), `unit` (useOfflineTeamSync) | 2026-09-23 |
| Close patient with reason chips and optional text | Field | `e2e-demo`, `unit` | 2026-09-23 |
| Team status sheet with "Trenger bistand" separated; needs-assistance banner; coordinator sees it | Field, Coordinator | `e2e-local`, `unit` (TeamStatusPanel, AttentionQueuePanel), `manual` | 2026-09-23 |
| Vitals entry with live NEWS2 preview and missing-parameter hint (shared field/sick bay) | Field, Sick bay | `unit` (VitalsEntryForm, news2), `e2e-demo` | 2026-09-23 |
| Last vitals + NEWS2 on the field card | Field | `unit` (LastVitalsLine) | 2026-09-23 |
| Offline queue: team actions, vitals and notes queued and replayed; startup flush; no double replay | Field | `unit` (offline-firstaid-queue, useOfflineTeamSync, api.offline) | 2026-09-23 |
| Team chat with unread badge and vibration; directed messages only to the addressed patrol | Field | `unit` (ws.store), `manual` | 2026-09-23 |
| Distance and bearing to the patient, "Naviger hit" | Field | `unit` (geo) | 2026-09-23 |
| Team position broadcast and coordinator map markers | Field, Coordinator | `unit` (useGeolocation, EventMap.runtime), `field` (trial finding 4) | 2026-09-23 |
| Theme choice persisted and applied before first paint | All | `unit` (theme), `e2e-demo` | 2026-09-23 |
| Dark-mode contrast of clinical tokens ≥ 7:1 | All | `unit` (tokens.dark-contrast) | 2026-09-23 |
| Intake with validation (name or complaint required), placement, demographics, age | Sick bay | `unit` (PatientIntakeModal, SickBayDashboard.status), `e2e-demo` | 2026-09-23 |
| Status transitions with locked copy; primary "Start behandling"; undo toast | Sick bay | `unit` (SickBayDashboard.status, PatientCard.observation), `e2e-demo` | 2026-09-23 |
| Next observation due, overdue and continuous states, urgency sort, header counts | Sick bay | `unit` (observation, PatientCard.observation) | 2026-09-23 |
| Critical incoming panel; announces only new arrivals; placement inline | Sick bay | `unit` (IncomingCriticalPanel, SickBayDashboard.status) | 2026-09-23 |
| Which patrol is bringing a patient ("Alpha · Transporterer"), live | Sick bay | `unit`, `e2e-demo` | 2026-09-23 |
| Ring 113 → AMK brief with AI draft, script confirm, structured log | Sick bay | `e2e-local`, `e2e-demo`, `unit` | 2026-09-23 |
| Medications, notes, history timeline, demographics/complaint/placement editors behind "Rediger detaljer" | Sick bay | `unit` (SickBayDashboard.status, PatientCard.focus) | 2026-09-23 |
| Discharge / transfer with SBAR modal | Sick bay | `unit` (SickBayDashboard.status) | 2026-09-23 |
| Live updates without reload (patient created/updated, vitals, team status, engagements) | Sick bay | `unit` (SickBayDashboard.status live updates) | 2026-09-23 |
| Coordinator login, dashboard, redirect when unauthenticated | Coordinator | `e2e-local` (coordinator-flow) | 2026-09-23 |
| "Krever handling": red patients without a team, patrols asking for help, NEWS2 alerts; inline assign | Coordinator | `unit` (AttentionQueuePanel), `e2e-demo` | 2026-09-23 |
| Stand a patrol down with inline confirm; message one patrol or all | Coordinator | `unit` (AttentionQueuePanel, TeamStatusPanel, TeamMessageStreamPanel), `e2e-demo`, `e2e-local` | 2026-09-23 |
| Patient list with unassigned badge, relative age, inline assign, close (false alarm / disappeared), map pick | Coordinator | `unit` (PatientManagementPanel), `e2e-local` | 2026-09-23 |
| Map: Leaflet, MapLibre with fallback, 3D toggle, settings disclosure, indoor layout | Coordinator | `unit` (EventMap.maplibre, EventMap.runtime), `e2e-demo`, `e2e-local` | 2026-09-23 |
| Stats counters with trend; debrief report download | Coordinator | `manual` | 2026-09-23 |
| Auth: login, code redemption, refresh, rate limits; event-scope 403s | API | `unit` (api tests, session) | 2026-09-23 |
| Patients, vitals (append-only), notes, medications, AMK call logs, actions with undo | API | `unit` (patients.test) | 2026-09-23 |
| Team actions with client-id de-duplication; derived team status; workspace buckets | API | `unit` (teams.test, actions.test) | 2026-09-23 |
| WebSocket heartbeat, reconnect with backoff, token refresh | API, web | `unit` (ws.store, session) | 2026-09-23 |
| Load test gate (p95 targets) | API | CI workflow | 2026-09-23 |
| Presentation export (`showcase:export`) | Tooling | `manual` (opened from file, no console errors) | 2026-09-23 |

---

## Removed

| Feature | Removed | Why | Record |
|---|---|---|---|
| Incidents ("Hendelse"): `/api/incidents`, incident form, Hendelser tab, escalations | 2026 (before the field trial) | Patients are the unit of work; a separate incident object duplicated them and confused patrols | `docs/removed-features/HENDELSE_MCI.md` |
| Mass casualty mode (MCI): event flags, sectors, activation, summary export | 2026; decided out of scope for good 2026-09-23 | Not needed for the events the tool serves; a per-patient tool with triage colours covers what patrols do; the last code remnants (demo store, event columns) are removed with lane 8 batch 1 | `docs/removed-features/HENDELSE_MCI.md` |
| Bottom tab bar on the field dashboard (Pasienter / Hendelser / Lag / Chat) | PR #51 | Single scroll with "Meld pasient" at the top beat four tabs for gloved use; the ideation doc that describes the tabs is historical | `docs/design/ideation-ui-2026.md` (stale) |
| "Meld hendelse" button and the demo e2e assertion for it | with incidents | see Incidents | PLAN §12 row 13 |
| `DeteriorationAlertsPanel` | lane 7 | Folded into "Krever handling" (`AttentionQueuePanel`) | `docs/design/ux-review-2026-09.md` C1, C4 |
| Emoji and dingbat icons (⚙ 📍 ☀ ☾ ▲ ✓ ✕) | lane 7 | Replaced by the `Icon` component | ux review X5 |
| Permanent "Synkronisert" band and separate WebSocket banner | lane 7, pass 3 | One status strip only while degraded | ux review X6 |
| "Kartmotor" caption above the map | lane 7, pass 3 | Engine lives in "Kartinnstillinger" | ux review T3 |
| Load-test target `/api/incidents` | 2026-09 | Endpoint gone | PLAN §12 row 22 |
