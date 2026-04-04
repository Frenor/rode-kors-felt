# Section D — AI Assist for 113/Handover (Implementation Spec)

## Objective
Provide AI-supported call drafting without removing clinician decision authority.

## API Contract (Exact)
- Action types:
  - `patient.amk_ai_draft_generated`
  - `patient.amk_ai_script_confirmed`
- `POST /api/patients/:id/amk-assist/draft`
  - Response keys (exact):
    - `criticality`
    - `rationale`
    - `sayFirst`
    - `spokenScript`
    - `sbarDraft`
  - `criticality` enum: `lav | middels | hoy | kritisk`
- `POST /api/patients/:id/amk-assist/confirm`
  - persists user-confirmed script as append-only artifact

## Safety Contract
- AI cannot change patient status.
- AI cannot trigger escalation.
- AI cannot trigger call actions.
- UI must require explicit confirmation for persistence.

## Runtime Contract
- Backend-managed provider using env:
  - `AI_PROVIDER`
  - `AI_MODEL`
  - `AI_API_KEY`
- If unavailable: deterministic fallback template response.

## UI Specification
- In AMK modal:
  - `Generer AI-forslag`
  - editable draft script field
  - `Bekreft script`
  - warning label: `AI-beslutningsstotte - kliniker avgjor`
- History:
  - separate entries for draft-generated and script-confirmed

## File Ownership (Implementation Lane)
- API:
  - `apps/api/src/routes/patients.ts`
  - `apps/api/src/__tests__/patients.test.ts`
- Web:
  - `apps/web/src/pages/SickBay/AmkBriefModal.tsx`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/pages/SickBay/PatientHistoryTimeline.tsx`

## Test Checklist
- Schema validation for draft response.
- Fallback response when AI config missing.
- Confirm endpoint persists only after explicit user action.
- History includes both AI artifacts.

## Done Criteria
- Clinician can generate, edit, confirm, and audit AI-assisted handover script.
