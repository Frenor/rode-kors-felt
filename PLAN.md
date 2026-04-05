# RKF PLAN v3.1 — English Enums, Distributed Agent Packs, and Parallel Execution

## 0. Status Board
- Lane 0 (Plan Commit Gate): `Completed`
- Lane 1 (Backend Team Workspace + Incoming Feed): `In progress`
- Lane 2 (First Aider Workspace UX/State): `In progress`
- Lane 3 (Sick Bay Clarity UX): `In progress`
- Lane 4 (Enum Migration Across Shared/API/Web): `In progress`
- Lane 5 (QA Matrix + Pages Visibility Verification): `In progress`

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

## 9. Current Focus (April 5, 2026)
- First Aider efficiency uplift:
  - live NEWS2 support is now implemented and expanded.
  - next: improve workspace continuity and active-patient recovery UX.
- Sick Bay clarity:
  - grouped status + visibility work is ongoing.
  - patient demographics capture + age display is now implemented in core Sick Bay flows.
  - next: incoming critical panel signal clarity and progression readability.
- Quality and deployment confidence:
  - keep per-feature tests incremental.
  - keep Pages preview visibility checks active for new UI blocks.

## 10. Next Self-Contained Commit Queue
1. `feat(web): add first-aider resume card and explicit local-save sync banner`
  - Scope: first-aider dashboard/workspace only.
  - Test: web unit/integration for resume + sync states.
2. `feat(web): harden sickbay progression timeline and critical quick-vitals row`
  - Scope: sickbay dashboard components only.
  - Test: component tests for grouping/collapse/progression markers.
3. `feat(api): expose team workspace aggregate for assigned/monitored/unassigned`
  - Scope: API endpoints + service layer only.
  - Test: integration tests with event scope + idempotency.
4. `refactor(types): finish english enum normalization and legacy fallback guards`
  - Scope: shared types + API parser normalization + web label mappings.
  - Test: parser and rendering normalization tests.
5. `test(e2e): verify first-aider resume and sickbay critical visibility in pages-demo`
  - Scope: Playwright only.
  - Test: `local-full`, `pages-demo`, and read-safe smoke assertions.

## 11. Interruption Recovery Protocol
1. Open this file first: `PLAN.md`.
2. Start from `Checkpoint Log`, identify latest commit and unfinished queue item.
3. Continue with exactly one queue item per commit.
4. Run scoped tests for that queue item before commit.
5. Update `Checkpoint Log` and `Status Board` in the same working session.
