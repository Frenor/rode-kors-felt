# RKF PLAN v3.1 — English Enums, Distributed Agent Packs, and Parallel Execution

## 0. Status Board
- Lane 0 (Plan Commit Gate): `Completed`
- Lane 1 (Backend Team Workspace + Incoming Feed): `In progress`
- Lane 2 (First Aider Workspace UX/State): `In progress`
- Lane 3 (Sick Bay Clarity UX): `In progress`
- Lane 4 (Enum Migration Across Shared/API/Web): `In progress`
- Lane 5 (QA Matrix + Pages Visibility Verification): `In progress`
- Lane 6 (Field Trial Remediation — production readiness): `In progress`
- Lane 7 (UX Review — field teams / sick bay / coordinator): `Done` (review, three fix passes, design system and presentation export landed; backlog in the review doc §7)
- Lane 8 (Gap review implementation — see section 13): `In progress` (batch 1 API foundation)

## 1. Summary
- Decision-complete replacement for prior sprint execution plans.
- Mandatory standard: all enums in code/API/storage are English.
- All user-facing labels remain Norwegian Bokmal via translation maps in view code.
- Execution order: commit plan artifacts first, then implementation lanes.

## 2. Locked Decisions
- Active patient lock for first aiders is local-client only.
- Relevant patients in first aider workspace include assigned + monitored.
- Unassigned patients must be visible with lower priority.
- Field status v1 includes five statuses:
  - `available`
  - `en_route`
  - `on_scene`
  - `needs_assistance`
  - `unavailable`
- Sick Bay critical incoming signal is combined rule:
  - critical when any of:
    - team status `needs_assistance`
    - active escalation exists
    - triage `immediate`
    - NEWS2 high
- Coordinator "Krever handling" banner (2026-09-23): only red patients (red triage without a
  team, NEWS2 rising fast) and patrols asking for assistance. Yellow/green patients without a
  team are counted, not alarmed — until they have waited too long (lane 8 item 8.20: yellow
  > 10 min, green > 30 min without a team enter the banner as "Venter for lenge").

## 3. API and Interface Additions
- `POST /api/teams/:teamId/actions`
- `GET /api/teams/:teamId/workspace`
- `GET /api/events/:eventId/sickbay-incoming`
- New action types:
  - `team.status_set`
  - `team.monitor_started`
  - `team.monitor_stopped`

## 4. Enum Policy
- Shared types, DB enums, API payloads, WebSocket payloads, and fixtures use English enums only.
- View layer translates enum values to Norwegian Bokmal labels.

## 5. Execution Order
1. Lane 0 docs commit (required gate)
2. Lane 1 backend contracts and endpoints
3. Lanes 2 and 3 in parallel (web)
4. Lane 4 english-only enum standardization and label mapping
5. Lane 5 tests, pages verification, and acceptance checks

## 6. Acceptance Gates
- Event-scope violations return 403 for new endpoints.
- Team action ingestion is append-only and idempotent via `clientActionId`.
- First aider reload resumes original active patient from local persisted state.
- Sick Bay displays critical incoming block with readable quick vitals.
- No raw enum values are shown in UI.
- Axe critical/serious violations: zero in new flows.

## 7. References
- `docs/sprints/v3.1/README.md`
- `docs/sprints/v3.1/00-locked-decisions.md`
- `docs/sprints/v3.1/10-enum-language-policy.md`
- `docs/sprints/v3.1/20-sickbay-flow-spec.md`
- `docs/sprints/v3.1/30-firstaider-workspace-spec.md`
- `docs/sprints/v3.1/40-api-contracts.md`
- `docs/sprints/v3.1/50-offline-sync-rules.md`
- `docs/sprints/v3.1/60-agent-pack-index.md`
- `docs/sprints/v3.1/task-cards.md`

## 8. Checkpoint Log (Active Resume Source)
- `gap review` (branch `claude/sickbay-ux-review-x6ihme`, 2026-09-23, docs only)
  - `docs/design/gap-review-2026-09.md`: missing functionality and flows that do not match the
    users' mental models, checked against the code. Headline: field hand-over to the sick bay
    sets `discharged` (A1, P0); no re-triage outside the coordinator; "Trenger bistand" carries no
    reason; assignments are silent on the phone; no shared patient number; tent is online-only;
    no 113/transport from the field; no journal export or deletion; no event set-up UI.
- `ux review pass 3` (branch `claude/sickbay-ux-review-x6ihme`, 2026-09-23)
  - Remaining review backlog closed: X6 (one status strip, no permanent sync band), F12, F13
    (`latestVitals` in the team workspace; NEWS2 pill + "Sist kl." line on the field card), F14
    (vitals/notes offline-queued as `patient.vitals_record` / `patient.note_add`, replayed against
    the patient endpoints), S8 (announce only new critical patients), S9 (patrol · engagement on
    incoming cards, live via `team.session_changed`), C8 ("Avklart" with inline confirm, "Melding"),
    C9 (coordinator compose to all / one patrol; `fromLabel` on `team.message`; patrols filter
    `toTeamId`).
  - Fresh findings T1–T6 (review doc §6): Ring 113 row + 2 × 2 grid, "Rediger detaljer"
    disclosure, quiet map caption, stats grid 6/3/2, phone header label, directed messages.
  - Section 12 rows 16 and 17 are now fixed.
