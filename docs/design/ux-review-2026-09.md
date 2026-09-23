# UX Review — Field teams, Sick Bay, Coordinator (September 2026)

Scope: the three web dashboards in `apps/web` as they stand after the field-trial remediation
(`9017c2c`). Reviewed by reading every screen and sub-component against three concrete situations:

| Persona | Situation the UI must survive |
|---|---|
| **Field team (first aider)** | Phone in one hand, patient in the other, gloves, rain, and it is dark. Needs one obvious next tap. |
| **Sick bay** | Tablet on a table in a tent, 4–10 patients at once, interrupted every minute. Needs help filling things in and remembering who is due. |
| **Coordinator** | Laptop, many things arriving at once. Needs to see *what needs a decision now*, in priority order, and act on it in one or two clicks. |

Severity: `P0` blocks the persona from doing their job under those conditions, `P1` makes it
slow or error-prone, `P2` polish. Status refers to branch `claude/sickbay-ux-review-x6ihme`.

The verdict up front: the data flows work (the field trial fixed those). What still fails is
**hierarchy and ergonomics** — the important things are small, the unimportant things are big,
and the same information is spread over several panels.

---

## 1. Cross-cutting

| # | Sev | Finding | Status |
|---|---|---|---|
| X1 | P0 | **10 px text everywhere.** `--text-xs` is `0.64rem` = 10.24 px and is used for the team status pill, patient position, GPS status, triage pills, every secondary label, chat timestamps (10 px hard-coded). `--text-sm` (12.8 px) is the *default* for body text and buttons. On a phone at night this is unreadable; 12 px is the floor most mobile guidelines set for secondary text, 16 px for body. | **Fixed** — `--text-xs` → 12 px, `--text-sm` → 14 px. Layouts use flex/grid and reflow. |
| X2 | P0 | **Theme choice is not remembered.** `AppShell` keeps the light/dark/auto choice in component state, so a first aider who switches to dark at dusk gets light mode back every time the PWA restarts (which on a phone is often). The toggle itself is a 20 px-high button showing `☀`/`☾`/`Auto`. | **Fixed** — persisted in `localStorage` (`rkf-theme`), applied before first paint from `main.tsx`, toggle is a 44 px labelled button (`Lys`/`Mørk`/`Auto`). |
| X3 | P1 | **Hard-coded light-mode colours.** Triage pills (`#fee2e2` / `#b91c1c`), engagement pills (`#fef3c7`, `#dbeafe`, `#dcfce7`), coordinator close button (`#dc2626`), map pin (`#0369a1`), "Lukket" badge (`#f1f5f9`/`#64748b`) are duplicated in five files and ignore dark mode. In dark mode they render as bright pastel blobs. | **Fixed** — `--color-triage-*` and `--color-engagement-*` tokens for light and dark in `tokens.css`, one `FIELD_TRIAGE_STYLE` / `TEAM_PATIENT_STATUS_STYLE` in `lib/constants.ts`, consumers updated. |
| X4 | P1 | **`.touch-target` is decorative.** The class sets `min-height: 56px`, but almost every button also sets an inline `minHeight: 32/36/44`, and inline wins. The glove requirement in the design tokens is therefore not enforced anywhere. | **Fixed** — `components/ui/Button` with sizes in CSS (xl 72 / lg 56 / md 48 / sm 44) that inline styles cannot undercut; every button on the three screens now uses it. |
| X5 | P2 | Emoji as icons (`⚙`, `📍`, `☀`, `☾`, `▲`). Rendering differs per OS, some are invisible in dark mode, none are glove-sized. | **Fixed** — `components/ui/Icon`, a 24 px stroke set in `currentColor`. |
| X6 | P2 | Up to four stacked bands above content on a phone: app header, demo banner, offline banner, WebSocket banner, sync banner. ~150 px before the first patient. | **Fixed** — the permanent sync band is gone (the team card already says "Alt sendt / 2 venter på sending"); offline and reconnecting share one strip that only appears while degraded; the header keeps the connection label on phones by making the theme and logout buttons icon-only there. |
| X7 | P1 | **Two reds mean two things.** Brand red (`#E8112D`) fills every "Lagre" and "Ny pasient"; critical red (`#B91C1C`) marks "Trenger bistand" and "Ring 113". On a phone they are the same colour, so the one button that calls for help does not stand out from a routine save. | **Fixed** — colour roles (design system §2): brand red for the one primary action per container, critical red only for help/danger/overdue, everything else neutral. Routine saves are now `secondary`. |
| X8 | P1 | **No pressed, hover or selected states.** Every control was an inline-styled `<button>` with no `:active` feedback. In the dark, with gloves, a tap that gives no response gets tapped again. | **Fixed** — `.btn` has pressed (scale + darker ground), hover on pointer devices, disabled and selected states; toggles use `aria-pressed`/`aria-checked` for both semantics and style. |
| X9 | P2 | **Mono used for words.** Section headings, pills, status text and timestamps were all IBM Plex Mono, so labels read as codes and nothing read as data. | **Fixed** — Sans for words, Mono (`.data`, tabular numerals) only for values, times, counts and codes. |
| X10 | P2 | Severity was colour-only (a small pill). Red patients could not be picked out of a list by shape or position. | **Fixed** — 4 px triage stripe on every patient card in all three views; critical edge on overdue/continuous cards. |
| X11 | P1 | **Too loud.** After the first two passes the screens still shouted: filled red on every card action, red-tinted panels with red borders and rings, 700-weight text on every control. | **Fixed** — filled brand red at most once per view; card actions in `ink`; "Ring 113" soft; critical panels keep a red edge on a white ground; 1 px borders, 600 weight, 4 px stripes; the expanded field card is framed neutral, not brand red. |

