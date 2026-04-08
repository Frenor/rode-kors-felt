# FirstAiderDashboard — State Machine Reference

> Generated from code review of commits `c74416b` (redesign) and `173f4ed` (multi-team patient tracking).
> Source: `apps/web/src/pages/FirstAiderDashboard.tsx` + `apps/web/src/pages/FirstAider/`

---

## State Inventory

### Zustand store (`firstaid-workspace.ts`, persisted to localStorage)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `selectedTeamId` | `string \| null` | `null` | Which team the first aider is operating as |
| `latestStatusByTeam` | `Record<string, TeamOperationalStatus>` | `{}` | Key: `{eventId}:{teamId}`. Optimistic team status |
| `patientStatusMap` | `Record<string, TeamPatientStatus>` | `{}` | Key: `{eventId}:{teamId}:{patientId}`. Optimistic per-patient engagement |
| `activePatientIdByTeam` | `Record<string, string>` | `{}` | Key: `{eventId}:{teamId}`. Last actively worked patient |
| `lastSyncedAtByTeam` | `Record<string, string>` | `{}` | Key: `{eventId}:{teamId}`. Last successful sync timestamp |

### Local component state (not persisted)

| Variable | Type | Initial | Description |
|----------|------|---------|-------------|
| `workspace` | `TeamWorkspaceResponse \| null` | `null` | Server workspace snapshot |
| `workspaceLoading` | `boolean` | `false` | Workspace API fetch in flight |
| `assignedPatients` | `any[]` | `[]` | From `api.getPatients()`, kept live via WebSocket |
| `expandedPatientId` | `string \| null` | `null` | Accordion open state |
| `showStatusPicker` | `boolean` | `false` | Bottom-sheet status picker visible |
| `showSettings` | `boolean` | `false` | Settings panel expanded |
| `showChat` | `boolean` | `false` | Chat section expanded |
| `showGear` | `boolean` | `false` | Gear sub-section inside settings |
| `showContacts` | `boolean` | `false` | Contacts sub-section inside settings |
| `perPatientVitalsForm` | `Record<string, VitalsFormShape>` | `{}` | Per-patient vitals draft |
| `perPatientNoteText` | `Record<string, string>` | `{}` | Per-patient injury note draft |
| `teamGear` | `string[]` | `[]` | Gear selection (mirrors server) |
| `contactPhone` | `string` | `''` | Team phone draft |
| `contactRadio` | `string` | `''` | Team ISSI draft |
| `contactsDirty` | `boolean` | `false` | Contacts changed but unsaved |
| `messages` | `ChatMessage[]` | `[]` | Chat history (WS only, not persisted) |
| `messageText` | `string` | `''` | Unsent message draft |
| `sectorAssignments` | `Record<string, {sector, assignedAt}>` | `{}` | Live sector assignments from WS |
| `highlightedFields` | `Map<string, Set<string>>` | `new Map()` | Which patients/fields flash from WS update |

---

## State Machine: Team Selection

```
┌─────────────────────────────────────┐
│  NO TEAM SELECTED                   │
│  selectedTeamId = null              │
│  → shows team picker list           │
│  → "Meld hendelse" button visible   │  ⚠ also visible here (see bugs)
└──────────────┬──────────────────────┘
               │ user clicks a team → setSelectedTeam(teamId)
               ▼
┌─────────────────────────────────────┐
│  TEAM SELECTED, LOADING             │
│  workspaceLoading = true            │
│  workspace = null                   │
│  → sticky header with status pill   │
│  → "Egne pasienter (0)" heading     │
│  → "Utildelte pasienter (0)" heading│  ⚠ shows 0 during load (see bugs)
│  → "Laster pasienter…" spinner      │
└──────────────┬──────────────────────┘
               │ api.getTeamWorkspace() resolves
               ▼
┌─────────────────────────────────────┐
│  TEAM SELECTED, LOADED              │
│  workspaceLoading = false           │
│  workspace = TeamWorkspaceResponse  │
│  → full UI: settings, patients,     │
│    unassigned list, chat, incident  │
└──────────────────────────────────────┘
```

