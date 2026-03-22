# Rødt Kors Felt (RKF) — Event Medical System

A progressive web application for the Norwegian Red Cross to coordinate medical response during events. Supports field patrol first aiders (mobile), sick bay clinical staff (tablet), and event coordinators (desktop).

## Architecture

- **Offline-first PWA** — works without connectivity, syncs when online
- **Real-time** — WebSocket feeds for coordinator dashboard
- **GDPR-compliant** — no mandatory PII, event-scoped data isolation, EU hosting
- **WCAG 2.2 AA** — minimum standard, AAA where feasible

## Monorepo Structure

```
rkf/
├── apps/
│   ├── web/          # React 19 + TypeScript PWA (Vite)
│   └── api/          # Fastify + TypeScript API server
├── packages/
│   ├── shared-types/  # Shared TypeScript types & enums
│   ├── ui/            # Shared UI component library
│   └── eslint-config/ # Shared ESLint configuration
├── infra/
│   ├── terraform/     # AWS infrastructure (ECS, RDS, ElastiCache)
│   └── docker/        # Dockerfiles for API and web
├── docs/
│   ├── adr/           # Architecture Decision Records
│   ├── design/        # Design system documentation
│   └── api/           # OpenAPI specifications
└── prompts/           # AI prompt registry (versioned)
```

## Tech Stack

| Layer     | Technology                                         |
|-----------|----------------------------------------------------|
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS v4        |
| State     | Zustand + TanStack Query                           |
| Offline   | Dexie.js (IndexedDB) + Workbox                     |
| Maps      | Leaflet.js + react-leaflet                         |
| Backend   | Node.js, Fastify, TypeScript                       |
| Database  | PostgreSQL + Redis                                 |
| ORM       | Drizzle ORM                                        |
| Real-time | WebSockets (Fastify WS)                            |
| Cloud     | AWS (ECS Fargate, RDS, ElastiCache) — eu-central-1 |
| IaC       | Terraform                                          |
| CI/CD     | GitHub Actions                                     |
| Monitoring| OpenTelemetry → CloudWatch + Sentry                |

## Getting Started

### Prerequisites

- Node.js >= 20 LTS
- pnpm >= 9
- Docker & Docker Compose (for local development)
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Install

```bash
pnpm install
```

### Development

```bash
# Start all services (API + Web + DB + Redis)
pnpm dev

# Start individual apps
pnpm --filter @rkf/web dev
pnpm --filter @rkf/api dev
```

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test           # Unit tests
pnpm test:e2e       # Playwright E2E
pnpm lint           # ESLint + Prettier
pnpm typecheck      # TypeScript strict mode
```

## Git Conventions

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch naming, commit message format, and merge request process.

## Documentation

- [Product Specification](./docs/PRODUCT_SPEC.md)
- [Team Charter](./docs/TEAM_CHARTER.md)
- [Architecture Decisions](./docs/adr/)
- [Design System](./docs/design/)

## License

Proprietary — Norwegian Red Cross. All rights reserved.
