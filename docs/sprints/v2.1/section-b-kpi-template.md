# Section B — KPI Baseline Template

## Baseline Metadata
- Date: 2026-04-04
- Event type: [fill per interview]
- Build/ref: [git sha]
- Interviewer: [name]

## Locked Decisions Captured
- Indoor default is zone + floor.
- MapLibre-first coordinator map path.
- Custom map runtime config from infra/env.
- E2E matrix: local-full, pages-demo, gce-prod-smoke.
- 113 flow includes AI recommendation-only with explicit confirmation.

## KPI Fields
- `median_report_submission_seconds`
- `median_amk_brief_ready_seconds`
- `post_submit_correction_count_per_100_reports`
- `indoor_location_clarity_percent`

## Collection Method
- Use scenario timestamps from interview playbook.
- Use action_events for AMK and AI activity timestamps.
- Use incident payload audit to classify location clarity.

## Acceptance Target Bands
- Report submission time decreases from baseline.
- AMK brief prep time decreases from baseline.
- Correction edits decrease from baseline.
- Indoor clarity increases from baseline.

## Notes
- This template is baseline-only. Targets are ratified after first two release cycles.