- `calmer palette + red-only banner` (branch `claude/sickbay-ux-review-x6ihme`, 2026-09-23)
  - Product decision recorded in section 2: the coordinator banner triggers only on red patients
    or assistance requests; `AttentionQueuePanel` filters accordingly and counts the rest quietly.
  - Tone: `ink` button variant for card-level next steps (Start behandling, Lagre vitale tegn,
    claim), filled brand red at most once per view, "Ring 113" soft, critical panels keep a red
    edge on a white ground (no tinted backgrounds or rings), 1 px borders, 600 weight, 4 px stripes,
    `xl` 64 px. Sick bay group rules neutral with a status-coloured dot.
- `design-system pass` (branch `claude/sickbay-ux-review-x6ihme`, 2026-09-23, after the UX review)
  - Plan: `docs/design/design-system-2026-09.md` — colour roles (brand = one primary per
    container, critical = help/danger/overdue only), type roles (Sans for words, Mono for data),
    shape (triage stripe, critical ring, groups are not cards), component vocabulary.
  - `apps/web/src/components/ui/` — `Button` (variants primary/secondary/danger/danger-soft/
    outline/ghost/tone; sizes xl/lg/md/sm in CSS so inline styles cannot undercut the glove
    minimum; pressed/hover/selected states), `Pill`, `Icon` (24 px stroke set replacing emoji).
    `styles/components.css` holds the classes; `.card--stripe`, `.card--critical`, `.disclosure`,
    `.field`, `.section-label`, `.data`.
  - All three screens migrated. Tests: names kept (icons are `aria-hidden`); the "+ Ny pasient"
    references became "Ny pasient" (the plus is an icon); `PatientCard.focus` clicks by
    accessible name instead of the old "✎ Plassering" text.
- `ux review + fixes` (branch `claude/sickbay-ux-review-x6ihme`, 2026-09-23)
  - Review: `docs/design/ux-review-2026-09.md` — findings per persona (field team in the dark,
    busy sick bay, coordinator prioritising), severity, status and ordered backlog.
  - Cross-cutting: type floor raised (`--text-xs` 10 → 12 px, `--text-sm` 12.8 → 14 px); theme-aware
    triage/engagement tokens (light + dark) replace hard-coded pastel hex in five files; theme
    choice persisted (`rkf-theme`, applied before first paint) with a 44 px labelled toggle.
  - First aider: sticky team header no longer slides under the app header; 48 px colour-coded
    status pill; "Trenger bistand" is a separate red 64 px option in the status sheet and a
    persistent banner with one-tap stand-down; "Meld pasient" moved to the top; expanded card
    leads with the three 56 px engagement buttons, summary/position edits behind one disclosure;
    56 px claim button with distance + bearing (`lib/geo.ts`, radians bug fixed); close reasons as
    chips; chat unread badge + vibration; "Andre lags pasienter" replaces the duplicated list.
  - Sick bay: per-card "Neste vurdering kl. … / Forfalt for …" from latest vitals + NEWS2 interval
    (`lib/observation.ts`), overdue/continuous sort first and a header summary; visible
    "Start behandling" for incoming; live NEWS2 preview in the shared vitals form; intake requires
    name or complaint; name/complaint wrap; 44 px editor pills; locked action copy.
  - Coordinator: new `AttentionQueuePanel` (teams needing assistance, unassigned patients by
    triage/age with inline "Tildel lag", deterioration alerts with patient label) replaces the
    deterioration panel; inline assign + "Ikke tildelt" badge + relative age in patient rows;
    map engine/3D behind "Kartinnstillinger"; single-column layout under 960 px.
  - Tests: new unit tests (observation, geo, theme, AttentionQueuePanel, VitalsEntryForm,
    PatientCard observation, PatientIntakeModal); `pages-demo`, `local-full` and
    `coordinator-flow` e2e updated for the map settings disclosure, engagement buttons, close
    reason chips, theme toggle, primary sick bay action and NEWS2 preview.
