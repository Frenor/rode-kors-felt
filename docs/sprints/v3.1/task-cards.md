# RKF v3.1 Task Cards

## Rules
- One card per branch/commit.
- No cross-card scope expansion.
- Keep commits self-contained and reversible.

## Card 0 — Plan Gate
- Scope: write v3.1 docs and update PLAN.md.
- Output: `docs/sprints/v3.1/*` and `PLAN.md`.
- Commit: `chore(plan): add v3.1 distributed execution pack with english-enum policy`.

## Card 1 — Backend Team Workspace
- Scope: team action endpoint, workspace projection, sickbay incoming feed.
- Commit: `feat(api): add team workspace actions and sickbay incoming feed`.
- Tests: API unit/integration for 403, idempotency, critical reasons.

## Card 2 — First Aider Workspace UI
- Scope: active/monitored/unassigned sections, local resume, team status controls, sync banner.
- Commit: `feat(web): add first-aider patient workspace, resume, and field status controls`.
- Tests: web unit/integration for resume + offline banner.

## Card 3 — Sick Bay Clarity UI
- Scope: critical incoming panel + verb/action controls.
- Commit: `feat(web): improve sickbay patient flow clarity and critical incoming visibility`.
- Tests: panel behavior + action control coverage.

## Card 4 — Enum Migration
- Scope: English canonical enums and NB label mapping.
- Commit: `refactor(types): continue standardizing enums to english`.
- Tests: canonical parser and UI rendering coverage.

## Card 5 — QA + Pages Verification
- Scope: test matrix including pages-demo visibility checks.
- Commit: `test(e2e): cover first-aider resume and sickbay critical visibility including pages-demo`.

## Acceptance Per Card
- Changed files listed in PR description.
- Tests listed with pass/fail output summary.
- Known risks explicitly documented.
