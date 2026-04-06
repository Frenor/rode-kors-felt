# CLAUDE.md - RKF Compact Runtime Guide

Use [docs/ai/COMPACT-PLAYBOOK.md](/Users/fredrik/Developer/rode-kors-felt/docs/ai/COMPACT-PLAYBOOK.md) as canonical policy.

## Runtime Rules
1. Prioritize `Safety > Offline > Accessibility > GDPR > Performance > DX`.
2. Use canonical target-state implementation (no compatibility layers unless requested).
3. Keep one logical change per commit and push frequently.
4. Update `PLAN.md` checkpoints for milestone-level changes.

## Delegation
- Prefer parallel specialists in `prompts/agents/` with `routing-matrix.md` + `specialists-lite.md`.
- Default to cheapest capable model + low reasoning.
- Integrate, verify, and finalize centrally.

## Error Handling Philosophy: Fail Loud, Never Fake

Prefer a visible failure over a silent fallback.

- Never silently swallow errors to keep things "working."
  Surface the error. Don't substitute placeholder data.
- Fallbacks are acceptable only when disclosed. Show a
  banner, log a warning, annotate the output.
- Design for debuggability, not cosmetic stability.

Priority order:
1. Works correctly with real data
2. Falls back visibly — clearly signals degraded mode
3. Fails with a clear error message
4. Silently degrades to look "fine" — never do this