- `field-trial remediation` (branch `claude/field-trial-feedback-wqhy41`, 2026-09-23)
  - Root causes reconstructed from code after the field trial was judged not production-ready
    (no GitHub issues existed to work from; findings are listed in section 12).
  - API: `POST /api/events/:id/patients` opened to `first_aider`/`sickbay` (the "Meld pasient"
    button returned 403 outside demo mode); team workspace drops discharged/transferred patients;
    `GET /api/events/:id` teams carry `operationalStatus`/`statusNote`/`statusUpdatedAt`.
  - Web auth: transparent access-token refresh (single-flight, proactive near expiry, retry on 401,
    loud logout with "Økten din utløp" when the refresh token is rejected); field-role sessions persist
    in localStorage so the PWA survives background kills; coordinator/admin stay session-only.
  - Web realtime: websocket store guards against stale-socket callbacks (reconnect used to null the
    live socket and silently drop position/chat sends); `send()` reports delivery; offline team queue
    flushes on startup and coalesces overlapping flushes.
  - First aider: lists stay live on `patient.created/updated`, refetch on reconnect/online/visibility,
    closed patients disappear, "Avslutt pasient" closes on the server and clears engagement,
    own-team status/engagement events reconcile across devices, stale team id resets to the picker,
    "Bytt patrulje", triage+label on unassigned cards, toasts confirm saves, chat refuses to fake
    delivery while offline, GPS via `watchPosition` with freshness/accuracy shown, new
    "Hvor er pasienten?" field (position text no longer a raw coordinate pair).
  - Sick bay: refetch on patient/team events + reconnect/visibility; field label/description/triage
    shown instead of "Ukjent pasient".
  - Coordinator: new `TeamStatusPanel` (needs-assistance pinned, urgent toast + vibration), live
    `team.status_changed`/`team.transport_changed`, refetch on reconnect/visibility, GPS fallback in
    patient rows.
  - E2E: `pages-demo` asserted the removed "Meld hendelse" button (Demo E2E was red on `main`);
    now covers the report-patient flow and the team status panel. `local-full` reports a patient
    against the real API and verifies it reaches sick bay and coordinator.
  - Build/CI: API is bundled with esbuild (`dist/server.js` starts, load-test gate passes locally);
    Dockerfiles use `pnpm deploy` for a self-contained runtime; GitHub Actions pinned to commit SHAs
    with Dependabot; Semgrep runs from the official container; nginx WebSocket proxy only forwards
    `Upgrade: websocket`; GCE smoke workflow fails fast or skips with a notice.
  - Toolchain: pnpm 9.15.4 → 10.34.5 everywhere (packageManager, CI, Dockerfiles); pnpm-workspace.yaml
    enables `minimumReleaseAge`, `trustPolicy: no-downgrade`, `blockExoticSubdeps` and allow-lists
    esbuild/@swc/core build scripts; `pnpm deploy --legacy` keeps the Docker runtime layout.
    `trustPolicy` refused pino 9.14.0 (published without provenance) — pinned to attested 9.13.1 via
    `overrides`; three legacy transitive versions (slow-redact, rollup 2.x, semver 6.x) are listed in
    `trustPolicyExclude` with rationale. Frozen installs never hit trust checks; `pnpm deploy` does.
- `(pending commit)` `docs(ai): compact ai instruction files for lower token usage`
  - Centralized shared AI operating rules in `docs/ai/COMPACT-PLAYBOOK.md`.
  - Rewrote `AGENTS.md` and `CLAUDE.md` to compact pointer-based versions.
  - Compressed all specialist prompts in `prompts/agents/*.md` to minimal role briefs.
  - Added mandatory `pages-demo` e2e update gate for user-visible web flow changes across playbook + agent overlays.
  - Goal: lower prompt/token overhead while preserving execution guardrails.
- `52f3a81` `feat(web): add sickbay chair-bed placement capture and incoming assignment`
  - Sykestue kan registrere plassering (stol/seng + nummer) ved pasientinntak.
  - Plassering vises tydelig i pasientkort og i kollapsede «closed»-rader.
  - «Kritisk innkommende»-panelet støtter hurtig tildeling av plassering før pasienten tas inn.
  - Dashboard-tester oppdatert med dekning for synlighet og innkommende hurtig-tildeling.
- `f1beac5` `feat(api): add patient sickbay placement fields and validation`
  - API og DB utvidet med `placementType` (`chair|bed`) og `placementNumber`.
  - Streng validering: stol/seng + nummer må oppgis sammen.
  - `PATCH /api/patients/:id` støtter både oppdatering og eksplisitt tømming av plassering.
  - API-tester utvidet for persistens, validering og clearing av plassering.
- `8615e04` `refactor(web): remove unused legacy incident api methods`
  - Removed legacy incident methods from web API client and demo store (`updateIncident`, `escalateIncident`, `resolveEscalation`).
  - Web now uses action endpoints as the single incident mutation path.
- `ed627fb` `refactor(api): remove legacy incident compatibility endpoints`
  - Removed `PATCH /api/incidents/:id` and legacy `/api/incidents/:id/escalate` routes.
  - Incident mutations now go through `POST /api/incidents/:id/actions` only.
  - Updated API tests to target action-based escalation/status flow.
