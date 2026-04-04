# Interview Run

## Metadata
- Persona: GIS/Infra Operator
- Participant ID: GIS-ANON-01
- Date: 2026-04-04
- Interviewer: Product Lead
- Observer: QA Observer
- Event type: Indoor concert (scenario lab)
- Build/Commit: web@2e175e1 api@2e175e1

## Scenario Results
- Scenario 1: `completed` | start `11:31:00` | end `11:32:30` | duration `90s` | corrections `0` | note: Innendors metadata levert korrekt via event-konfig.
- Scenario 2: `completed` | start `11:32:55` | end `11:35:30` | duration `155s` | corrections `0` | note: AMK-flyt fikk riktige konfigavhengigheter.
- Scenario 3: `completed` | start `11:35:55` | end `11:37:20` | duration `85s` | corrections `0` | note: Logg- og auditfelt verifisert.
- Scenario 4: `completed` | start `11:37:45` | end `11:39:25` | duration `100s` | corrections `0` | note: Kartstil og lag vises med sanitert token-flyt.
- Scenario 5: `completed` | start `11:39:50` | end `11:41:25` | duration `95s` | corrections `0` | note: Fallback oppforer seg forutsigbart ved kort nettutfall.

## Scores
- usability (1-5): 4
- efficiency (1-5): 5
- accuracy (1-5): 5

## Blockers
- blocker present (`true`/`false`): `false`
- blocker ID: `n/a`
- owner: `n/a`
- due date: `n/a`

## Notes
- Key findings:
  - Runtime map-config kontrakt er tydelig og robust.
- Recommended follow-up:
  - Legg til CI-validering for manglende etasje-lag i event-konfig.
