# First Aider Workspace Spec (v3.1)

## Goal
Provide first aiders with a persistent patient workspace that survives reload and weak network conditions.

## Dashboard Sections
1. `Aktiv pasient`
2. `Overvakede pasienter`
3. `Utildelte pasienter` (secondary)

## Local Active Patient Policy
- One active patient per `(eventId, teamId, device)`.
- Persist key: `rkf.activePatient.<eventId>.<teamId>`.
- Reload must restore active patient context automatically.

## Team Status Controls
- Enum values:
  - `available`
  - `en_route`
  - `on_scene`
  - `needs_assistance`
  - `unavailable`
- Labels in UI are Norwegian Bokmal.

## Sync Banner (Always Visible)
- `Laget lokalt`
- `Synkroniserer`
- `Ikke synkronisert`
- `Synkronisert`

## Offline Behavior
- Queue team actions in Dexie first.
- Optimistic UI immediately.
- Replay on reconnect with `clientActionId` idempotency.

## Done Criteria
- User can continue same patient after hard reload.
- Team can track multiple monitored patients while only one active context is open.