- `225ef82` `chore(cleanup): drop legacy enum normalizations`
  - Removed legacy enum acceptance tests and helper behavior from web enum handling.
- `5aafcc8` `refactor(types): drop legacy amk normalization`
  - Shared types now enforce canonical AMK criticality values only.
- `8891f01` `refactor(api): remove legacy compatibility layers`
  - API AMK pipeline no longer normalizes legacy criticality aliases.
- `601e8ee` `chore(docs): drop enum compatibility language`
  - v3.1 docs and plan language updated to canonical-only enum policy.
- `057d999` `feat(web): capture patient demographics and show derived age`
  - Sick Bay intake now supports `fullName`, `gender`, and `birthDate`.
  - Derived age is shown in patient cards, collapsed closed rows, and SBAR/AMK headers.
  - Demo dataset and dashboard tests updated for demographics flow.
- `3a83405` `feat(api): add patient demographics and age derivation`
  - API/DB now stores patient `fullName` and `birthDate` (with `gender` normalization).
  - Patient responses include computed `ageYears`.
  - Added backend tests for valid/invalid birth date and demographic persistence.
- `fbc9e77` `feat(web): surface NEWS2 parameter details for first-aider handover`
  - Added richer live NEWS2 detail cards in first-aider incident flow.
  - Added MIST-step recap of recorded NEWS2 parameters for handover speed.
  - Added deterministic NEWS2 test coverage improvements in IncidentForm tests.
- `301d17d` `feat(web): show live NEWS2 preview in first-aider vitals and MIST`
  - Live NEWS2 preview in vitals step and mirrored preview in MIST step.
- `43e29d9` `feat(web): show live team message stream in coordinator dashboard`
  - Coordinator can view intra-team message stream for current event.
- `0b49dd4` `test(web): verify incident manual position override and indoor location context`
  - Regression tests for incident position override and indoor context payload.
- `af573b4` `feat(web): allow first-aider teams to adjust incident position before submit`
  - Team can manually set incident coordinates before submit.

## 9. Current Focus (September 23, 2026 — post field trial)
- Production readiness after the field trial:
  - the P0 defects in section 12 are fixed on this branch; next is a second supervised field run.
  - remaining known gaps (not blocking, tracked in section 12): chat history is not persisted.
- UX review follow-up (see `docs/design/ux-review-2026-09.md`, section 7 for the ordered backlog):
  - done: three fix passes, design system v1.3, presentation export (`docs/design/showcase/`).
  - next: the ordered list in `docs/design/gap-review-2026-09.md` (A1 first); then server-side
    de-duplication of replayed field vitals/notes; move `components/ui` into `@rkf/ui` once that
    package gets React types.

## 9a. Previous Focus (April 5, 2026)
- First Aider efficiency uplift:
  - live NEWS2 support is now implemented and expanded.
  - next: improve workspace continuity and active-patient recovery UX.
- Sick Bay clarity:
  - grouped status + visibility work is ongoing.
  - patient demographics capture + age display is now implemented in core Sick Bay flows.
  - placement support is now implemented across intake, overview, and incoming flow.
  - next: continue tightening progression readability and action hierarchy under load.
- Quality and deployment confidence:
  - keep per-feature tests incremental.
  - keep Pages preview visibility checks active for new UI blocks.

## 10. Next Self-Contained Commit Queue
0. `security(api+web): production hardening sweep for findings 1-8`
  - Scope:
    - Secure JWT signing/verification and refresh-token validation.
    - Replace plaintext password verification with secure hash verification.
    - Tighten event access guards and enforce role guards on sensitive routes.
    - Bind WS connections to token context and enforce per-event broadcast isolation.
    - Register API rate limiting.
    - Remove client token persistence from localStorage and remove token in WS query URL.
  - Validation:
    - API typecheck + targeted auth/ws/event-scope tests.
    - Web typecheck + auth/ws client tests.
  - Rollout:
    - Commit A: auth + role/scope + rate-limit (API)
    - Commit B: websocket isolation (API+Web handshake)
    - Commit C: token persistence hardening + tests (Web)
1. `feat(web): add first-aider resume card and explicit local-save sync banner`
  - Scope: first-aider dashboard/workspace only.
  - Test: web unit/integration for resume + sync states.
2. `feat(web): harden sickbay progression timeline and critical quick-vitals row`
  - Scope: sickbay dashboard components only.
  - Test: component tests for grouping/collapse/progression markers.
3. `feat(api): expose team workspace aggregate for assigned/monitored/unassigned`
  - Scope: API endpoints + service layer only.
  - Test: integration tests with event scope + idempotency.
4. `refactor(types): finish english enum normalization and remove non-canonical branches`
  - Scope: shared types + API parsers + web label mappings.
  - Test: parser and rendering tests with canonical enum values only.
