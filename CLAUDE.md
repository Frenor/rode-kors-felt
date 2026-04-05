# CLAUDE.md - RKF Operating Playbook

## 1) Purpose
This file is the shared operating contract for Claude Code and all spawned agents in:
- `/Users/fredrik/Developer/rode-kors-felt`

Use this as the default way of working unless a newer explicit user instruction overrides it.

---

## 2) Project Snapshot
RKF (Rode Kors Felt) is an offline-first medical coordination PWA for event operations with three main roles:
- First Aider (mobile)
- Sick Bay (tablet)
- Coordinator (desktop)

Core stack:
- `apps/web`: React 19 + TypeScript + Vite PWA
- `apps/api`: Fastify + TypeScript + Drizzle + PostgreSQL
- `packages/shared-types`: Zod schemas shared across web/api
- `infra`: Terraform + Docker

---

## 3) Non-Negotiables
1. Safety first: decisions prioritize `Safety > Offline > Accessibility > GDPR > Performance > DX`.
2. Offline-first: writes must be robust under unstable connectivity.
3. Clinical append-only behavior remains protected where designed (vitals/clinical timeline artifacts).
4. Event scoping is mandatory (`eventId` isolation).
5. User-facing text is Norwegian Bokmal.
6. Accessibility baseline is WCAG 2.2 AA, with high readability for clinical data.
7. No backward compatibility layers by default.
8. No transition windows by default.
9. No legacy enum aliases in API/storage contracts.
10. Canonical enums in code/API/storage are English; translation happens in view layer only.

If a compatibility layer is desired, it must be explicitly requested by the user for that task.

---

## 4) Source Of Truth
`PLAN.md` is the live execution source of truth.

Required behavior:
1. Open and align with `PLAN.md` before substantial implementation.
2. Update `PLAN.md` checkpoint/status when meaningful milestones are completed.
3. Keep `PLAN.md` synchronized with git commits to make interruption recovery trivial.

`TODO.md` is not used as execution source.

---

## 5) Git And Delivery Mode
Use small, self-contained, rollback-safe commits.

Required workflow:
1. One logical change per commit.
2. Commit message uses conventional commit prefix.
3. Push frequently so demo/progress stays visible (prefer push after each meaningful commit).
4. Avoid batching unrelated changes into one commit.
5. Never rewrite history unless explicitly requested.

If push hangs in the environment:
1. Retry once with TTY.
2. Report exact commit hashes immediately.
3. Continue with next isolated change so user can push manually if needed.

---

## 6) Multi-Agent Protocol (Default)
For non-trivial tasks, use specialist agents in parallel with disjoint ownership.

### 6.1 Model/Cost policy
Default delegation target:
- cheapest capable coding model
- lowest reasonable reasoning level

Upgrade model/reasoning only if blocked by correctness/complexity.

### 6.2 Delegation policy
1. Split into bounded tasks with file ownership.
2. Run in parallel when write scopes do not overlap.
3. Keep main agent as integrator: review, resolve conflicts, run tests, commit, push.
4. Never ask agents to add backward compatibility unless user explicitly asks.

### 6.3 Synthesis policy
After agent outputs:
1. Resolve contract conflicts centrally.
2. Prefer canonical target-state implementation over compatibility shims.
3. Validate with focused typecheck/tests before commit.

### 6.4 Agent routing matrix
| Request type | Launch these agents in parallel |
|---|---|
| New UI component or screen | `frontend-engineer` + `ux-designer` |
| New API endpoint | `backend-engineer` + `frontend-engineer` |
| Full-stack feature | `frontend-engineer` + `backend-engineer` + `ux-designer` + `qa-engineer` |
| Bug fix (frontend) | `frontend-engineer` + `qa-engineer` |
| Bug fix (backend) | `backend-engineer` + `qa-engineer` |
| Accessibility issue | `ux-designer` + `frontend-engineer` + `qa-engineer` |
| Performance problem | `frontend-engineer` or `backend-engineer` + `devops-engineer` |
| Infra / CI / deploy | `devops-engineer` + `backend-engineer` |
| Usability review | `ux-designer` + `field-user` |
| Design system / tokens | `ux-designer` + `frontend-engineer` |
| Test coverage / quality | `qa-engineer` |
| Sprint or feature planning | `product-lead` |

### 6.5 Field-user veto
Any blocker reported by `field-user` is a P0 for release and must be fixed before release.

---

## 7) Execution Gates Per Change
Before each commit:
1. Run scoped typecheck and relevant tests for touched area.
2. Confirm no unrelated files staged.
3. Confirm commit scope matches one logical unit.

Before declaring done:
1. Ensure branch is pushed.
2. Ensure `PLAN.md` has checkpoint for milestone-level changes.
3. For UI-visible changes intended for demo, ensure Pages visibility checks are included in validation flow.

---

## 8) API/Enum Rules
1. Public API contracts should be explicit and canonical.
2. Enum values in API/storage/shared types are English only.
3. UI translation maps convert canonical enum values to Norwegian labels.
4. Reject invalid enum input; do not silently normalize legacy aliases.

---

## 9) UI Rules For This Project
1. Maintain operational readability in stress scenarios.
2. Favor clear status language and explicit visual hierarchy.
3. Keep touch targets suitable for field use.
4. Prefer deterministic, testable UI behavior over implicit heuristics.

---

## 10) Recommended Commands
```bash
pnpm --filter @rkf/api typecheck
pnpm --filter @rkf/api test -- <relevant-specs>
pnpm --filter @rkf/web typecheck
pnpm --filter @rkf/web test -- <relevant-specs>
pnpm --filter @rkf/web exec playwright test --project=pages-demo
git status -sb
git log --oneline -n 10
```

---

## 11) Quick Start For Any Agent
1. Read `PLAN.md` first.
2. Identify the next smallest self-contained task.
3. Implement target-state (no compatibility shim unless explicitly requested).
4. Run scoped tests/typecheck.
5. Commit small.
6. Push.
7. Update `PLAN.md` checkpoint.

---

## 12) Demo Credentials (Local/Demo Use)
- First Aider code: `123456`
- Sick Bay code: `654321`
- Admin: `admin@rkf.no` / `admin123`
