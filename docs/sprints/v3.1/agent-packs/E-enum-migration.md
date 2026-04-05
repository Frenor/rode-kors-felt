# Agent Pack E — Enum Canonicalization

## Scope
Ensure all enums are defined, stored, and rendered using English canonical values and mapped Bokmål labels.

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
1. `AmkCriticality`: define and use only `low|medium|high|critical` across shared types, API, and DB enums.
2. Persist the canonical English value in every action/event artifact.
3. Provide Bokmål labels in the view layer without rendering raw enums.
4. Renderer/test coverage ensures canonical inputs surface expected labels.

## Translation Mapping
# low -> Lav
# medium -> Middels
# high -> Høy
# critical -> Kritisk

## Tests Required
- Parser tests that send canonical values and assert English enums.
- UI rendering tests that verify Bokmål labels, without needing legacy inputs.

## Commit
`refactor(types): keep enums english-only and mapped in the UI`