5. `test(e2e): verify first-aider resume and sickbay critical visibility in pages-demo`
  - Scope: Playwright only.
  - Test: `local-full`, `pages-demo`, and read-safe smoke assertions.

## 11. Interruption Recovery Protocol
1. Open this file first: `PLAN.md`.
2. Start from `Checkpoint Log`, identify latest commit and unfinished queue item.
3. Continue with exactly one queue item per commit.
4. Run scoped tests for that queue item before commit.
5. Update `Checkpoint Log` and `Status Board` in the same working session.

## 12. Field Trial Findings (reconstructed from code, 2026-09-23)
Legend: `P0` blocks field use, `P1` degrades the flow, `P2` polish. Status refers to this branch.

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | P0 | "Meld pasient" hit `POST /events/:id/patients`, which was coordinator/admin only → 403 for every first aider outside demo mode. | Fixed |
| 2 | P0 | Access tokens expire after 15 min; the REST client never refreshed → every save failed with "prøv igjen" until re-login. | Fixed |
| 3 | P0 | Auth in sessionStorage → login lost when the PWA was killed in the background or the maps app was opened. | Fixed (field roles persist) |
| 4 | P0 | Websocket reconnect nulled the live socket → GPS position and chat silently stopped after any reconnect/token refresh. | Fixed |
| 5 | P0 | "Trenger bistand" was invisible to the coordinator (no team status view, `team.status_changed` unhandled). | Fixed (TeamStatusPanel) |
| 6 | P1 | New unassigned patients never appeared for patrols; closed patients never disappeared; no refetch after reconnect/foreground. | Fixed |
| 7 | P1 | Sick bay never saw new field patients without a reload; field patients rendered as "Ukjent pasient". | Fixed |
| 8 | P1 | Patient reports used the GPS fix from app start (one-shot `getCurrentPosition`) and stored raw coordinates as position text. | Fixed |
| 9 | P1 | "Avslutt pasient" was local-only; coordinator/sick bay still saw the patient, and it came back after reload. | Fixed |
| 10 | P1 | Two phones in one patrol drifted apart (optimistic local status always won). | Fixed (reconciliation) |
| 11 | P1 | Offline queue only flushed on online/reconnect events, never on startup; overlapping flushes replayed items twice. | Fixed |
| 12 | P1 | Stale persisted team id showed "Ukjent lag" with no way to re-pick; no "Bytt patrulje". | Fixed |
| 13 | P1 | Demo E2E on `main` asserted the removed "Meld hendelse" button. | Fixed |
| 14 | P2 | No confirmation after saving vitals/notes/summary; chat pretended to send while offline. | Fixed (toasts, delivery check) |
| 15 | P2 | Team chat history is lost on reload (realtime only). | Open |
| 16 | P2 | Field vitals/notes are not offline-queued (only team actions are); the offline banner over-promises. | Fixed (queued and replayed; toast says "lagret lokalt") |
| 17 | P2 | Coordinator cannot set/clear a team's status (e.g. acknowledge "Trenger bistand"). | Fixed ("Avklart" with inline confirm; "Melding" to one patrol) |
| 18 | P0 | Production API could not start: `tsc` output imported `@rkf/shared-types` TypeScript source → `ERR_MODULE_NOT_FOUND`. Broke the API Docker image and the scheduled load-test gate ("Wait for API health"). | Fixed (esbuild bundle) |
| 19 | P0 | API Docker image copied pnpm symlinks without the store → broken `node_modules`; both Dockerfiles ran husky in `pnpm install`. | Fixed (`pnpm deploy`, `HUSKY=0`, `.dockerignore`) |
| 20 | P1 | CI Security Scan red on `main`: nginx H2C-smuggling pattern in the WebSocket proxy, 44 unpinned (mutable) action tags, archived `returntocorp/semgrep-action`. | Fixed (map-based upgrade allow-list, SHA pins + Dependabot, official Semgrep container) |
| 21 | P1 | Scheduled GCE production smoke hung 15 min / failed daily because deploys are paused and the target is unset or unreachable. | Fixed (fails fast, skips with a notice when unconfigured) |
| 22 | P2 | Load test still targeted the removed `/api/incidents` endpoint and ignored non-2xx responses. | Fixed |
| 23 | P2 | Semgrep supply-chain rules want `minimumReleaseAge`/`trustPolicy`/`blockExoticSubdeps`, which need pnpm 10. | Fixed (workspace upgraded to pnpm 10.34.5; settings enabled) |


## 13. Lane 8 — Gap Review Implementation Plan (from `docs/design/gap-review-2026-09.md`)

Status board for this lane lives here; the review has the rationale. Execution model: one
foundation batch on the API (sequential), then UI batches in parallel by ownership area, each
integrated, verified (lint, typecheck, unit, e2e) and committed centrally. Cheaper agents do the
building from the specs below; the specs are the contract.

