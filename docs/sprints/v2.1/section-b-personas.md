# Section B — Persona Catalog (Decision-Complete)

## Purpose
Provide fixed personas used by product, UX, QA, and implementation teams for feature decisions and validation.

## Persona 1: First Aider
- Context: mobile use in weather/noise/stress, gloves, intermittent network.
- Primary goals:
  - register incidents quickly
  - submit accurate vitals and findings
  - hand over to Sick Bay with minimal re-entry
- Pain points:
  - GPS drift in crowded indoor arenas
  - too many taps in high-pressure moments
- Critical failure modes:
  - wrong location context
  - delayed escalation due to unclear workflow
- Accessibility/ergonomics:
  - 56px touch targets
  - readable high-contrast clinical data
- Success signals:
  - faster report submission
  - fewer corrections after submit

## Persona 2: Sick Bay Clinician
- Context: tablet or desktop in treatment area, multitasking across patients.
- Primary goals:
  - rapid triage overview
  - precise 113 handover when escalation needed
  - auditable patient narrative
- Pain points:
  - fragmented notes before AMK calls
  - repeated manual phrasing under stress
- Critical failure modes:
  - incomplete 113 briefing
  - missing follow-up ownership
- Accessibility/ergonomics:
  - clear timeline hierarchy
  - keyboard + touch support
- Success signals:
  - reduced time-to-AMK-brief-ready
  - complete call logs for escalations

## Persona 3: Coordinator
- Context: desktop command view, high incident volume, role-level overview.
- Primary goals:
  - maintain operational picture
  - direct resources safely
  - present map context to command staff
- Pain points:
  - weak GPS indoors
  - inconsistent layer visibility across events
- Critical failure modes:
  - location ambiguity during multi-incident response
- Accessibility/ergonomics:
  - scalable overview map and readable status cues
- Success signals:
  - indoor incidents show clear zone/floor context

## Persona 4: GIS/Infra Operator
- Context: pre-event setup and deploy-time configuration.
- Primary goals:
  - provide correct map style/layers/tokens per event
  - keep credentials out of clients
- Pain points:
  - no unified runtime map config contract
- Critical failure modes:
  - broken map style or invalid token during event
- Accessibility/ergonomics:
  - predictable config validation and error messages
- Success signals:
  - event map-config endpoint reliably serves sanitized config

## Persona 5: QA/Release Operator
- Context: CI/CD and release checks across local/demo/prod targets.
- Primary goals:
  - verify critical flows and safety rules
  - prevent destructive production smoke tests
- Pain points:
  - environment-specific flakiness
  - unclear test ownership by target
- Critical failure modes:
  - write actions reaching production smoke
- Accessibility/ergonomics:
  - deterministic artifacts on failure
- Success signals:
  - all 3 Playwright targets runnable independently with clear reports

## Usage Rule
- Any field-user blocker discovered in interviews is P0 and blocks release.
