# RKF v2.1 Parallel Task Cards (Execution-Ready)

## Usage Rules
- Each card is self-contained and can be assigned independently.
- One card = one branch = one PR.
- Do not expand scope beyond card boundaries.
- Conflict priority: `Safety > Offline > Accessibility > GDPR > Performance > DX`.
- Required output in each PR:
  - code/docs changes
  - test evidence (command + result)
  - unresolved risks

## Lane B (Product/UX/QA) — Section B

### B1 — Add Missing Interview Artifacts
- Status: `Done`
- Owner role: `product-lead` + `qa-engineer`
- Depends on: none
- Scope:
  - add scoring sheet template
  - add blocker log template
- Files:
  - `docs/sprints/v2.1/section-b-scoring-sheet.md` (new)
  - `docs/sprints/v2.1/section-b-blocker-log.md` (new)
  - `docs/sprints/v2.1/README.md` (link both files)
- Acceptance:
  - templates have fixed fields for `usability`, `efficiency`, `accuracy`, blocker flag, owner, due date
  - QA can run without interpretation
- Validation:
  - manual doc review

### B2 — Baseline Interview Evidence Pack
- Status: `Done`
- Owner role: `field-user` + `product-lead`
- Depends on: B1
- Scope:
  - commit anonymized run results for 5 personas
  - record baseline KPI values from template
- Files:
  - `docs/sprints/v2.1/interviews/first-aider-run-01.md` (new)
  - `docs/sprints/v2.1/interviews/sickbay-run-01.md` (new)
  - `docs/sprints/v2.1/interviews/coordinator-run-01.md` (new)
  - `docs/sprints/v2.1/interviews/gis-infra-run-01.md` (new)
  - `docs/sprints/v2.1/interviews/qa-release-run-01.md` (new)
  - `docs/sprints/v2.1/interviews/kpi-baseline-2026-04-04.md` (new)
- Acceptance:
  - one run per persona exists
  - blockers have owner and due date
  - baseline KPI section populated
- Validation:
  - checklist review against `section-b-interview-playbook.md`
  - reviewed 2026-04-04 evidence pack with KPI baseline and blocker ownership/due-date present

## Lane C (Web/API) — Section C

### C1 — AMK Endpoint Isolation Hardening Tests
- Status: `Done`
- Owner role: `backend-engineer` + `qa-engineer`
- Depends on: none
- Scope:
  - add forbidden checks for event mismatch on AMK routes
  - add malformed payload cases for `/amk-calls`
- Files:
  - `apps/api/src/__tests__/patients.test.ts`
- Acceptance:
  - mismatched event user gets 403
  - invalid payload gets 400 with stable error contract
- Validation:
  - `pnpm --filter @rkf/api test -- patients.test.ts`

### C2 — Timeline Rendering Assertions for AMK Rows
- Status: `Done`
- Owner role: `frontend-engineer` + `qa-engineer`
- Depends on: none
- Scope:
  - assert AMK call entries render as dedicated history rows
  - assert no regression in existing note/status rows
- Files:
  - `apps/web/src/__tests__/SickBayDashboard.status.test.tsx`
  - `apps/web/src/pages/SickBay/PatientHistoryTimeline.tsx` (only if selector/test hooks needed)
- Acceptance:
  - AMK row type is explicitly asserted in tests
- Validation:
  - `pnpm --filter @rkf/web test -- SickBayDashboard.status.test.tsx`

## Lane D (API/Web) — Section D

### D1 — Provider Adapter with Deterministic Fallback
- Status: `Done`
- Owner role: `backend-engineer`
- Depends on: none
- Scope:
  - add AI adapter interface using `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`
  - keep deterministic fallback when config missing/provider fails
- Files:
  - `apps/api/src/routes/patients.ts`
  - `apps/api/src/lib/ai-assist.ts` (new)
  - `.env.example`
- Acceptance:
  - with env missing: fallback response stable
  - with env present: provider adapter path is used
  - endpoint contract unchanged
- Validation:
  - `pnpm --filter @rkf/api typecheck`
  - targeted API tests for both paths

### D2 — AI Artifact Provenance and Safety Tests
- Status: `Done`
- Owner role: `backend-engineer` + `qa-engineer`
- Depends on: D1
- Scope:
  - add provenance metadata to draft artifact payload (`source`, `model`, `fallbackUsed`)
  - add tests that AI never triggers status/escalation side effects
