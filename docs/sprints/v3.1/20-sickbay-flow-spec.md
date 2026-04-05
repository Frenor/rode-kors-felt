# Sick Bay Flow Spec (v3.1)

## Goal
Make patient progression and critical incoming situations easy to scan under time pressure.

## UI Requirements
- Keep grouped patient sections by status.
- Keep closed cards visible and collapsed by default.
- Add top panel: `Kritisk innkommende na`.
- Each critical row includes:
  - incident/team reference
  - critical reasons
  - quick vitals summary
  - primary action CTA

## Status Action Copy (Locked)
- `Start behandling`
- `Legg til observasjon`
- `Flytt til observasjon`
- `Skriv ut`
- `Overfor til AMK (SBAR)`

## Accessibility
- Critical panel uses live region semantics.
- Actions are keyboard reachable and have explicit labels.
- Avoid color-only signaling.

## Data Contract Dependency
- Consumes `GET /api/events/:eventId/sickbay-incoming`.
- Uses `criticalReasons[]` from backend.

## Done Criteria
- Clinician can identify highest-risk incoming patient within one screen.
- Progression actions are explicit and understandable without domain memory.
