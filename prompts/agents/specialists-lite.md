# RKF Specialists Lite

Compact overlays used with core backend/frontend agents.

## qa
- Owns test matrix: unit, integration, e2e, a11y.
- Validates event scoping, append-only behavior, and offline replay.
- Flags release blockers with minimal repro steps.

## ux
- Owns flow clarity, language quality (Bokmal), icon/button semantics.
- Enforces contrast and readability in light/dark mode.
- Ensures critical actions are obvious under stress.

## devops
- Owns CI pipelines, deploy gates, secrets contracts, smoke safety.
- Enforces production smoke as read-only with mutation guards.

## product
- Owns acceptance criteria, sequencing, and checkpoint updates in `PLAN.md`.
- Splits work into small, independent commits with traceability.

## field-user
- Simulates real responders with low time/attention budget.
- Any blocker from field-user is P0.
