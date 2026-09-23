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
| Web Push for assignment, directed message, needs-assistance | Field | Deferred (8.35): needs VAPID keys and a push service | manual on device | gap C2 |
| People per team | Field | Deferred (8.36): after a field run shows the need | — | gap C3 |
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
| Hand-over model on patients (`handedOverAt`, `handedOverByTeamId`, `fieldOutcome`); handed-over patients leave the field workspace; PATCH with `status` keeps the other fields | API | `unit` (patients.test: validation, payload, workspace exclusion), demo parity `unit` (demo-store.test) | 2026-09-23 |
| Per-event patient number `seq`, allocated atomically on both create paths; `patientNumber()` helper | API, web | `unit` (patients.test: sequential + 5 concurrent inserts unique; patient-number.test) | 2026-09-23 |
| AMK notified / cleared patient actions, idempotent, audited | API | `unit` (actions.test) | 2026-09-23 |
| Patients, vitals (append-only), notes, medications, AMK call logs, actions with undo | API | `unit` (patients.test) | 2026-09-23 |
| Team actions with client-id de-duplication; derived team status; workspace buckets | API | `unit` (teams.test, actions.test) | 2026-09-23 |
| WebSocket heartbeat, reconnect with backoff, token refresh | API, web | `unit` (ws.store, session) | 2026-09-23 |
| Load test gate (p95 targets) | API | CI workflow | 2026-09-23 |
| Presentation export (`showcase:export`) | Tooling | `manual` (opened from file, no console errors) | 2026-09-23 |
| Transport request: patrol asks (båre / ATV / ambulanse), coordinator assigns a vehicle team from the queue, patrol and tent see who is coming | Field, Coordinator, Sick bay | `unit` (API transport.test; TransportRequestSheet, AttentionQueuePanel.transport, PatientCard.transport), `e2e-demo` | 2026-09-23 |
| Sick bay offline queue: vitals, notes, status changes and edits queue without network, replay on reconnect, header shows pending and failed counts | Sick bay | `unit` (offline-sickbay-queue, useOfflineSickbaySync, SickBayHeader) | 2026-09-23 |
| Quick log "Behandlet på stedet": one sheet creates and closes a minor case | Field | `unit` (QuickLogSheet, API quick-log.test), `e2e-demo` | 2026-09-23 |
| Chat history persisted on the server and loaded on connect in the field and at the desk | API, Field, Coordinator | `unit` (API messages.test; team-message-history, teamMessages) | 2026-09-23 |
| Sick bay capacity: settings per event, occupancy strip in the tent, "Sykestue" tile at the desk, free-number picks when placing | Sick bay, Coordinator | `unit` (sickbay-occupancy, SickBayHeader, StatsGrid.sickbay, API events.test), `e2e-demo` | 2026-09-23 |
| Event set-up page: event details, teams (add, edit, deactivate), access codes with QR and revoke, capacity | Coordinator, API | `unit` (EventSetupPage, TeamsSetupPanel, AccessCodesPanel, API events/teams tests), `e2e-demo` | 2026-09-23 |
| Per-patient printable journal (`/sickbay/journal/:id`) and one-file export of all journals | Sick bay, Coordinator, API | `unit` (PatientJournalPage, journalExport, API journal.test), `e2e-demo` | 2026-09-23 |
| Retention: archive card (export → confirm → anonymise), 30-day anonymisation job, logout clears device queues | API, Coordinator, all | `unit` (API retention.test, ArchiveEventCard, AppShell.logout) | 2026-09-23 |
| Voice note button (Web Speech API, nb-NO) where the browser supports it | Field | `unit` (VoiceNoteButton) | 2026-09-23 |
| Close reasons map to outcomes; "Overlevert sykestue" keeps the patient open and clears the patrol | Field | `unit` (close-outcome, FirstAider tests), `e2e-demo` | 2026-09-23 |
| "Trenger bistand" asks what is needed (flere hender / transport / AMK / annet) and sends it as the status note | Field | `unit` (AssistanceReasonStep), `e2e-demo` | 2026-09-23 |
| Unassigned patients sorted by distance from the phone, with offset text | Field | `unit` (geo sortByDistance), `manual` | 2026-09-23 |
| "Ring 113" and "AMK er varslet" / undo on red and yellow field cards | Field | `unit`, `e2e-demo` | 2026-09-23 |
| Re-triage from the field summary editor and from the sick bay's "Rediger detaljer", with a note | Field, Sick bay | `unit` (TriageChips, PatientCard.triage) | 2026-09-23 |
| Assignment banner with vibration, "Vi drar" / "Kan ikke", persisted; coordinator shows "Bekreftet av" / "Ikke bekreftet" and escalates after 5 min | Field, Coordinator | `unit` (AssignmentBanner, pending-assignments, PatientManagementPanel, AttentionQueuePanel) | 2026-09-23 |
| "Mottatt" receipts on directed messages; coordinator sees "Mottatt av" and "Ikke kvittert" | Field, Coordinator | `unit` (TeamChatSection, TeamMessageStreamPanel) | 2026-09-23 |
| Shared patient number `#12` on every card, row, map marker and toast | All | `unit` (EventMap.patientNumbers, PatientCard, panels), `e2e-demo`, `e2e-local` | 2026-09-23 |
| "På vei" / "Venter i teltet" stacks in Innkommende, with live distance to the patrol | Sick bay | `unit` (SickBayDashboard.stacks, FieldEngagementLine), `e2e-demo` | 2026-09-23 |
| "Overlevert av Alpha kl." on the sick bay card | Sick bay | `unit` (PatientCard.handover) | 2026-09-23 |
| "AMK varslet kl." pill in all three views; the AMK brief records it | All | `unit` (PatientCard.amk, panels) | 2026-09-23 |
| "Venter for lenge": yellow > 10 min or green > 30 min without a team enter the queue | Coordinator | `unit` (AttentionQueuePanel) | 2026-09-23 |
| "I sykestua" badge; the queue ignores patients already in the tent | Coordinator | `unit` (PatientManagementPanel, AttentionQueuePanel) | 2026-09-23 |
| "Send til": dispatch a patrol to a sector or place; the patrol sees the sector badge | Coordinator, Field | `unit` (TeamStatusPanel), `e2e-demo` | 2026-09-23 |