There is no "switch team" button — the user can only switch by navigating away and returning, or if the component is unmounted and remounted with a different team. `selectedTeamId` persists across reloads.

---

## State Machine: Team Operational Status

```
TeamOperationalStatus = 'available' | 'en_route' | 'on_scene' | 'needs_assistance' | 'unavailable'

Default (no prior store value): 'available'

               ┌─────────────────────────────────────────────────────┐
               │              STATUS PICKER CLOSED                   │
               │  showStatusPicker = false                           │
               └────────────────────┬────────────────────────────────┘
                                    │ user taps status pill
                                    ▼
               ┌──────────────────────────────────────────────────────┐
               │              STATUS PICKER OPEN                     │
               │  showStatusPicker = true                            │
               │  Bottom sheet shows all 5 options                   │
               └────┬────────────────────────────────────────────────┘
                    │ user picks option OR taps backdrop
                    ▼
     ┌──────────────────────────────────────────────┐
     │  setTeamOperationalStatus(status)            │
     │  1. setTeamStatus(eventId, teamId, status)   │
     │  2. queueAndSyncTeamAction({type:            │
     │     'team.status_set', status})              │
     │  3. showStatusPicker = false                 │
     └──────────────────────────────────────────────┘
```

### Manual-only states

`needs_assistance` and `unavailable` act as **manual overrides**. When either is the current status, the auto-derivation from patient engagement (below) is **skipped** (`manualOnly = true`). These states can only be exited by manually picking a new status from the picker.

`needs_assistance` can also be set quickly from the "! Trenger bistand" button inside any patient accordion (which also closes the accordion).

---

## State Machine: Per-Patient Engagement

```
TeamPatientStatus = 'en_route_to_patient' | 'transporting' | 'monitoring'

Source of truth priority: localStatus (Zustand store) ?? serverStatus (workspace.teamPatientStatus)

┌──────────────────────────────────────────────────┐
│  NO ENGAGEMENT                                   │
│  patientStatusMap[key] = undefined               │
│  activeStatus = null                             │
│  → 3 status buttons shown (no checkmark)         │
│  → "Avslutt" button hidden                       │
└────────────┬─────────────────────────────────────┘
             │ user taps 'På vei' / 'Transporterer' / 'Overvåker'
             │ onSetStatus(patientId, status)
             ▼
┌──────────────────────────────────────────────────┐
│  ENGAGED                                         │
│  patientStatusMap[key] = status                  │
│  activeStatus = status                           │
│  → clicked button shows ✓                        │
│  → "Avslutt" button visible                      │
│  → team operational status auto-derived (below)  │
└────────────┬─────────────────────────────────────┘
             │ a) user taps the same (active) button → onSetStatus(id, null)
             │ b) user taps "Avslutt" → onSetStatus(id, null)
             ▼
┌──────────────────────────────────────────────────┐
│  ENGAGEMENT CLEARED                              │
│  patientStatusMap[key] deleted                   │
│  activeStatus = null                             │
│  → team operational status auto-derived (below)  │
└──────────────────────────────────────────────────┘

Note: switching between statuses is NOT a single atomic step.
Tapping 'Transporterer' when 'På vei' is active will first go through
handleSetPatientStatus(id, null) — no, actually:
  - tapping active button → onSetStatus(id, null) → clears
  - tapping inactive button when another is active → onSetStatus(id, newStatus)
    which sets the new status WITHOUT clearing the old one first — the store
    key is overwritten. This is correct behaviour.
```

---

## State Machine: Team Status Auto-Derivation

Runs inside `handleSetPatientStatus` after every engagement change when `!manualOnly`.

```
Input: updated patientStatusMap for this (eventId, teamId)

Rule (priority order):
  1. ANY patient has 'transporting' OR 'monitoring'  →  team status = 'on_scene'
  2. ANY patient has 'en_route_to_patient'           →  team status = 'en_route'
  3. No patients engaged                             →  team status = 'available'

Guard: if current team status is 'needs_assistance' OR 'unavailable',
       auto-derivation is SKIPPED entirely.

Side-effect: if derived != current, queues a 'team.status_set' action.
```