### 13.0 Rules for every item
- English enums in code, API, DB and payloads; Norwegian Bokmål labels in view code only.
- Schema changes: `schema.ts` + idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in
  `apps/api/src/db/migrate.ts` + `shared-types` zod + `apps/web/src/lib/types.ts` + demo store
  parity (`apps/web/src/lib/demo-store.ts`) in the same change.
- UI uses `components/ui` (`Button`, `Pill`, `Icon`); no raw `<button>` with inline sizes; 44 px
  minimum, 48–56 px in the field; one filled brand-red control per view; critical red only for
  help/danger/overdue and only as edge or text.
- Fail loud: no silent fallbacks; a queued or degraded state is shown ("lagret lokalt").
- Every item ships with unit tests; a user-visible web flow change updates
  `apps/web/e2e/pages-demo.spec.ts` (demo data must support it) or records a no-impact note here.
- Testids: kebab-case, prefixed by area (`firstaid-`, `sickbay-`, `attention-`, `team-status-`).
- Do not widen scope; one logical change per commit; the integrator commits.

### 13.1 Batch 1 — API and data foundation (sequential; unblocks everything below)

**8.1 Hand-over model (gap A1, P0)**
- Data: `patients.handed_over_at TIMESTAMPTZ NULL`, `patients.handed_over_by_team_id UUID NULL`
  (FK teams, on delete set null), `patients.field_outcome VARCHAR(32) NULL` with values
  `handed_to_sickbay | handed_to_ambulance | treated_on_scene | false_alarm | disappeared`.
- API: `PATCH /patients/:id` accepts `handedOverAt` (ISO or null), `handedOverByTeamId`
  (uuid or null, must belong to the event) and `fieldOutcome` (enum or null); they appear in
  `changedFields` and in every patient payload (`mapPatient`, workspace, sickbay-incoming).
- Workspace (`GET /teams/:id/workspace`): a patient with `handedOverAt` set leaves every field
  bucket, like a closed patient (it is in the tent now).
- Sickbay-incoming: unchanged except the new fields pass through.
- Types: `SickBayPatient`, `FieldPatient`, `TeamWorkspacePatient`, `SickbayIncomingItem` gain
  `handedOverAt?: string | null`, `handedOverByTeamId?: string | null`, `fieldOutcome?: FieldOutcome | null`.
- Demo store: `updatePatient` accepts the three fields; `getTeamWorkspace` applies the bucket rule.
- Tests: `apps/api/src/__tests__/patients.test.ts` (patch accepts/validates, workspace excludes),
  web `api.test.ts` or demo-store coverage for the bucket rule.
- Acceptance: PATCH with `fieldOutcome: 'handed_to_sickbay'` + `handedOverAt` keeps `status`
  as is; the patient is absent from the team's workspace; broadcast carries the fields.

**8.2 Shared patient number (gap A5, P1)**
- Data: `patients.seq INTEGER NULL` + unique index `(event_id, seq)`; `events.patient_counter
  INTEGER NOT NULL DEFAULT 0`. Migration backfills `seq` per event in `created_at` order and
  sets `patient_counter` to the max.
- API: both create paths (`POST /events/:id/patients`, `POST /patients`) allocate atomically:
  `UPDATE events SET patient_counter = patient_counter + 1 WHERE id = $1 RETURNING
  patient_counter` inside the insert transaction. `seq` is in every patient payload.
- Types: `seq?: number | null` on all patient shapes. Demo store: seed 1–5, counter 5, new
  patients get the next number.
- Web helper: `lib/patient-number.ts` → `patientNumber(p) => \`#${p.seq}\`` (or `null` when
  unknown) plus `PatientNumberPill` in `components/ui` (mono, neutral).
- Tests: API allocation is sequential per event and unique under two concurrent inserts (use
  `Promise.all`); helper unit test.
- Acceptance: a field report and a sick bay intake in the same event get consecutive numbers.

**8.3 AMK notified (gap B2 data half, P1)**
- Data: `patients.amk_notified_at TIMESTAMPTZ NULL`, `patients.amk_notified_by VARCHAR(100) NULL`.
- API: `POST /patients/:id/actions` accepts `{ type: 'amk.notified', by?: string }` → sets the
  columns, writes an action event `amk.notified`, broadcasts `patient.updated` with
  `changedFields: ['amkNotifiedAt']`. Idempotent: a second call keeps the first time.
  `{ type: 'amk.cleared' }` clears it (mistakes happen). Both roles `first_aider`, `sickbay`,
  `coordinator`, `admin`.
- Web: `api.executePatientAction` union widened; demo store parity; types gain
  `amkNotifiedAt?`, `amkNotifiedBy?`.
- Tests: API action test; demo store test.

**8.4 Assistance reason (gap A3, P1)** — no API change: `team.status_set` already accepts `note`.
**8.5 Assignment acknowledgement (gap A4, P1)** — no API change: `team.patient_status_set`
with `en_route_to_patient` is the acknowledgement; the coordinator derives "bekreftet".

