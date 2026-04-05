# Agent Pack E — Enum Migration and Compatibility

## Scope
Migrate mixed-language enums to English canonical values with safe compatibility behavior.

## Files
- `packages/shared-types/src/index.ts`
- `apps/api/src/lib/ai-assist.ts`
- `apps/api/src/routes/patients.ts`
- `apps/web/src/lib/types.ts`
- `apps/web/src/lib/constants.ts`
- `apps/web/src/lib/demo-store.ts`
- `apps/web/src/lib/llm-triage.ts`
- tests in API and web

## Required Work
1. `AmkCriticality`: `low|medium|high|critical` in shared types.
2. API accepts legacy Norwegian aliases and normalizes to English.
3. Persist English value in new artifacts.
4. UI maps English enums to NB labels.
5. Timeline renderer handles legacy stored values gracefully.

## Translation Mapping
- low -> Lav
- medium -> Middels
- high -> Hoy
- critical -> Kritisk

## Tests Required
- Parser normalization tests.
- Backward compatibility for old payload inputs.
- UI rendering tests for both legacy and canonical values.

## Commit
`refactor(types): standardize enums to english with legacy normalization`
