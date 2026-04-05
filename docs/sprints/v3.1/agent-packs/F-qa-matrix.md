# Agent Pack F — QA Matrix and Pages Verification

## Scope
Build and run tests for lanes 1-4, including GitHub Pages preview visibility checks.

## Required Test Layers
1. Unit
2. Integration
3. E2E local-full
4. E2E pages-demo
5. E2E gce-prod-smoke (read-safe)

## Mandatory Scenarios
- First aider: monitor -> reload -> resume -> status updates.
- Sick Bay: critical incoming panel appears with reason and vitals.
- Enum rendering: no raw English/legacy enum leakage in user-facing text.
- Event isolation: forbidden cross-event returns 403.

## Pages Preview Verification
- Assert new UI markers exist in pages-demo target:
  - critical incoming panel
  - first aider workspace sections

## Artifacts
- Traces/screenshots/html reports for failing tests.

## Commit
`test(e2e): cover first-aider resume and sickbay critical visibility including pages-demo`
