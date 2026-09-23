# RKF PLAN v3.1 — English Enums, Distributed Agent Packs, and Parallel Execution

## 0. Status Board
- Lane 0 (Plan Commit Gate): `Completed`
- Lane 1 (Backend Team Workspace + Incoming Feed): `In progress`
- Lane 2 (First Aider Workspace UX/State): `In progress`
- Lane 3 (Sick Bay Clarity UX): `In progress`
- Lane 4 (Enum Migration Across Shared/API/Web): `In progress`
- Lane 5 (QA Matrix + Pages Visibility Verification): `In progress`
- Lane 6 (Field Trial Remediation — production readiness): `In progress`

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
  - remaining known gaps (not blocking, tracked in section 12): chat history is not persisted,
    vitals/notes from the field are not offline-queued, no coordinator → team status override.

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
| 16 | P2 | Field vitals/notes are not offline-queued (only team actions are); the offline banner over-promises. | Open |
| 17 | P2 | Coordinator cannot set/clear a team's status (e.g. acknowledge "Trenger bistand"). | Open |

