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

## Migration Table
| Domain | Legacy Value | Canonical Value |
|---|---|---|
| AMK Criticality | lav | low |
| AMK Criticality | middels | medium |
| AMK Criticality | hoy/hoy-like variants | high |
| AMK Criticality | kritisk | critical |

## Team Status Labels (NB)
| Enum | Label |
|---|---|
| available | Ledig |
| en_route | Pa vei |
| on_scene | Fremme pa stedet |
| needs_assistance | Trenger bistand |
| unavailable | Utilgjengelig |

## Compatibility Window
- API accepts Norwegian AMK criticality aliases temporarily.
- API persists normalized English value.
- UI rendering normalizes legacy values before label mapping.

## Verification Checklist
- No raw enum string rendered directly in UI.
- Shared types expose English unions only.
- API tests cover legacy input normalization.
