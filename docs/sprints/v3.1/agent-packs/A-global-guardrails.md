# Agent Pack A — Global Guardrails

## Mission
Prevent cross-lane regressions and enforce shared constraints.

## Must Enforce
- English enums in all code contracts.
- Norwegian Bokmal labels only in view layer mappings.
- Event-scope checks return 403 on forbidden access.
- Clinical append-only behavior remains unchanged.
- No automatic call/escalation side effects.

## Checklist
1. Scan shared types for non-English enum values.
2. Scan UI for raw enum rendering.
3. Verify new endpoints include event checks.
4. Verify no mutation endpoints update historical clinical rows.

## Output
- Compliance report with file references.
- Blocking issues marked P0/P1.
