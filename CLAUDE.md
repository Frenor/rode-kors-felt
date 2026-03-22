# CLAUDE.md — Project Instructions for Claude Code

## Project: RKF — Røde Kors Felt (Red Cross Event Medical System)

### What This Is
A PWA for Norwegian Red Cross event medical coordination. Three roles: First Aider (mobile), Sick Bay (tablet), Coordinator (desktop). Offline-first, real-time where connected, GDPR-compliant.

### Monorepo Structure
```
apps/web/     — React 19 + TypeScript + Vite PWA (port 3000)
apps/api/     — Fastify + TypeScript API (port 4000)
packages/shared-types/ — Zod schemas shared between web and API
packages/ui/  — Shared UI component library
infra/        — Terraform (AWS eu-central-1) + Docker
docs/         — ADRs, design specs, API docs
```

### Tech Stack
- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query, Dexie.js, Leaflet
- Backend: Fastify 5, TypeScript, Drizzle ORM, PostgreSQL 16, Redis 7
- Infra: AWS ECS Fargate, RDS, ElastiCache, Terraform, Docker
- CI: GitHub Actions (`.github/workflows/`)

### Key Commands
```bash
pnpm install              # Install all deps
pnpm dev                  # Start all services
pnpm --filter @rkf/web dev    # Web only
pnpm --filter @rkf/api dev    # API only
pnpm lint                 # ESLint all packages
pnpm typecheck            # TypeScript strict
pnpm test                 # Vitest unit tests
pnpm test:e2e             # Playwright E2E
docker compose up -d      # Start Postgres + Redis locally
```

### Git Conventions
- Conventional Commits: `feat(web):`, `fix(api):`, `a11y(ui):`, `design(ui):`
- Branch naming: `feature/fe-XX-description`, `fix/XX-description`, `chore/`, `infra/`, `docs/`
- Small commits, one logical change each
- Squash merge to develop, merge commit to main

### Design System
- Typography: IBM Plex Sans (UI) + IBM Plex Mono (data/clinical)
- Theme: follows device `prefers-color-scheme`, manual toggle available, NO role-based overrides
- Clinical data contrast: ≥ 7:1 (WCAG AAA)
- Touch targets: ≥ 56px (glove operation for first aiders)
- Status colors calibrated per mode (light/dark)
- Design tokens in `apps/web/src/styles/tokens.css`

### Critical Rules
1. All clinical data (vitals, AVPU) is append-only — NEVER overwrite
1. All queries scoped by eventId — row-level security
1. No mandatory PII — GDPR by design
1. Norwegian language for all user-facing strings
1. Offline-first: all writes go to IndexedDB first, sync when online
1. Vitals validation: pulse 20-220, SpO₂ 50-100, RF 4-60, pain 0-10

### Current State (as of 2026-03-22)
- Sprints 1–5 substantially implemented (see TODO.md for details)
- Sprint 6 in progress: 3/5 done (report endpoint, GitHub Actions deploy, request tracing)
- API uses Drizzle ORM + PostgreSQL (in-memory store removed from routes)
- `docker compose up -d` starts Postgres + Redis; API auto-migrates on startup
- Web: 65 unit tests pass (`pnpm --filter @rkf/web test`)
- API unit tests require running PostgreSQL (`docker compose up -d` first)
- E2E tests (Playwright) exist for coordinator and incident flows

### What Needs Doing Next
1. Write Playwright E2E test for the full incident-to-discharge chain (Oppgave 1)
1. Verify event isolation with automated tests (Oppgave 2)
1. Verify append-only enforcement with automated tests (Oppgave 3)
1. Refactor `SickBayDashboard.tsx` (large) and `CoordinatorDashboard.tsx` (large) into sub-components (Oppgave 4)
1. Fix critical/serious axe-core a11y violations — focus trap, AVPU radiogroup, MCI aria-live (Oppgave 5)
1. Complete Terraform modules (ECS Fargate, RDS Multi-AZ, ElastiCache, ALB + ACM)
1. Implement remaining Sprint 4–5 items: resource allocation board, MCI handover, MIST pre-fill

### Demo Credentials
- First Aider code: `123456`
- Sick Bay code: `654321`
- Admin: `admin@rkf.no` / `admin123`

---

## Multi-Agent Orchestration Protocol

This project has a specialist agent team in `prompts/agents/`. **You must use it.**
Do not solve tasks alone as a generalist. For every non-trivial request, identify the
relevant specialists, launch them **in parallel**, and synthesize their outputs.

### Step 1 — Classify the Request

Map the incoming request to one or more agents using this routing matrix:

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
| Sprint or feature planning | `product-lead` (delegates further) |

### Step 2 — Launch Agents in Parallel

In a **single response**, call the Agent tool multiple times — one per specialist.
Never send them sequentially when they can work at the same time.

Each Agent tool call must use this prompt structure:

```
You are the [ROLE] for the RKF project (Røde Kors Felt — Norwegian Red Cross event
medical system).

## Your Role
[full contents of prompts/agents/<role>.md]

## Non-Negotiables
- Offline-first: all writes go to Dexie/IndexedDB first, sync when online
- Append-only clinical data (vitals, AVPU) — never overwrite
- All queries scoped by eventId (row-level security)
- Norwegian Bokmål for all user-facing strings
- GDPR: no mandatory PII, AWS eu-central-1 only
- WCAG 2.2 AA minimum; ≥ 7:1 contrast for clinical data; 56px touch targets
- Vitals bounds: pulse 20–220, SpO₂ 50–100, RF 4–60, pain 0–10

## Your Task
[specific sub-task scoped to this agent's domain]

## Return Format
### Assessment
### Proposed Changes (files + code snippets)
### Dependencies on Other Agents
### Risks / Blockers
```

### Step 3 — Synthesize

After all parallel agents respond:

1. Identify any **conflicts** (e.g., mismatched API contracts between frontend and backend agents).
2. Resolve conflicts using the priority order: **Safety > Offline > Accessibility > GDPR > Performance > DX**.
3. Check that QA's test plan covers the changes proposed by other agents.
4. If `field-user` reported any blockers, treat them as **P0** — stop and fix before proceeding.
5. Produce a unified implementation plan or directly implement the changes.

### Agent Roster

```
prompts/agents/
  README.md              — Team overview
  product-lead.md        — Orchestrator; owns backlog, sprint planning, handoffs
  ux-designer.md         — Design system, accessibility, Norwegian copy
  frontend-engineer.md   — React 19 PWA, offline sync, Zustand, TanStack Query
  backend-engineer.md    — Fastify, Drizzle ORM, PostgreSQL, WebSockets
  qa-engineer.md         — Vitest, Playwright, axe-core, quality gates
  devops-engineer.md     — Terraform, AWS ECS, GitHub Actions, Docker
  field-user.md          — Kari Larsen: Norwegian usability tester (thinks aloud,
                           gives up after 3 failed attempts, reports in Norwegian)
```

**Field User veto:** a single blocker from Kari Larsen is a P0 — no release until resolved.