---

## State Machine: Patient Accordion

```
┌────────────────────────────┐
│  COLLAPSED                 │
│  expandedPatientId ≠ p.id  │
│  → shows: triage badge,    │
│    name, "Oppdatert" flash,│
│    ▼ chevron               │
└───────────┬────────────────┘
            │ user taps row
            │ togglePatientExpand(p.id)
            ▼
┌────────────────────────────────────────────┐
│  EXPANDED                                  │
│  expandedPatientId = p.id                  │
│  → shows: position/nav, vitals form,       │
│    injury notes, engagement picker,        │
│    "! Trenger bistand" button              │
│  border: brand color                       │
└───────────┬────────────────────────────────┘
            │ a) user taps same row → collapse
            │ b) user taps different row → other expands (one-at-a-time)
            │ c) user taps "! Trenger bistand" → setExpandedPatientId(null)
            ▼
          [COLLAPSED]
```

---

## Patient Data Sources and Merge

`combinedAssignedPatients` (the main patient list) is built from three sources:

```
1. assignedPatients        ← workspace.assignedPatients (initial seed on workspace load)
                              then kept live by api.getPatients({assignedTeamId})
                              and WS patient.updated / patient.created patches
2. monitoredPatients       ← workspace.monitoredPatients, deduped against (1)
3. extras                  ← workspace.unassignedPatients WHERE patientStatusMap
                              has a local entry for this patient AND not in (1)
```

When workspace loads, `workspace.assignedPatients` seeds the `assignedPatients` state
if it is currently empty — this prevents the list from showing blank while the separate
`api.getPatients()` call is still in flight. Once `getPatients` resolves, it takes over
as the authoritative source.

---

## Offline Queue Flow

```
User action
    │
    ▼
Zustand store updated (optimistic, persisted to localStorage)
    │
    ▼
enqueueTeamAction(teamId, payload) → IndexedDB (status: 'pending')
    │
    ├─ offline → return (done, will replay on reconnect)
    │
    └─ online
           │
           ▼
       markTeamActionSyncing(clientActionId)  → status: 'syncing'
           │
           ▼
       api.postTeamAction(teamId, payload)
           │
           ├─ success → removeTeamAction()  + setTeamSyncedAt()
           └─ error   → markTeamActionFailed()  → status: 'failed'
```

Failures are surfaced in the sticky header (`!` indicator). Failed actions are NOT automatically retried — the user must manually retry or reload.

---

## WebSocket Event Handling

| WS event | Effect |
|----------|--------|
| `patient.updated` | Upserts/removes from `assignedPatients`; sets `highlightedFields` for changed fields (clears after 3 s) |
| `patient.created` | Prepends to `assignedPatients` if `assignedTeamId` matches |
| `team.message` | Appends to `messages` for messages from **other** teams; own-team echoes are dropped (message was already added optimistically on send) |
| `team.sector_assigned` | Sets/clears `sectorAssignments[teamId]`; displayed as a banner |

---

## Transition Diagram Summary (high-level)

```
App load
  └─ (restored from localStorage)
       ├─ selectedTeamId = null  →  show team picker
       └─ selectedTeamId = X    →  fetch workspace → show full UI

Team selected
  ├─ Status pill tapped  →  status picker sheet  →  status updated + queued
  ├─ ⚙ tapped  →  settings panel (transport / gear / contacts)
  └─ Patient row tapped
       ├─ Accordion expands
       ├─ Engagement picked  →  patientStatusMap updated + team status auto-derived
       ├─ "! Trenger bistand"  →  team status = needs_assistance (manual override)
       ├─ Vitals submitted  →  api.recordVitals() (no offline queue)
       └─ Note submitted  →  api.addPatientNote() (no offline queue)

Unassigned patient section
  └─ "På vei til pasient →"  →  handleSetPatientStatus(id, 'en_route_to_patient')
       → team status auto-derives to 'en_route'
       → patient promoted into combinedAssignedPatients via extras filter
```
