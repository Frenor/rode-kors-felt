# CLAUDE.md — Project Instructions for Claude Code

## Project: RKF — Rødt Kors Felt (Red Cross Event Medical System)

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
- CI: GitHub Actions (was GitLab CI, migrated)

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

### Current State (as of 2026-03-21)
- Sprint 1 in progress
- Working MVP prototype in `docs/design/mvp-prototype.jsx` (all 3 roles functional)
- Usability study completed — see `docs/design/usability-study.jsx`
- All high-priority usability fixes applied to MVP
- API has in-memory store (swap to Drizzle/PostgreSQL for production)
- Monorepo scaffold complete with all configs

### What Needs Doing Next
1. `pnpm install` and verify everything builds
1. Wire the React components from the MVP into proper `apps/web/src/` structure
1. Connect API routes to the frontend via TanStack Query
1. Set up Dexie.js offline store with sync queue
1. Add Storybook with axe-core for component development
1. Set up GitHub Actions CI pipeline
1. Write Playwright E2E tests for the 3 core flows

### Demo Credentials
- First Aider code: `123456`
- Sick Bay code: `654321`
- Admin: `admin@rkf.no` / `admin123`
