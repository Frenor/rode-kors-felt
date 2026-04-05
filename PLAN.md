# RKF PLAN v3.1 — English Enums, Distributed Agent Packs, and Parallel Execution

## 0. Status Board
- Lane 0 (Plan Commit Gate): `In progress`
- Lane 1 (Backend Team Workspace + Incoming Feed): `Not started`
- Lane 2 (First Aider Workspace UX/State): `Not started`
- Lane 3 (Sick Bay Clarity UX): `Not started`
- Lane 4 (Enum Migration Across Shared/API/Web): `Not started`
- Lane 5 (QA Matrix + Pages Visibility Verification): `Not started`

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
- Legacy compatibility window accepts old Norwegian AMK criticality values and normalizes to English.

## 5. Execution Order
1. Lane 0 docs commit (required gate)
2. Lane 1 backend contracts and endpoints
3. Lanes 2 and 3 in parallel (web)
4. Lane 4 enum migration and compatibility normalization
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
