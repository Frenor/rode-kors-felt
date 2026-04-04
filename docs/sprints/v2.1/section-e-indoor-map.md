# Section E — Indoor + Custom Map Platform (Implementation Spec)

## Objective
Support accurate indoor incident reporting and custom runtime map configuration.

## Data Contract
- `Incident.locationContext?`
- Shape:
  - `{ mode: 'gps' | 'indoor_zone', venueId?, floorId?, zoneId?, zoneLabel? }`
- Backward compatibility:
  - keep existing required `location { lat, lng }`

## API Endpoints
- `GET /api/events/:id/indoor-layout`
  - returns venue/floor/zone graph
- `GET /api/events/:id/map-config`
  - returns sanitized runtime map config for provider/style/layers

## Runtime Config Source
- v1 source: infra/env only
- key: `MAP_CONFIG_JSON`
- no in-app layer/token CRUD in v1

## UI Specification
- Incident form:
  - if indoor layout exists, default to zone/floor selection
  - preserve GPS as explicit fallback option
- Coordinator map:
  - MapLibre rendering path behind feature flag
  - 3D presentation toggle
  - keep legacy map path as fallback
- First-aider map:
  - keep 2D operational focus

## File Ownership (Implementation Lane)
- Shared types:
  - `packages/shared-types/src/index.ts`
- API:
  - `apps/api/src/routes/events.ts`
  - `apps/api/src/routes/incidents.ts`
  - `apps/api/src/__tests__/events.test.ts`
  - `apps/api/src/__tests__/incidents.test.ts`
- Web:
  - `apps/web/src/pages/IncidentForm.tsx`
  - `apps/web/src/components/IndoorLocationPicker.tsx`
  - `apps/web/src/components/EventMap.tsx`
  - `apps/web/src/pages/CoordinatorDashboard.tsx`

## Test Checklist
- Incident payload persists `locationContext` when indoor mode is used.
- Event-scoped map/indoor endpoints return expected shape.
- Coordinator map toggle does not break fallback mode.

## Done Criteria
- Indoor incidents can be submitted with unambiguous zone/floor context under weak GPS conditions.
