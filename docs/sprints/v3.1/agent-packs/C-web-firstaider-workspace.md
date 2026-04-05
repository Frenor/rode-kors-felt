# Agent Pack C — Web First Aider Workspace

## Scope
Implement first aider dashboard workspace sections, local active patient resume, and team status controls.

## Files
- `apps/web/src/pages/FirstAiderDashboard.tsx`
- `apps/web/src/stores/firstaid-workspace.ts` (new)
- `apps/web/src/lib/offline-firstaid-queue.ts` (new)
- `apps/web/src/hooks/useOfflineSync.ts` (extend if needed)
- `apps/web/src/lib/api.ts`
- `apps/web/src/__tests__/...`

## Required Work
1. Add sections: Aktiv pasient, Overvakede pasienter, Utildelte pasienter.
2. Persist active patient per event/team in local storage.
3. Add team status controls using English enum values and NB labels.
4. Add always-visible sync banner states.
5. Queue team actions in Dexie first and replay on reconnect.

## UX Constraints
- Keep 56px touch targets for status controls.
- Keep copy in Norwegian Bokmal.
- Do not show raw enum values.

## Tests Required
- Resume active patient after reload.
- Sync banner transitions across offline/online.
- Status action queue and replay behavior.

## Commit
`feat(web): add first-aider patient workspace, resume, and field status controls`
