# Section C — Sick Bay 113 Workflow (Implementation Spec)

## Objective
Make 113 escalation fast, structured, and auditable in one Sick Bay flow.

## API Contract (Exact)
- Action type: `patient.amk_call_logged`
- `POST /api/patients/:id/amk-calls`
  - Required fields: `summaryGiven`, `amkGuidance`, `followUpOwner`
  - Optional: `referenceId`, `eta`, `calledAt`
  - Response: `{ callLog, action }`
- `GET /api/patients/:id/amk-calls`
  - Response: `{ callLogs }` sorted newest-first

## Data Semantics
- Append-only storage in `action_events`.
- No update/delete AMK endpoints.
- Event scoping enforced on read and write.

## UI Specification
- Patient card:
  - action button `Ring 113`
- AMK modal order (must remain fixed):
  1. patient context
  2. latest NEWS2 and trend
  3. latest interventions
  4. key findings
  5. recommended escalation language
- Call actions:
  - primary: `tel:113`
  - fallback: copy number + explicit instruction when `tel:` unsupported
- Logging form:
  - same modal, validated required fields before submit
- Timeline:
  - AMK call logs rendered as dedicated row type, not generic note

## File Ownership (Implementation Lane)
- API:
  - `apps/api/src/routes/patients.ts`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/__tests__/patients.test.ts`
- Web:
  - `apps/web/src/pages/SickBay/PatientCard.tsx`
  - `apps/web/src/pages/SickBay/PatientActionButtons.tsx`
  - `apps/web/src/pages/SickBay/PatientHistoryTimeline.tsx`
  - `apps/web/src/pages/SickBayDashboard.tsx`
  - `apps/web/src/lib/api.ts`

## Test Checklist
- API validation rejects missing required fields.
- API rejects eventId mismatch.
- Timeline shows new AMK event rows.
- UI supports both tel and fallback path.

## Done Criteria
- Clinician can open AMK brief, trigger call, log structured output, and view history entry.
