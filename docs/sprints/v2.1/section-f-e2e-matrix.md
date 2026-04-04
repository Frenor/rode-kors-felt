# Section F — Deployed E2E Matrix (Implementation Spec)

## Objective
Create deterministic E2E validation across local, demo deploy, and production smoke targets.

## Playwright Projects (Exact Names)
- `local-full`
- `pages-demo`
- `gce-prod-smoke`

## Target Scope
- `local-full`:
  - state-changing full chain including 113 flow and AI confirmation
- `pages-demo`:
  - demo-safe checks on deployed GitHub Pages URL
- `gce-prod-smoke`:
  - strictly read-safe checks only

## Production Mutation Guard
- In smoke harness, fail test immediately if method matches:
  - `POST`
  - `PATCH`
  - `PUT`
  - `DELETE`

## CI Workflow Requirements
- Pages pipeline runs post-deploy `pages-demo` suite.
- Separate workflow `e2e-gce-smoke` supports:
  - `workflow_dispatch`
  - scheduled run
- Failure artifacts required for all targets:
  - trace
  - screenshot
  - HTML report

## File Ownership (Implementation Lane)
- `apps/web/playwright.config.ts`
- `apps/web/e2e/local-full.spec.ts`
- `apps/web/e2e/pages-demo.spec.ts`
- `apps/web/e2e/gce-prod-smoke.spec.ts`
- `.github/workflows/pages.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/e2e-gce-smoke.yml`

## Test Checklist
- Each target can run independently via project flag.
- `gce-prod-smoke` verifies no mutation requests emitted.
- Failure artifacts are uploaded and inspectable.

## Done Criteria
- All three suites are executable, isolated, and safe by design.
