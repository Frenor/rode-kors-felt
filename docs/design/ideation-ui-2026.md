# UI Ideation 2026 — Rødt Kors Felt

## What the app does today

Rødt Kors Felt is a Progressive Web App supporting Norwegian Red Cross field medical operations at events. It has three main views:

### 1. First Aider Dashboard (mobile)
A single-scroll page used by first aiders in the field. It allows teams to:
- Select their patrol/team
- View sector assignments (pushed from coordinator)
- View patients assigned to them by the coordinator
- Manage an active patient workspace (vitals entry, activate/deactivate patient)
- Monitor a list of patients and view unassigned patients
- Set team operational status (available, en route, on scene, etc.)
- Configure transport mode and gear checklist
- Save contact numbers (phone + ISSI radio)
- Report new incidents (offline-queued)
- View recent incidents
- Send/receive team chat messages

### 2. Sick Bay (tablet)
Used by medical staff at the sick bay/field hospital:
- Patient intake and registration
- Triage colour assignment
- Vitals recording over time
- Patient status tracking (on scene → transported → at sick bay → handed over)

### 3. Coordinator Dashboard (desktop)
Used by the event medical coordinator:
- Real-time overview of all active incidents
- Map view of team GPS positions
- Team sector assignment
- Patient-to-team assignment
- Broadcast messages to all teams

---

## Areas of improvement

---

### Area 1: Navigation model (mobile)

**Problem:** The First Aider Dashboard is a single long scroll. On mobile, users must scroll through transport/gear/contacts/status controls to reach patient content and vice versa. Critical actions are buried.

#### Alternative A: Accordion sections (keep single scroll, collapse sections)
Wrap each logical group (patients, team settings, incidents, chat) in a collapsible accordion. Users expand what they need.

- ✅ Simple to implement
- ✅ No structural change
- ❌ Still requires scroll to find the right section
- ❌ Doesn't prioritise the most common action (patient work)

#### Alternative B: Fixed bottom tab navigation ✅ **IMPLEMENTED**
Split the dashboard into four full-page tabs behind a fixed bottom nav bar:
- **Pasienter** 🫀 — sector banner, assigned patients, active patient workspace (vitals)
- **Hendelser** 🚨 — report incident button, offline queue, recent incidents
- **Lag** 👥 — team selection, transport mode, gear checklist, contact numbers, field status
- **Chat** 💬 — team messaging

- ✅ Matches mobile UX patterns (iOS/Android tab bars)
- ✅ Zero-scroll to critical content; each tab is focused
- ✅ Badges signal pending action without requiring scroll
- ✅ Chat becomes first-class, not hidden behind a toggle
- ❌ Slightly more structural refactor needed

**Why B:** The primary use case is gloved-hand, high-stress field use. Tab navigation is the standard pattern for focused mobile contexts. The 64 px bottom bar is a familiar affordance that doesn't require any learning.

---

### Area 2: Patient workspace density

**Problem:** The active patient section and the team settings (transport, gear, contacts, status) are co-located in the same `<section>`. When a patient is active, users must scroll past team configuration to reach vitals entry.

#### Alternative A: Sticky "active patient" banner
Pin the active patient name + vitals shortcut at the top of the page, floating above the scroll, while keeping all other content below.

- ✅ Patient always visible
- ❌ Wastes vertical space when no patient is active
- ❌ Does not solve team-settings clutter

#### Alternative B: Tab-based content split ✅ **IMPLEMENTED**
Move team settings (transport, gear, contacts, status) entirely to the **Lag** tab. The **Pasienter** tab shows only patient-relevant content: sector banner, assigned patients, active patient workspace (vitals).

- ✅ Pasienter tab is clean and focused
- ✅ Lag tab is the "setup" tab visited infrequently during an event
- ✅ Directly follows from Area 1's tab navigation

---

### Area 3: No-team onboarding state

**Problem:** When no team is selected, the app shows a team picker and then shows the full empty dashboard. There is no guidance about what to do next.

#### Alternative A: Onboarding modal overlay
Show a bottom-sheet modal forcing team selection before the main UI becomes visible.

- ✅ Impossible to miss
- ❌ Blocks screen; feels heavy for an app used under time pressure
- ❌ Adds an extra tap for users who immediately know their team

#### Alternative B: Per-tab contextual guidance ✅ **IMPLEMENTED**
On the **Pasienter** tab with no team selected, show a quiet inline message: "Velg patrulje i Lag-fanen for å komme i gang." On the **Lag** tab with no team selected, show the team picker directly.

- ✅ Non-blocking; user can explore other tabs (e.g., Hendelser) without a team
- ✅ The team picker appears exactly where it makes semantic sense (Lag = Team)
- ✅ Minimal implementation delta

---

### Area 4: Chat discoverability

**Problem:** Chat is hidden behind a collapsible toggle ("Lagmelding ▼"). New messages are not visible unless the user scrolls down and expands the section.

#### Alternative A: Toast notifications for new messages
Show a brief toast / snackbar at the top of the screen when a new message arrives.

- ✅ Immediate visibility
- ❌ Toasts are disruptive in a focus-heavy field context
- ❌ Chat itself remains buried

#### Alternative B: Full chat tab with message badge ✅ **IMPLEMENTED**
Chat becomes its own **Chat** tab. The tab badge shows the total message count. When the user opens the Chat tab, they see the full message thread immediately (no toggle needed).

- ✅ Persistent badge keeps message count visible at all times
- ✅ No toggle needed; chat loads immediately on tab switch
- ✅ Full height for message thread improves readability

---

### Area 5: Incident reporting call-to-action

**Problem:** The "Meld hendelse" button is always rendered on the main scroll, even when a patient is being actively monitored. It competes visually with patient workflow.

#### Alternative A: Floating action button (FAB)
Place a persistent FAB (red cross icon, bottom-right) that navigates to the incident report form from any tab.

- ✅ Always one tap away
- ❌ Overlaps content in some scroll positions
- ❌ Accessibility concerns with FABs on small screens

#### Alternative B: Dedicated Hendelser tab with prominent CTA ✅ **IMPLEMENTED**
The "Meld hendelse" button is the first element in the **Hendelser** tab (full width, 80 px tall, brand-red). Queued offline incidents and the recent incident list follow.

- ✅ The CTA is first-touch on its tab — immediately reachable
- ✅ Badge on the Hendelser tab badge shows pending (offline) incidents, drawing attention when connectivity is lost
- ✅ Clean separation: "I'm currently treating a patient" vs "I'm reporting something new"

---

## Implementation status

| Area | Alternative implemented | Status |
|---|---|---|
| 1. Navigation model | B — Bottom tab nav | ✅ Done |
| 2. Patient workspace density | B — Tab split | ✅ Done |
| 3. No-team onboarding | B — Per-tab guidance | ✅ Done |
| 4. Chat discoverability | B — Full chat tab + badge | ✅ Done |
| 5. Incident CTA | B — Hendelser tab | ✅ Done |
