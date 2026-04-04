# RKF PLAN v2.1 — Decision-Complete Execution Plan (Sections B-F)

## 0. Status Board
- Section A: `Done`
- Section B: `In progress`
- Section C: `Done`
- Section D: `Done`
- Section E: `In review`
- Section F: `In review`

## 0.1 Status Evidence Snapshot (April 4, 2026)
- Section B (`In progress`):
  - persona, playbook, KPI, scoring-sheet, blocker-log, and interview record scaffolds exist
  - interview files are template/scaffold level and still need real run data
- Section C (`Done`):
  - API and UI flow implemented (`/amk-calls`, `Ring 113`, AMK modal, timeline rows)
  - API tests passed locally with Postgres (`patients/events/incidents`)
  - local-full E2E coverage is green
- Section D (`Done`):
  - draft/confirm endpoints and append-only persistence implemented
  - UI draft/edit/confirm path implemented
  - provider adapter + deterministic fallback + provenance metadata implemented
  - API tests for safety/isolation/provenance passed locally
- Section E (`In review`):
  - additive `locationContext` and indoor/map endpoints implemented
  - web now consumes dedicated indoor/map endpoints
  - MapLibre runtime path + Leaflet fallback + 3D behavior implemented
  - remaining hardening: production runtime loading of MapLibre global and deployment verification
- Section F (`In review`):
  - Playwright project matrix + workflows + prod mutation guard implemented
  - local-full now includes 113 + AI + AMK log chain and payload assertion (green)
  - pages-demo suite runs locally (green)
  - CI now emits HTML Playwright reports + artifacts
  - remaining hardening: run and verify artifact completeness in CI for pages-demo/gce-prod-smoke

## 1. Goal and Priority Order
- Goal: deliver safer and faster emergency operations for indoor events, custom maps, and Sick Bay 113 handover flow.
- Priority order for conflicts:
  1. Safety
  2. Offline behavior
  3. Accessibility
  4. GDPR
  5. Performance
  6. DX

## 2. Locked Decisions (April 4, 2026)
- Indoor reporting defaults to zone + floor; GPS is fallback.
- Map stack is MapLibre-first for coordinator path; legacy map path remains fallback during migration.
- Custom map layers are infra/env configured in v1 (no in-app admin).
- E2E targets are `local-full`, `pages-demo`, `gce-prod-smoke`.
- Sick Bay 113 flow is patient-centered with structured AMK log and AI decision support.
- AI is recommendation-only. Human confirmation required before persistence.
- Clinical artifacts remain append-only.

## 3. Carryover from Removed TODO.md
- `5.5` MIST pre-fill from START triage
- `6.2` Terraform completion
- `6.5` Load testing p95/throughput
- `6.6` Remove temporary commitlint ignores after CI is green and merge is complete

## 4. Parallel Execution Model
- Lane 1 (Product/UX/QA): Section B
- Lane 2 (Web/API): Section C
- Lane 3 (API/Web): Section D (starts once C contracts exist)
- Lane 4 (Web/API/Infra): Section E
- Lane 5 (QA/DevOps): Section F (starts once C/D/E stable)
- Integration checkpoints:
  - CP1: C contract freeze
  - CP2: D contract freeze
  - CP3: E contract freeze
  - CP4: F matrix green per target
- Task-card execution pack:
  - `docs/sprints/v2.1/task-cards.md`

## 5. Required API and Type Additions
- `Incident.locationContext?`
- `GET /api/events/:id/indoor-layout`
- `GET /api/events/:id/map-config`
- `POST /api/patients/:id/amk-calls`
- `GET /api/patients/:id/amk-calls`
- `POST /api/patients/:id/amk-assist/draft`
- `POST /api/patients/:id/amk-assist/confirm`
- New `action_events.actionType` values:
  - `patient.amk_call_logged`
  - `patient.amk_ai_draft_generated`
  - `patient.amk_ai_script_confirmed`

## 6. Section B (Persona + Interview System)
- Spec file: `docs/sprints/v2.1/section-b-personas.md`
- Playbook: `docs/sprints/v2.1/section-b-interview-playbook.md`
- KPI template: `docs/sprints/v2.1/section-b-kpi-template.md`
- Exit criteria:
  - exactly five personas
  - executable playbook and rubric
  - baseline KPI capture template populated with 2026-04-04 decisions

## 7. Section C (Sick Bay 113 Workflow)
- Spec file: `docs/sprints/v2.1/section-c-amk-workflow.md`
- Exit criteria:
  - `Ring 113` available on patient card
  - AMK brief with fixed section ordering
  - append-only AMK call logging works
  - dedicated timeline row type for AMK entries

## 8. Section D (AI Assist for 113/Handover)
- Spec file: `docs/sprints/v2.1/section-d-ai-assist.md`
- Exit criteria:
  - draft and confirm endpoints implemented
  - fallback deterministic output when AI provider unavailable
  - UI requires explicit confirmation
  - draft and confirmation are both audit-visible append-only artifacts

## 9. Section E (Indoor + Custom Map)
- Spec file: `docs/sprints/v2.1/section-e-indoor-map.md`
- Exit criteria:
  - indoor context submission via zone/floor without GPS dependence
  - map-config and indoor-layout endpoints return event-scoped data
  - coordinator map has MapLibre path with 3D toggle and fallback path

## 10. Section F (Deployed E2E Matrix)
- Spec file: `docs/sprints/v2.1/section-f-e2e-matrix.md`
- Exit criteria:
  - three Playwright targets independently runnable
  - prod smoke mutation guard enforced (`POST|PATCH|PUT|DELETE` blocked)
  - artifacts uploaded on failure for all targets

## 11. KPI and Acceptance Gates
- KPI events captured:
  - time-to-AMK-brief-ready
  - report submission duration
  - correction-edit count
  - indoor location clarity rate
- Acceptance gates:
  - no regression in status transitions
  - no regression in SBAR behavior
  - accessibility checks for new modal/form controls
  - event isolation preserved on all new APIs

## 12. Assumptions
- Existing `location { lat, lng }` remains mandatory for compatibility.
- `locationContext` is additive and optional.
- All user-facing text remains Norwegian Bokmal.
- GCE prod smoke remains read-safe by both policy and technical guard.
