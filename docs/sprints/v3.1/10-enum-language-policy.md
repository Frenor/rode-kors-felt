# Enum Language Policy (v3.1)

## Rule
All enums in code, API, storage, and test fixtures must be English.
All user-visible labels must be translated in view-layer mapping.

## Scope
- `packages/shared-types`
- API route validators/parsers
- DB enum definitions and migration scripts
- WebSocket payload contracts
- Demo fixtures and tests

## Team Status Labels (NB)
| Enum | Label |
|---|---|
| available | Ledig |
| en_route | Pa vei |
| on_scene | Fremme pa stedet |
| needs_assistance | Trenger bistand |
| unavailable | Utilgjengelig |

## Canonical Values
| Domain | Allowed Values |
|---|---|
| AMK Criticality | `low`, `medium`, `high`, `critical` |
| LLM Triage Level | `low`, `medium`, `high`, `critical` |

## Verification Checklist
- No raw enum string rendered directly in UI.
- Shared types, validators, and fixtures expose English unions only.
- API tests ensure only canonical values are accepted and labeled.
