# Agent Pack B — Backend Team Workspace

## Scope
Implement backend support for team actions, workspace projections, and Sick Bay incoming feed.

## Files
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/migrate.ts` or migration files
- `apps/api/src/routes/teams.ts` (new)
- `apps/api/src/routes/events.ts`
- `apps/api/src/routes/index.ts` (if needed for route registration)
- `apps/api/src/__tests__/...`
- `packages/shared-types/src/index.ts`

## Required Work
1. Add `team` to action entity type enum.
2. Add `TeamOperationalStatus` English enum in shared-types.
3. Add POST team actions endpoint with append-only action_events writes.
4. Add GET team workspace projection endpoint.
5. Add GET sickbay incoming feed endpoint.
6. Enforce 403 on event mismatch for new endpoints.
7. Support idempotency via `clientActionId` for team actions.

## Critical Feed Logic
`criticalReasons` includes any of:
- `needs_assistance`
- `open_escalation`
- `triage_immediate`
- `news2_high`

## Tests Required
- Route validation and event isolation.
- Idempotent duplicate action ingestion.
- Projection correctness for assigned/monitored/unassigned.
- Critical reason composition and sorting.

## Commit
`feat(api): add team workspace actions and sickbay incoming feed`