### 13.2 Batch 2 — UI by ownership area (parallel; each agent owns its files)

**Field agent** — owns `apps/web/src/pages/FirstAiderDashboard.tsx`, `pages/FirstAider/*`,
`lib/constants.ts` (close reasons only), their tests. May add small helpers in `lib/`.
- 8.6 (A1) Close flow → outcomes. Reason `handed_to_sickbay`: PATCH `{ fieldOutcome,
  handedOverAt: now, handedOverByTeamId: team, assignedTeamId: null }` + note
  "Overlevert sykestue av Alpha" + clear engagement; **status unchanged**. `handed_to_ambulance`:
  PATCH `{ fieldOutcome, status: 'transferred' }` + note. `treated_on_scene`, `false_alarm`,
  `disappeared`: PATCH `{ fieldOutcome, status: 'discharged' }` + note. The "Avsluttede" list
  shows the outcome label. Toast per outcome ("Overlevert sykestue", not "Pasient avsluttet").
- 8.7 (A3) After "Trenger bistand" in the status sheet: a second step "Hva trenger dere?" with
  four 56 px chips `more_hands | transport | amk_notified | other` (labels: Flere hender,
  Transport, AMK er varslet, Annet) + optional text; sent as `note` (English key + free text,
  e.g. `transport: båre til km 12`). Skippable ("Send uten detaljer"). The banner under the
  team header repeats the choice.
- 8.8 (A10) "Utildelte pasienter" sorted by distance from the phone (`lib/geo.ts`
  `distanceMeters`, `describeOffset`); each card shows "≈ 1,2 km NØ"; unknown positions last.
- 8.9 (B2) On red/yellow own-patient cards: "Ring 113" (`tel:113`, `danger-soft`, lg) and
  "AMK er varslet" (`secondary`, sends `amk.notified`); once set, a pill "AMK varslet kl. 11:40"
  replaces the button with a small "angre" (`amk.cleared`).
- 8.10 (A2) Triage chips (grønn/gul/rød/svart) inside "Rediger sammendrag / posisjon";
  saving PATCHes `triageStatus` and adds a note "Triage endret gul → rød".
- 8.11 (A4) When `patient.updated` arrives with `assignedTeamId === selectedTeam` for a patient
  not previously assigned: vibrate `[200, 100, 200, 100, 200]`, show a persistent card under
  the team header "Koordinator har tildelt dere: #12 Bevisstløs person ved løypebok" with
  "Vi drar" (sends `en_route_to_patient`, dismisses) and "Kan ikke" (sends a `team.message` to
  the coordinator "Alpha kan ikke ta #12" and dismisses). Persists across reload until acted on
  (localStorage keyed by patient id).
- 8.12 (B10) Directed coordinator messages (`toTeamId === selectedTeam`) get a "Mottatt" button;
  it sends `team.message` `{ ackOf: <message id>, text: 'Mottatt' }`; acknowledged messages show
  a check.
- 8.13 (A5) Patient number pill on every row and in the report/close toasts.
- e2e: `pages-demo.spec.ts` field section: close with "Overlevert sykestue" keeps the patient
  visible to the sick bay; assistance reason chips visible; number pill present.

**Sick bay agent** — owns `apps/web/src/pages/SickBayDashboard.tsx`, `pages/SickBay/*`, their tests.
- 8.14 (A9) Split "Innkommende" into two stacks in the same column: *På vei* (incoming patients
  with an active patrol engagement `en_route_to_patient | transporting`, showing the patrol and,
  when team position is known, "≈ 800 m unna") above *Venter i teltet* (all other incoming).
  Team positions: fetch `api.getEvent(eventId).teams` on load and apply `team.position` WS
  updates (new subscription in the dashboard; small).
