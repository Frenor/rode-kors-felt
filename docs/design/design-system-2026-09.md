# RKF Design System — v1.2 (September 2026 design pass)

Companion to `docs/design/ux-review-2026-09.md`. The review says what was wrong per persona;
this document is the design plan the fixes are derived from, and the rules that keep the next
screen consistent with them. Tokens live in `apps/web/src/styles/tokens.css`, the component
vocabulary in `apps/web/src/styles/components.css` and `apps/web/src/components/ui/`.

## 1. Subject and stance

Three surfaces, one subject: Norwegian Red Cross event medicine. The world of the subject is
what the visual language borrows from, as content, not ornament: START/SIEVE triage colours,
NEWS2 scores and re-assessment intervals, ISSI radio numbers, sectors and kilometre marks,
chair and bed numbers. Nothing on a screen should need the user to learn a metaphor.

Treatment: utilitarian and quiet. The only bold thing on any screen is the thing that matters
most on that screen. Everything else is neutral so the bold thing can be seen from across a
tent, in the rain, through a wet glove.

## 2. Colour roles

The palette already exists (DS-01 tokens, Red Cross red, blue-biased neutrals, AAA clinical
tokens). What was missing was a rule for *what each colour means*. Two reds were competing:
brand red (`#E8112D`) on every "Lagre", and critical red (`#B91C1C`) on "Trenger bistand".
On a phone they are the same colour.

| Role | Token | Means | Used for |
|---|---|---|---|
| **Brand** | `--color-brand` | "This is the main thing to do here." | Exactly one primary action per container: Meld pasient, Registrer pasient, Start behandling, Lagre vitale tegn inside an open vitals form, Tildel lag. |
| **Critical** | `--color-status-critical` | "Danger, help, or something is overdue." | Trenger bistand, Ring 113, Bekreft avslutning, overdue re-assessment, teams in needs-assistance, NEWS2 rising. Never on a routine save. |
| **Warning / OK / Info** | `--color-status-*` | Operational state. | Team status pills (på vei = info, fremme = warning, ledig = ok), unassigned patient badge (warning), incoming (warning). |
| **Triage** | `--color-triage-*` | Patient severity from the field. | Triage pills and the card stripe. Same values in the field, sick bay and coordinator. |
| **Engagement** | `--color-engagement-*` | What a patrol is doing with a patient. | På vei / Transporterer / Overvåker pills and chips. |
| **Neutral** | surface, border, text-* | Everything that is not one of the above. | Secondary buttons, disclosures, inputs, chrome. |

Semantic colour is never the accent and the accent is never semantic. A neutral button with a
strong border is the default; colour is spent, not sprinkled.

## 3. Type roles

Two faces, strict jobs.

| Face | Role | Where |
|---|---|---|
| IBM Plex Sans | Words. | Headings, labels, buttons, pills, body, section labels (12 px, 700, 0.06 em tracking, uppercase). |
| IBM Plex Mono | Data. | Vital values, NEWS2 scores, clock times, counts, ISSI numbers, GPS accuracy, "for 3 min siden". Always with `font-variant-numeric: tabular-nums`. |

Mono had crept into section headings, pills and status text. A mono word reads as a code; a
mono number reads as a measurement. Only the second is wanted.

Scale (unchanged from the review): 12 / 14 / 16 / 20 / 25 / 31 / 39 / 49 px. 12 is the floor.
Body 16. Buttons 14 (md) or 16 (lg). Headings `text-wrap: balance`.

## 4. Space and shape

4 px grid via `--space-*`. Cards `--radius-md` (8), sheets `--radius-lg` (12), pills full.
Sibling groups use flex/grid `gap`, not per-element margins. Section labels sit 8 px above
their content, sections 16 px apart, page gutter 16 px.

Shape encodes role:

- **Severity stripe.** Patient cards carry a 5 px left border in the triage colour
  (`.card--stripe`). Red patients are found by shape and position before anything is read.
- **Critical ring.** A card whose patient is overdue or on continuous monitoring gets the
  critical border and ring (`.card--critical`).
- **Groups are not cards.** Sick bay status groups are columns under a heading and a rule,
  not boxes inside the page. Borders are spent on the patient cards only.

## 5. Component vocabulary

All in `components/ui/`. Sizing lives in CSS classes so a caller cannot undercut the glove
minimum with an inline `minHeight`.

**Button** (`variant` × `size`)

| Variant | Meaning |
|---|---|
| `primary` | The one main action in its container (brand). |
| `danger` / `danger-soft` | Help, irreversible, or escalation (critical). |
| `secondary` | Saves, opens, edits. Neutral, bordered, high contrast. |
| `outline` | Brand-coloured secondary for a "go" action next to a primary (Naviger hit). |
| `ghost` | Cancel, dismiss, tertiary. |
| `tone` | A chip that carries its own colour (triage, engagement, close reason). |

Sizes: `xl` 72 (the page CTA), `lg` 56, `md` 48 (default), `sm` 44 (dense tablet rows).
Every button has a pressed state (`:active` scale 0.98 + darker ground) and a hover state on
pointer devices; a tap in the dark must visibly land.

**Pill** — sans, 12 px bold, tone from the `*_STYLE` maps, optional dot for statuses.

**Icon** — 24 px grid, 2 px round strokes, `currentColor`, decorative unless `label` is set.
Replaces every emoji and dingbat (⚙ ▲ ▼ ✓ ✕ 📍 ⏰), which rendered differently on each phone
and vanished in dark mode.

**Disclosure** — a 44 px neutral row with a chevron for collapsed secondary content
(Rediger sammendrag / posisjon, Andre lags pasienter, Kartinnstillinger).

**Field** — 48 px inputs; `.field--data` for numbers (mono, centred, 20 px).

## 6. Per-screen hierarchy

**Field (phone, dark).** Top to bottom: team + status pill → *needs-assistance banner when
active* → Meld pasient (xl, brand) → own patients (stripe cards; expanded card leads with the
three engagement chips) → unassigned (stripe cards with a lg primary "Vi drar til denne
pasienten") → other teams / closed (disclosures) → chat. The status sheet separates the red
"Trenger bistand" (xl, danger-soft) from the four routine states.

**Sick bay (tablet).** Header with the two counts that matter (overdue, continuous) → critical
incoming → three columns by status. Card: stripe + name + complaint → due line → last vitals
→ primary next step → five equal action buttons → three secondary edit buttons.

**Coordinator (laptop).** Krever handling (critical ring, each row with its decision inline)
→ counters → patients + teams + messages beside the sticky map. Map engine and 3D are
settings, behind a disclosure.

## 7. Rules for the next screen

1. One brand-red control per container. If you need a second, one of them is secondary.
2. Critical red only for help, danger, or overdue. Never for a save.
3. Words in Sans, numbers in Mono. Labels are never mono.
4. No control below 44 px; field controls 48–56 px. Use `Button`, never a raw `<button>` with inline size.
5. Severity by shape (stripe, ring, pill), not by colour alone.
6. Icons from `Icon`; no emoji, no dingbats.
7. Both themes, always: every colour is a token defined on `:root` and redefined in both dark blocks.
