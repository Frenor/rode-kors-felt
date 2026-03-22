# ADR-002: Offline-First Sync Strategy

**Status:** Accepted
**Date:** 2026-03-21
**Author:** Team Lead

## Context

First aiders operate in areas with unreliable connectivity. Every incident report must be captured regardless of network state. Clinical data (vitals) must never be lost or silently overwritten.

## Decision

### Write Path

1. All writes go to local IndexedDB (via Dexie.js) first
1. A sync queue tracks pending writes with timestamps
1. When online, the queue flushes to the API in order
1. Each write includes a `clientTimestamp` and `clientId` for conflict detection

### Conflict Resolution

- **Non-clinical fields** (incident status, team assignment): Last-write-wins based on server timestamp
- **Clinical data** (vitals, AVPU, notes): Append-only. Never overwrite. Every reading is a new row with its own timestamp. No conflict possible.
- **Incident creation**: Deduplicated by `clientId` — if the server already has an incident with the same `clientId`, it returns the existing record instead of creating a duplicate.

### Read Path

1. On launch, the app fetches the latest event config, team list, and active incidents
1. These are cached in IndexedDB
1. Subsequent reads come from IndexedDB with background refresh when online
1. Coordinator dashboard uses WebSocket for real-time updates; falls back to polling if WS disconnects

### GPS Buffering

- First aider positions are captured every 10 seconds
- Buffered locally, batch-synced every 30 seconds when online
- If offline, buffer up to 1 hour of positions (capped at ~360 points)

### Service Worker

- Workbox precaches: app shell, static assets, design tokens
- Runtime cache: OSM tiles (CacheFirst, 30-day TTL, 500 tile max)
- Background sync: registers sync events for queued writes

## Consequences

- All clinical data is append-only, which increases storage but eliminates data loss risk
- First aiders may see stale data when offline — UI must clearly indicate sync state
- Deduplication by `clientId` means the client must generate stable UUIDs before syncing
- Coordinator dashboard may show slightly delayed data from offline first aiders

## Alternatives Considered

- **CRDTs**: Over-engineered for this use case. Our data model is mostly append-only, and last-write-wins handles the few mutable fields.
- **PouchDB/CouchDB**: Heavier than needed. Dexie + custom sync queue gives us more control over conflict resolution rules.