- Files:
  - `apps/api/src/routes/patients.ts`
  - `apps/api/src/__tests__/patients.test.ts`
- Acceptance:
  - artifact payload clearly indicates draft origin
  - tests fail if side-effect actions are introduced
- Validation:
  - `pnpm --filter @rkf/api test -- patients.test.ts`

## Lane E (Web/API/Infra) — Section E

### E1 — Wire Web to Event Indoor/Map Endpoints
- Status: `Done`
- Owner role: `frontend-engineer`
- Depends on: none
- Scope:
  - add web API client calls for:
    - `GET /api/events/:id/indoor-layout`
    - `GET /api/events/:id/map-config`
  - consume in incident and coordinator paths
- Files:
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/pages/IncidentForm.tsx`
  - `apps/web/src/pages/CoordinatorDashboard.tsx`
- Acceptance:
  - UI reads server-side indoor/map config instead of local assumptions
- Validation:
  - web unit tests or mocked integration tests
  - validated in `local-full` E2E coordinator and incident flows

### E2 — Real MapLibre Rendering Path + Safe Fallback
- Status: `Done`
- Owner role: `frontend-engineer` + `ux-designer`
- Depends on: E1
- Scope:
  - implement actual MapLibre render path (not just toggle label)
  - preserve Leaflet fallback when MapLibre unavailable
  - make `3D-presentasjon` affect render behavior
- Files:
  - `apps/web/src/components/EventMap.tsx`
  - `apps/web/package.json`
- Acceptance:
  - MapLibre path renders with runtime config
  - fallback path remains functional
  - 3D toggle changes map behavior in MapLibre mode
- Validation:
  - `pnpm --filter @rkf/web typecheck`
  - `pnpm --filter @rkf/web test -- src/__tests__/EventMap.maplibre.test.tsx src/__tests__/EventMap.runtime.test.tsx`
  - E2E assertions in `local-full`

### E3 — Indoor Payload Assertion E2E
- Status: `Done`
- Owner role: `qa-engineer`
- Depends on: E1
- Scope:
  - assert created incident includes correct `locationContext` for indoor mode
  - assert GPS fallback preserves lat/lng compatibility fields
- Files:
  - `apps/web/e2e/local-full.spec.ts`
- Acceptance:
  - E2E fails if `locationContext` contract regresses
- Validation:
  - `pnpm --filter @rkf/web test:e2e -- --project local-full`

## Lane F (QA/DevOps) — Section F

### F1 — Extend Local Full Chain to Include 113 + AI Confirm
- Status: `Done`
- Owner role: `qa-engineer` + `frontend-engineer`
- Depends on: C2, D2
- Scope:
  - expand `local-full` with patient AMK brief flow
  - generate AI draft, confirm script, log AMK call, verify history
- Files:
  - `apps/web/e2e/local-full.spec.ts`
- Acceptance:
  - local-full covers full chain expected by spec
- Validation:
  - `pnpm --filter @rkf/web test:e2e -- --project local-full`

### F2 — Deterministic HTML Report Artifacts in CI
- Status: `Done`
- Owner role: `devops-engineer` + `qa-engineer`
- Depends on: none
- Scope:
  - ensure Playwright generates HTML report in CI
  - ensure artifact uploads point to real generated files
- Files:
  - `apps/web/playwright.config.ts`
  - `.github/workflows/e2e.yml`
  - `.github/workflows/pages.yml`
  - `.github/workflows/e2e-gce-smoke.yml`
- Acceptance:
  - CI artifact always includes HTML report, screenshots, traces on failures
- Validation:
  - dry-run workflow check + one CI run evidence
  - pages workflow evidence includes `Publish to Pages` + `Demo E2E` green on latest push

## Suggested Parallel Assignment Set (Fastest)
1. Stream Alpha: B1 + C1 + E1
2. Stream Beta: C2 + D1 + F2
3. Stream Gamma: D2 + E2 + E3 + F1
4. Stream Delta: B2 (starts once B1 is merged)

## Current Progress Snapshot
- B: `Done`
- C: `Done`
- D: `Done`
- E: `Done`
- F: `Done`
