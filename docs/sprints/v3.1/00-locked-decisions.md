# Locked Decisions (v3.1)

## Product Decisions
- First aider active patient lock is local-client only.
- Relevant patients are assigned + monitored.
- Unassigned patients are visible but secondary.
- Team statuses in code are English enums.
- UI text is Norwegian Bokmal labels from mapping constants.

## Critical Incoming Decision
- Sick Bay marks incoming item as critical when any is true:
  - team status is `needs_assistance`
  - escalation is active
  - triage tag is `immediate`
  - NEWS2 alert level is high

## Naming Decisions
- AMK criticality enum values in code:
  - `low`, `medium`, `high`, `critical`
- Team operational status enum values in code:
  - `available`, `en_route`, `on_scene`, `needs_assistance`, `unavailable`

## Non-Goals
- No automatic call placement.
- No automatic escalation state changes.
- No replacement of append-only clinical history model.