---

## Removed

| Feature | Removed | Why | Record |
|---|---|---|---|
| Incidents ("Hendelse"): `/api/incidents`, incident form, Hendelser tab, escalations | 2026 (before the field trial) | Patients are the unit of work; a separate incident object duplicated them and confused patrols | `docs/removed-features/HENDELSE_MCI.md` |
| Mass casualty mode (MCI): event flags, sectors, activation, summary export | 2026; decided out of scope for good 2026-09-23 | Not needed for the events the tool serves; a per-patient tool with triage colours covers what patrols do; code remnants (demo store toggles, event columns) removed 2026-09-23 | `docs/removed-features/HENDELSE_MCI.md` |
| Bottom tab bar on the field dashboard (Pasienter / Hendelser / Lag / Chat) | PR #51 | Single scroll with "Meld pasient" at the top beat four tabs for gloved use | `docs/design/ideation-ui-2026.md` (marked historical) |
| "Meld hendelse" button and the demo e2e assertion for it | with incidents | see Incidents | PLAN §12 row 13 |
| `DeteriorationAlertsPanel` | lane 7 | Folded into "Krever handling" (`AttentionQueuePanel`) | `docs/design/ux-review-2026-09.md` C1, C4 |
| Emoji and dingbat icons (⚙ 📍 ☀ ☾ ▲ ✓ ✕) | lane 7 | Replaced by the `Icon` component | ux review X5 |
| Permanent "Synkronisert" band and separate WebSocket banner | lane 7, pass 3 | One status strip only while degraded | ux review X6 |
| "Kartmotor" caption above the map | lane 7, pass 3 | Engine lives in "Kartinnstillinger" | ux review T3 |
| Load-test target `/api/incidents` | 2026-09 | Endpoint gone | PLAN §12 row 22 |
