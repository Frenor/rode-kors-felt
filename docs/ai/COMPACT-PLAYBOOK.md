# RKF AI Compact Playbook

## Purpose
Single source of truth for AI agents in RKF. Keep prompts short, deterministic, and production-safe.

## Priority Order
`Safety > Offline > Accessibility > GDPR > Performance > DX`

## Non-Negotiables
1. Event scoping is mandatory on all incident/patient/team data.
2. Clinical timeline artifacts remain append-only.
3. Canonical enums are English in code/API/storage.
4. UI text is Norwegian Bokmal via label mappings.
5. No backward compatibility layers unless explicitly requested.
6. Keep commits small, self-contained, rollback-safe.
7. Push frequently for demo visibility.
8. Update `PLAN.md` at milestone boundaries.
9. Any web feature touching user-visible flows must update `apps/web/e2e/pages-demo.spec.ts` (or explicitly log why no change is needed in `PLAN.md`).

## Execution Loop
1. Read `PLAN.md` and pick one smallest complete task.
2. Implement target-state only.
3. Run scoped typecheck/tests.
4. Commit one logical unit.
5. Push.
6. Log checkpoint in `PLAN.md`.

## Delegation Rules
1. Use cheapest capable model with low reasoning by default.
2. Split work by disjoint file ownership.
3. Run specialists in parallel where possible.
4. Integrator resolves conflicts and runs final verification.

## Security Baseline
1. Signed token verification required.
2. Refresh flow validates token type.
3. Role + event-scope enforcement on sensitive routes.
4. No token in URL query for WebSocket.
5. No persistent auth token in localStorage.

## Validation Baseline
- API: scoped tests for auth/scope/realtime and touched routes.
- Web: store/client tests for auth/ws and touched UI.
- Web flows: when flow/UI behavior changes, update or extend `pages-demo` Playwright coverage.
- Typecheck must pass in touched packages.

## File Map
- Planning: `PLAN.md`
- Agent orchestration: `AGENTS.md`
- Claude runtime mirror: `CLAUDE.md`
- Specialist briefs: `prompts/agents/*.md`
