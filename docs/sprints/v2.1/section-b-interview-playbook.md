# Section B — Interview Playbook and Scoring Rubric

## Goal
Run repeatable interviews that produce implementation decisions without interpretation drift.

## Session Setup
- Duration: 35-45 minutes per participant.
- Moderator roles:
  - Lead interviewer
  - Note taker
- Required artifacts:
  - scenario script
  - scoring sheet
  - blocker log

## Fixed Scenario Script
1. First-aider reports indoor incident with weak GPS.
2. Sick Bay prepares 113 handover with AMK brief.
3. Clinician logs AMK guidance and follow-up owner.
4. Coordinator validates map context and layer visibility.
5. QA validates that prod-smoke path is read-only.

## Data to Capture per Scenario
- Start time
- End time
- Completion status (`completed` or `failed`)
- Number of corrections needed
- Notes on confusion or delay

## Rubric (1-5 each)
- `usability`: ease of understanding and action flow.
- `efficiency`: time and effort to complete task.
- `accuracy`: correctness and completeness of recorded data.

## Blocker Rule
- If a field-user says they cannot safely complete a task, mark `blocker=true`.
- Any field-user blocker is P0 and must be fixed before release.

## Exit Criteria
- At least one interview per persona.
- Baseline scores logged.
- P0 blockers triaged with owner and due date.