## 2. Field teams (first aider)

The single-scroll page has the right content but the wrong order and size. In practice the first
aider needs, in this order: *which patient am I on*, *tell everyone what I am doing*, *record what
I see*, *call for help*, *report a new one*.

| # | Sev | Finding | Status |
|---|---|---|---|
| F1 | P0 | **"Trenger bistand" is two taps deep and looks like every other option.** It is one of five identical 12.8 px rows in the status bottom sheet, or a button at the *bottom* of an expanded patient card. Nothing on screen tells the patrol that they currently *are* in needs-assistance except a 10 px pill. | **Fixed** — the status sheet shows "Trenger bistand" as a separate 64 px red button above the four normal states; a red banner under the team header shows while active with a one-tap "Avklart — ledig igjen". |
| F2 | P0 | **Team status pill is 10 px mono text, 32 px high, grey for every state except needs-assistance.** The most important state of the patrol is the least visible element in the header. | **Fixed** — 48 px pill, 14 px bold, colour-coded per state (ledig = green, på vei = blue, fremme = amber, trenger bistand = red, utilgjengelig = grey). |
| F3 | P0 | **Sticky team header slides under the app header.** Both are `position: sticky; top: 0`; the app header has the higher z-index, so after the first scroll the status pill and settings button are hidden. | **Fixed** — `top: 56px`. |
| F4 | P1 | **"Meld pasient" is at the bottom of the page.** With three own patients plus the unassigned list it is a long scroll away from the thing a patrol does most often on a new callout. The 2026 ideation doc says a tab bar solved this; that tab bar no longer exists in the code (removed in #51). | **Fixed** — the button (and its inline form) sits directly under the team header. |
| F5 | P1 | **Expanded patient card: four separate "Lagre" buttons (summary, position, vitals, note) before the status buttons.** The engagement status ("På vei / Transporterer / Overvåker") is the thing the coordinator is waiting for, and it is below three forms. | **Fixed** — order is now: engagement status (three 56 px buttons) → vitals → note → "Trenger bistand" → "Avslutt". Summary and position edits are behind one "Rediger sammendrag / posisjon" disclosure. |
| F6 | P1 | **Claiming an unassigned patient is a 32 px, 10 px-text outline button.** "På vei til pasient →" is the whole point of that list. | **Fixed** — full-width 56 px primary button. |
| F7 | P1 | **Distance to the patient is missing and the compass bearing is wrong.** `bearingTo()` feeds degrees into `Math.sin`/`Math.cos` (radians expected), so the N/NØ/… direction is essentially random. Distance is what a patrol on foot actually wants. | **Fixed** — bearing computed in radians; row shows "≈ 350 m NØ" (haversine) when both positions are known. |
| F8 | P1 | **"Avslutt pasient" demands free text.** Typing a sentence with gloves in the dark to close a patient is the wrong trade-off; the reason is almost always one of five. | **Fixed** — five reason chips (Overlevert sykestue, Overlevert ambulanse, Ferdig behandlet på stedet, Falsk alarm, Forsvunnet) + optional free text. |
| F9 | P1 | **Incoming chat is invisible.** The chat section is collapsed by default and the header only says "3 meldinger". A coordinator instruction sent to a patrol at night is not noticed. | **Fixed** — unread badge on the collapsed header, phone vibrates on an incoming message while collapsed, badge clears when opened. |
| F10 | P2 | **"Tildelte pasienter (5)" duplicates "Egne pasienter (2)".** The collapsed section lists own patients again with "(ditt lag)" plus other teams' patients. Three overlapping lists with similar names. | **Fixed** — renamed to "Andre lags pasienter" and only lists other teams' patients. |
| F11 | P2 | Vitals form gives no feedback on what the numbers mean; the sick bay sees a NEWS2 score, the patrol does not. | **Fixed** — live NEWS2 preview under the shared vitals form (see S4). |
| F12 | P2 | The whole patient list `<section>` is `aria-live="polite"`, so every re-render is read aloud by a screen reader. | **Fixed** — the list section lost its live region in the design pass; live regions now sit only on the sync text, the sector badge and the error lines. |
| F13 | P2 | No way to see own recorded vitals history in the field; after "Lagre" the numbers vanish. | **Fixed** — the team workspace now carries `latestVitals` for own and engaged patients; the collapsed row shows a NEWS2 pill and the vitals section opens with "Sist kl. 10:40 · Puls 96 · SpO₂ 94 % · … · NEWS2 2 · lav"; the card refreshes right after a save. |
| F14 | P2 | Vitals/notes from the field are not offline-queued (PLAN.md #16); the sync banner over-promises. | **Fixed** — vitals sets and notes recorded without network go into the same local queue as team actions (`patient.vitals_record`, `patient.note_add`), are counted in "venter på sending", and are replayed against the patient endpoints when the network returns. The toast says "lagret lokalt" rather than "lagret". Known limit: no server-side de-duplication for a replay that was in fact received. |

## 3. Sick bay

The card is dense and complete, but it does not help with the two things a busy clinician forgets:
*who is due for a new set of observations* and *what is the next step for this patient*.

| # | Sev | Finding | Status |
|---|---|---|---|
| S1 | P0 | **No visible "next observation due".** `scheduleMonitoringReminder` fires a toast from a `setTimeout` — lost on reload, invisible if it fired while you were with another patient, and nowhere on the card. Keeping track of 6 patients' re-assessment times is exactly the job the tool should do. | **Fixed** — every open card shows "Neste vurdering kl. 14:35 (om 12 min)" derived from the latest vitals timestamp + NEWS2 interval, turns red with "Forfalt for 5 min" when overdue, and overdue patients sort to the top of their group. Continuous-monitoring (NEWS2 ≥ 7) shows "Kontinuerlig overvåkning". |
| S2 | P1 | **The next step is hidden in a dropdown.** For an incoming patient the whole action is "Start behandling", but the user must spot a 10 px badge with a `▾`, open it and pick from a list. Copy also deviates from the locked v3.1 spec ("Observasjon" vs "Legg til/Flytt til observasjon"). | **Fixed** — incoming cards get a visible primary "Start behandling" button; the dropdown remains for the other transitions and uses the locked copy. |
| S3 | P1 | **Sort order ignores urgency.** Placement number sorts first, so chair 3 with NEWS2 2 sits above chair 12 with NEWS2 8. | **Fixed** — overdue/continuous first, then placement (walk order), then NEWS2. |
| S4 | P1 | **No feedback while entering vitals.** The score only appears after saving; a nurse cannot tell whether the set she is typing will trigger escalation. | **Fixed** — `VitalsEntryForm` shows a live "NEWS2 foreløpig: 6 · middels · ny vurdering om 1 time" line, plus which parameters are still missing. |
| S5 | P1 | **Intake accepts a completely empty form** and creates "Ukjent pasient". | **Fixed** — "Registrer" requires a name or a presenting complaint and says so. |
| S6 | P2 | Name and complaint are single-line ellipsised; the field description ("Falt i nedkjøringen, smerter i ankel") is the most useful context and gets cut at ~30 characters in a 3-column grid. | **Fixed** — wraps to two lines. |
| S7 | P2 | Editor pills (`✎ Plassering`, `✎ Pasientinfo`, `✎ Beskrivelse`) are 28 px high; "Medik." is an unclear abbreviation. | **Fixed** — 44 px, "Medisin". |
| S8 | P2 | `IncomingCriticalPanel` is `role="alert" aria-live="assertive"` on a container that re-renders on every refetch (every 400 ms burst). | **Fixed** — the panel is a labelled region; a visually hidden live element announces "Ny kritisk innkommende: <navn>" only for patient ids not seen before. |
| S9 | P2 | Non-critical incoming field patients (yellow/green, team en route) are not shown as "on their way" anywhere; only the `Innkommende` group after they exist as patients. | **Fixed** — field patients are already in `Innkommende`; what was missing was *who is bringing them*. Every open card and every critical row now shows the patrol and its engagement ("Delta · På vei", "Bravo · Transporterer"), live via `team.session_changed`. No ETA is shown because none is measured; inventing one would be a fake. |

## 4. Coordinator

The dashboard is a stack of independent panels: alerts, six counters, all teams, a chat log, then
patients and the map. There is no single place that answers *what needs me right now*.

| # | Sev | Finding | Status |
|---|---|---|---|
| C1 | P0 | **No priority queue.** Teams needing assistance live in one panel, unassigned patients are mixed into the patient list, deterioration alerts are a third panel. Prioritising "a lot of incoming and pending tasks" means scanning three places and mentally merging them. | **Fixed** — new `AttentionQueuePanel` ("Krever handling") at the top. By product decision it holds only red patients (red triage without a team, NEWS2 rising fast) and patrols asking for assistance, each with its action inline; yellow/green patients without a team are counted in one quiet line and handled in the patient list. |
| C2 | P0 | **Assigning a team is four interactions** (expand → Rediger → find "Tilordnet lag" → Lagre) and the assign control is buried among lat/lon inputs. This is the coordinator's most frequent action. | **Fixed** — inline "Tildel lag" select in the queue row and in the expanded patient row (no edit mode needed). |
| C3 | P1 | **Unassigned patients look like assigned ones.** No badge, no sort priority, no age ("meldt for 12 min siden" is only visible after expanding as an absolute time). | **Fixed** — "Ikke tildelt" badge, unassigned sort first within the same triage, relative age in the row. |
| C4 | P1 | **Deterioration alerts do not say who.** "↑ NEWS2 7, +3 poeng/t" with no name, team or location. | **Fixed** — label/team resolved from the patient list. |
| C5 | P1 | **Developer toggles in prime space.** "Kartmotor Leaflet / MapLibre" and "3D-presentasjon" take the map header; "API-nøkkel" sits next to the page title. | **Fixed** — map engine/3D moved into a collapsed "Kartinnstillinger" disclosure. API key stays (needed for AI triage) but is secondary. |
| C6 | P1 | **Fixed two-column grid** (`2fr 3fr`) with no breakpoint; on a tablet in portrait the patient list is ~300 px wide. | **Fixed** — single column under 960 px, map no longer sticky there. |
| C7 | P2 | Stats trend arrows are green for "up", including "Pasienter totalt" going up. Double-click-to-filter is wired to nothing. | **Fixed** — neutral arrow colour; dead handler removed. |
| C8 | P2 | Cannot acknowledge/clear a team's "Trenger bistand" or message a specific team from the dashboard (PLAN.md #17). | **Fixed** — the API already allowed `team.status_set` from the coordinator role. Team rows in the queue and in "Lag" carry "Melding" (opens the compose with that patrol chosen) and "Avklart", which asks once more ("Ja, sett Bravo ledig") before posting `available` with the note "Avklart av koordinator"; the patrol's phone follows via `team.status_changed`. |
| C9 | P2 | Team chat log is read-only for the coordinator; broadcast is not available from this screen although the ideation doc lists it. | **Fixed** — compose box with "Alle lag" or one patrol as recipient; messages carry `fromLabel: 'Koordinator'` and the stream shows "Koordinator → Alpha". A patrol only receives messages addressed to everyone or to itself. Realtime only: when the socket is down the message is not sent and the coordinator is told to use radio. |

---

## 5. What changed on this branch (summary for reviewers)

Design pass (second commit set) — see `docs/design/design-system-2026-09.md` for the plan:
- `components/ui/` (`Button`, `Pill`, `Icon`) and `styles/components.css`: the component vocabulary (X4, X5, X7, X8, X9, X10).
- Every screen migrated to it; sick bay status groups are columns under a coloured rule instead of boxed cards; patient cards carry a triage stripe.

First batch:

- `styles/tokens.css`: type floor raised (X1); triage + engagement colour tokens in both themes (X3). `styles/global.css`: responsive coordinator layout (C6).
- `lib/constants.ts`: `FIELD_TRIAGE_STYLE`, `TEAM_PATIENT_STATUS_STYLE`, `TEAM_OPERATIONAL_STATUS_STYLE`, `PATIENT_CLOSE_REASONS` (X3, F8).
- `lib/theme.ts` + `main.tsx` + `AppShell.tsx`: persisted theme, applied before first paint (X2).
- `lib/geo.ts`: `distanceMeters`, `bearingDegrees` (radians fix), `describeOffset` (F7); `PatientLocationRow` shows "≈ 350 m NØ fra deg".
- `lib/observation.ts` + `hooks/useNow.ts`: `nextObservationDue`, `describeObservationDue`, `formatRelativeAge` (S1, S3, C3).
- `FirstAiderDashboard.tsx`, `FirstAider/TeamStatusPickerSheet.tsx`, `PatientEngagementPicker.tsx`, `TeamChatSection.tsx`, `PatientLocationRow.tsx`: F1–F10.
- `SickBay/PatientCard.tsx`, `SickBayDashboard.tsx`, `SickBayHeader.tsx`, `VitalsEntryForm.tsx` (shared with the field, F11/S4), `PatientIntakeModal.tsx`, `PatientActionButtons.tsx`: S1–S7.
- `Coordinator/AttentionQueuePanel.tsx` (new, replaces `DeteriorationAlertsPanel.tsx`), `PatientManagementPanel.tsx`, `StatsGrid.tsx`, `TeamStatusPanel.tsx`, `CoordinatorDashboard.tsx`: C1–C7.
- Tests: `observation`, `geo`, `theme`, `AttentionQueuePanel`, `VitalsEntryForm`, `PatientCard.observation`, `PatientIntakeModal` unit tests; `pages-demo`, `local-full` and `coordinator-flow` e2e updated for the map settings disclosure, engagement buttons, close-reason chips, theme toggle, primary sick bay action and the NEWS2 preview.

## 6. Third pass (2026-09-23, after the calmer palette)

A fresh look at the three screens with the palette settled. Findings T1–T6 came from the
captures; everything else in this pass is the remaining backlog from section 1–4 (X6, F12–F14,
S8–S9, C8–C9), now fixed.

| # | Sev | Finding | Status |
|---|---|---|---|
| T1 | P1 | **Five sick bay actions in a two-column grid left "Logg" alone on a third row**, and "Ring 113" sat in the grid as if it were another toggle. | **Fixed** — "Ring 113" has a row of its own above a 2 × 2 grid of the four openers. |
| T2 | P1 | **Three "Rediger" rows per sick bay card** (Plassering, Pasientinfo, Beskrivelse) stacked to ~130 px of tertiary controls on every card; with six patients that is a screen of edit buttons. | **Fixed** — one 44 px "Rediger detaljer" disclosure; the three toggles appear when it opens. Card height at rest down by ~90 px. |
| T3 | P2 | **"Kartmotor: Leaflet" still sat above the map** after the engine controls were moved into "Kartinnstillinger" — a developer detail in the coordinator's primary view. | **Fixed** — the caption only appears when the map is not in its plain state (3D on, or a runtime fallback in use). |
| T4 | P2 | **Six stat tiles wrapped 5 + 1 on a tablet.** | **Fixed** — explicit 6 / 3 + 3 / 2 + 2 + 2 columns. |
| T5 | P2 | **The phone header showed a lone grey dot** with no label once the connection label was hidden at 480 px; "Logg ut" and "Auto" got the space instead. | **Fixed** — the label stays ("Demo", "Tilkoblet", "Frakoblet"); theme and logout are icon-only on phones with full accessible names. |
| T6 | P2 | **A message from the coordinator to one patrol reached every patrol** (the field client ignored `toTeamId`). | **Fixed** — filtered on the receiving side. |

Verification for this pass: 200 web unit tests, 87 API tests, `local-full` 8/8, `pages-demo` 1/1,
captures of all three screens in both themes.

## 7. Backlog (ordered)

1. Field: server-side de-duplication of replayed vitals/notes (a client id per reading).
2. Team chat history on reload (PLAN.md #15).
3. Move `components/ui` into `@rkf/ui`.
4. A lint rule that rejects raw `<button>` with inline `minHeight` outside `components/ui`.
