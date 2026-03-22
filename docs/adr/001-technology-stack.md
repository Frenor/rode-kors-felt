# ADR-001: Technology Stack

**Status:** Accepted
**Date:** 2026-03-21
**Author:** Team Lead

## Context

We need a technology stack for the RKF Event Medical System — a PWA serving Norwegian Red Cross field medical teams. Key constraints: offline-first, real-time, GDPR-compliant (EU hosting), accessible (WCAG 2.2 AA), and operable with gloves in outdoor conditions.

## Decision

### Frontend

**React 19 + TypeScript + Vite**
React's component model suits the distinct role-based views (first aider, sick bay, coordinator). Vite provides fast dev and optimised production builds. TypeScript for strict type safety on clinical data.

### Styling

**Tailwind CSS v4 + CSS Custom Properties**
Utility classes for layout, custom properties for the design token system. Enables dual-mode (light/dark) theming via `prefers-color-scheme` without build-time duplication.

### State Management

**Zustand + TanStack Query**
Zustand for local UI state and offline queue management. TanStack Query for server state with built-in cache, background refetch, and optimistic updates.

### Offline

**Dexie.js (IndexedDB) + Workbox**
Dexie provides structured offline storage with a sync queue. Workbox handles service worker lifecycle, precaching, and runtime caching (including OSM tiles).

### Maps

**Leaflet.js + react-leaflet**
Lightweight, open-source, supports image overlays for custom event maps, and works with OSM tiles. No licensing cost.

### Backend

**Node.js + Fastify + TypeScript**
Fastify for its speed, schema-first validation (aligns with our OpenAPI approach), and native WebSocket support. Shared TypeScript types between frontend and backend via `@rkf/shared-types`.

### Database

**PostgreSQL 16 + Redis 7**
PostgreSQL for relational event data with row-level security. Redis for session storage, real-time pub/sub (WebSocket message distribution), and rate limiting.

### ORM

**Drizzle ORM**
Type-safe, migration-first, minimal abstraction. Schema defined in TypeScript, migrations are plain SQL.

### Cloud

**AWS (ECS Fargate + RDS + ElastiCache) — eu-central-1**
Frankfurt region for GDPR. Fargate for zero server management. RDS for managed PostgreSQL. ElastiCache for managed Redis.

### IaC

**Terraform**
Declarative, multi-environment, state-locked. Remote state in S3 + DynamoDB.

### CI/CD

**GitLab CI**
Integrated with GitLab hosting. Pipeline: validate → test → build → security → deploy.

### Monitoring

**OpenTelemetry → CloudWatch + Sentry**
OTel for distributed tracing and metrics. CloudWatch for AWS-native monitoring. Sentry for frontend error tracking.

## Consequences

- Team must be proficient in TypeScript across the full stack
- Offline-first adds complexity to every data write path
- Dual-mode theming requires all UI components tested in both modes
- AWS eu-central-1 limits some service availability vs. us-east-1

## Alternatives Considered

- **Next.js**: Too server-heavy for an offline-first PWA
- **Prisma**: Heavier abstraction than needed; Drizzle is lighter
- **Firebase/Supabase**: Vendor lock-in, less control over GDPR compliance
- **MongoDB**: Relational model is better suited for event-scoped, structured medical data
