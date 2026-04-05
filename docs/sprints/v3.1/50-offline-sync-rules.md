# Offline Sync Rules (v3.1)

## Core Rule
All first aider mutations for team/workspace status are written locally first.

## Queue Model
Each queued entry has:
- `clientActionId` (uuid)
- `type`
- `payload`
- `queuedAt`
- `status`: `pending|syncing|failed`

## Replay Rules
1. Preserve insertion order.
2. Submit with same `clientActionId`.
3. On idempotent duplicate, mark as synced.
4. On hard validation error, mark failed and surface UI warning.

## UI Rules
- Sync banner always visible.
- Failed items are countable and retryable.
- Active patient resume must work even with pending queue.

## Safety Rules
- No offline overwrite of clinical append-only artifacts.
- Team workspace actions must not mutate patient vitals history.
