# RKF v2.1 Execution Pack (Sections B-F)

This folder is the implementation handoff pack for parallel delivery with low-capability coding agents.

## Workstreams
- `section-b-personas.md`
- `section-b-interview-playbook.md`
- `section-b-kpi-template.md`
- `section-b-scoring-sheet.md`
- `section-b-blocker-log.md`
- `task-cards.md`
- `section-c-amk-workflow.md`
- `section-d-ai-assist.md`
- `section-e-indoor-map.md`
- `section-f-e2e-matrix.md`

## Parallel Start Order
1. Start B, C, and E in parallel.
2. Start D when C API contracts are available.
3. Start F once C/D/E contracts are frozen.

## Contract Freeze Rule
- Before cross-lane integration, each lane publishes:
  - request and response examples
  - event scoping behavior
  - failure-mode behavior
  - test cases for happy path and safety path

## Shared Non-Negotiables
- Append-only clinical artifacts.
- Event-scoped access checks.
- Offline-first client writes.
- No automatic AI-triggered call/escalation action.
- Norwegian Bokmal user-facing text.