- 8.15 (A1) Card line "Overlevert av Alpha kl. 11:52" when `handedOverAt` is set (team name
  from the event's teams), placed with the engagement line.
- 8.16 (A2) Triage chips in "Rediger detaljer" (new editor toggle "Triage"); PATCH
  `triageStatus` + note "Triage endret".
- 8.17 (B2) "AMK varslet kl." pill on the card and in the critical panel when
  `amkNotifiedAt` is set; the AMK brief modal's "Lagre AMK-logg" also sends `amk.notified`.
- 8.18 (A5) Number pill on cards, critical rows and the intake success toast.
- e2e: demo intake gets a number; Delta/Alpha "På vei" stack visible.

**Coordinator agent** — owns `apps/web/src/pages/CoordinatorDashboard.tsx`, `pages/Coordinator/*`,
`components/EventMap.tsx`, their tests.
- 8.19 (A5) Number pill on queue rows, patient rows and map markers (`#12` replaces `P<index>`);
  the "Tildel lag" toast says "#12 tildelt Bravo".
- 8.20 (A6) Time-based escalation in `AttentionQueuePanel`: yellow without a team > 10 min or
  green > 30 min enters the banner in a third group "Venter for lenge" with the age; thresholds
  as constants `ATTENTION_WAIT_MINUTES = { yellow: 10, green: 30 }`. The red-only decision in
  section 2 stands; this adds time as the second trigger (record it in section 2).
- 8.21 (A4) Queue and patient rows show acknowledgement state for assigned patients: "Bekreftet
  av Alpha kl. 11:41" when an engagement `en_route_to_patient | transporting` by the assigned team
  exists (from `teamPatientEngagements`), else "Ikke bekreftet · 2 min" in warning once older
  than 2 minutes; older than 5 minutes enters "Krever handling".
- 8.22 (A1) Patient rows show "I sykestua" (info pill) instead of "Ikke tildelt" when
  `handedOverAt` is set; the queue's "uten lag" groups exclude handed-over patients.
- 8.23 (B4) Team row action "Send til" → small inline form: sector text or "velg på kartet"
  (reuses the map pick mode) → sends `team.sector_assigned` over the socket (payload
  `{ teamId, sector, assignedBy: 'coordinator' }`); the row shows the sector until changed.
- 8.24 (B10) The message stream shows "Mottatt av Alpha kl." under a directed message when an
  `ackOf` message arrives; unacknowledged directed messages older than 3 min show "Ikke kvittert".
- 8.25 (B2) "AMK varslet" pill on queue and patient rows.
- e2e: `local-full.spec.ts` coordinator section: number pill visible; `coordinator-flow.spec.ts`
  unchanged.

### 13.3 Batch 3 — larger items (after batch 2 is integrated)
- 8.26 (B3) Transport request: patient actions `transport.requested` `{ need: 'stretcher' |
  'atv' | 'ambulance', pickupText }` and `transport.assigned` `{ teamId }`; columns
  `transport_need`, `transport_requested_at`, `transport_team_id`; field button "Be om
  transport" (sheet with the three needs); queue group "Transport" with an assign select of
  vehicle-capable teams (`transport in ('vehicle','atv')` first); the patrol sees "Delta (ATV)
  på vei"; the sick bay sees the need on the card.
- 8.27 (B1) Sick bay offline: reuse `offline-firstaid-queue` pattern for `recordVitals`,
  `addPatientNote`, `executePatientAction`, `updatePatient` from the sick bay; a pending count
  in `SickBayHeader`; "lagret lokalt" toasts; replay on reconnect; no server dedup yet (note).
- 8.28 (A8) Quick log "Behandlet på stedet": one sheet from the field header (secondary
  button next to Meld pasient): green preselected, complaint chips (gnagsår, kutt, forstuing,
  hodepine, annet), age group, optional note → creates with `fieldOutcome: 'treated_on_scene'`
  and `status: 'discharged'` in one call (`POST /events/:id/patients` accepts both fields).
- 8.29 (B9) Chat history: table `team_messages` (id, event_id, from_team_id, from_label,
  to_team_id, text, ack_of, sent_at); the WS handler persists; `GET /events/:id/messages?limit=100`;
  clients load it on connect.
- 8.30 (B6) Sick bay capacity: `events.settings JSONB` `{ sickbay: { chairs: 16, beds: 4 } }`;
  occupancy strip in `SickBayHeader`, a coordinator tile "Sykestue 12/16", free-number picker.
- 8.31 (B5) Event set-up page (`/admin/events`): create event, teams (name, transport, ISSI,
  phone), access codes per role with QR, sectors, sick bay capacity; API routes for teams and
  codes with `coordinator|admin` role.
- 8.32 (B7) Per-patient journal export: `GET /patients/:id/journal` (markdown → printable HTML
  page in the web app, `window.print`), and `GET /events/:id/journals.zip`.
- 8.33 (B8) Retention: "Avslutt arrangement" flow (export → anonymise: null `full_name`,
  `birth_date`, `gender`, free text notes hashed out; keep counts, triage, timestamps) and a
  scheduled purge for events archived > 30 days; device logout clears IndexedDB queues.
- 8.34 (A7) Distance in the sick bay's "På vei" line — folded into 8.14.
- 8.35 (C2) Web Push via the service worker for assignment, directed message, needs-assistance.
- 8.36 (C1) MCI mode — decision first; spec after the season plan.
- 8.37 (C3, C4, C5) People per team; voice notes; archive the stale ideation doc.

### 13.4 Order and status
| Step | Items | Status |
|---|---|---|
| Batch 1 | 8.1, 8.2, 8.3 | `In progress` |
| Batch 2 field | 8.6–8.13 | `Pending` |
| Batch 2 sick bay | 8.14–8.18 | `Pending` |
| Batch 2 coordinator | 8.19–8.25 | `Pending` |
| Batch 3 | 8.26–8.37 | `Pending` |
