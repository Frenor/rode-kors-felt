# Agent Pack D — Web Sick Bay Clarity

## Scope
Add critical incoming panel and clearer progression actions in Sick Bay.

## Files
- `apps/web/src/pages/SickBayDashboard.tsx`
- `apps/web/src/pages/SickBay/PatientActionButtons.tsx`
- `apps/web/src/pages/SickBay/PatientCard.tsx`
- `apps/web/src/pages/SickBay/IncomingCriticalPanel.tsx` (new)
- `apps/web/src/lib/api.ts`
- `apps/web/src/__tests__/...`

## Required Work
1. Render top panel `Kritisk innkommende na` from new incoming endpoint.
2. Show critical reasons and quick vitals summary.
3. Keep grouped status sections and collapsed closed cards.
4. Replace action labels with locked verb phrases.

## Locked Labels
- Start behandling
- Legg til observasjon
- Flytt til observasjon
- Skriv ut
- Overfor til AMK (SBAR)

## Tests Required
- Critical panel visibility and sorting.
- Action button labeling and action payload correctness.
- A11y checks for alert semantics and keyboard flow.

## Commit
`feat(web): improve sickbay patient flow clarity and critical incoming visibility`
