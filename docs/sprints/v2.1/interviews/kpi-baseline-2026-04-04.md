# KPI Baseline Capture (2026-04-04)

## Source
- Interview pack: Section B scenarios (`run-01` for all 5 personas)
- Population: first-aider, sickbay, coordinator, gis/infra, qa/release
- Build/ref: `web@2e175e1`, `api@2e175e1`
- Event type: indoor concert (scenario lab)

## KPI Collection Method (Executable)
1. `median_report_submission_seconds`
- Input: Scenario 1 durations from each run file.
- Values: `115, 110, 105, 90, 105` seconds.
- Method: sort ascending and take middle value (`n=5`).
- Result: `105`.

2. `median_amk_brief_ready_seconds`
- Input: Scenario 2 durations from each run file.
- Values: `205, 170, 160, 155, 165` seconds.
- Method: sort ascending and take middle value (`n=5`).
- Result: `165`.

3. `post_submit_correction_count_per_100_reports`
- Input: correction count for Scenario 1 (report submission) across all personas.
- Values: total corrections `1` over `5` report submissions.
- Method: `(total_corrections / total_reports) * 100`.
- Result: `(1 / 5) * 100 = 20`.

4. `indoor_location_clarity_percent`
- Input: Scenario 1 and 4 outcomes where location/map clarity is assessed (`2 checks x 5 personas = 10 checks`).
- Clear checks: `9`.
- Unclear checks: `1` (first-aider Scenario 4 krevde ekstra lag-bytte for tydelig etasjekontekst).
- Method: `(clear_checks / total_checks) * 100`.
- Result: `(9 / 10) * 100 = 90`.

## KPI Values
- median_report_submission_seconds: `105`
- median_amk_brief_ready_seconds: `165`
- post_submit_correction_count_per_100_reports: `20`
- indoor_location_clarity_percent: `90`

## Notes
- Baseline is captured from first complete 5-persona cycle.
- KPI targets remain unset until two release cycles are measured against this baseline.
