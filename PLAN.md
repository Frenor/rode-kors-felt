# RKF PLAN v2.1 — Decision-Complete Execution Plan (Sections B-F)

## 0. Status Board
- Section A: `Done`
- Section B: `Done`
- Section C: `Done`
- Section D: `Done`
- Section E: `Done`
- Section F: `Done`

## 0.1 Status Evidence Snapshot (April 4, 2026)
- Section B (`Done`):
  - five anonymized persona interview runs captured with concrete scenario timings and outcomes
  - KPI baseline capture populated (`kpi-baseline-2026-04-04.md`) with explicit calculation method and values
  - no field-user `P0` blockers recorded in baseline interview pack
- Section C (`Done`):
  - API and UI flow implemented (`/amk-calls`, `Ring 113`, AMK modal, timeline rows)
  - API tests passed locally with Postgres (`patients/events/incidents`)
  - local-full E2E coverage is green
- Section D (`Done`):
  - draft/confirm endpoints and append-only persistence implemented
  - UI draft/edit/confirm path implemented
  - provider adapter + deterministic fallback + provenance metadata implemented
  - API tests for safety/isolation/provenance passed locally
- Section E (`Done`):
  - additive `locationContext` and indoor/map endpoints implemented
  - web consumes dedicated indoor/map endpoints
  - MapLibre runtime loading is hardened (runtime loader + Leaflet fallback)
  - custom raster layer config is consumed in both MapLibre and Leaflet paths
  - 3D toggle is verified in MapLibre mode
- Section F (`Done`):
  - Playwright project matrix + workflows + prod mutation guard implemented
  - `local-full` includes 113 + AI + AMK log chain and payload assertion (green)
  - `pages-demo` checks pass against deployed GitHub Pages URL
  - CI emits scoped HTML reports/traces per target with robust artifact upload behavior

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
- `5.5` MIST pre-fill from START triage — `Done` (April 4, 2026)
  - `apps/web/src/pages/IncidentForm.tsx`: triage-driven MIST signs prefill, editable signs chips, non-overwrite guard for user edits
  - `apps/web/src/__tests__/IncidentForm.test.tsx`: prefill + untouched-change + edited-non-override coverage
- `6.2` Terraform completion — `Done` (April 4, 2026)
  - `infra/terraform/environments/dev/main.tf`: opt-in ECS service + ALB/ACM wiring with explicit dependency/validation contracts
  - `infra/terraform/environments/dev/README.md`: enablement checklist for full service path
- `6.5` Load testing p95/throughput — `Done` (April 4, 2026)
  - `apps/api/src/load/run.ts`: non-destructive autocannon scenarios with threshold gating and auth-scenario requirement toggle
  - `apps/api/src/load/thresholds.ts` + `thresholds.test.ts`: deterministic threshold evaluation and assertions
  - `apps/api/LOAD_TESTING.md`: execution and env-contract docs

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
