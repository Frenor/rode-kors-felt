# API Contracts (v3.1)

## POST /api/teams/:teamId/actions
Request body union:
1. `{ "type":"team.status_set", "status":"available|en_route|on_scene|needs_assistance|unavailable", "incidentId?":"uuid", "note?":"string", "clientActionId":"uuid" }`
2. `{ "type":"team.monitor_started", "patientId":"uuid", "clientActionId":"uuid" }`
3. `{ "type":"team.monitor_stopped", "patientId":"uuid", "clientActionId":"uuid" }`

Response:
- `{ "action": { ...actionEvent } }`

Validation:
- event mismatch -> 403
- malformed body -> 400
- duplicate `clientActionId` -> idempotent success

## GET /api/teams/:teamId/workspace
Response shape:
- `{ "teamId":"uuid", "eventId":"uuid", "latestStatus":"available|en_route|on_scene|needs_assistance|unavailable", "activePatientId":"uuid|null", "assignedPatients":[], "monitoredPatients":[], "unassignedPatients":[], "updatedAt":"iso" }`

Rules:
- `assignedPatients`: incident/team linked
- `monitoredPatients`: from team monitor action stream
- `unassignedPatients`: event patients not in assigned/monitored sets

## GET /api/events/:eventId/sickbay-incoming
Response item:
- `{ "incidentId":"uuid", "patientId":"uuid|null", "teamId":"uuid|null", "progressStage":"string", "critical":true|false, "criticalReasons":["needs_assistance"|"open_escalation"|"triage_immediate"|"news2_high"], "latestVitals":{}, "news2":{}, "triageTag":"immediate|delayed|minor|expectant|null", "updatedAt":"iso" }`

Critical Rule:
- `critical = true` if any reason exists.
