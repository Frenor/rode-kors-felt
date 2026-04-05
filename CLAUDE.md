# CLAUDE.md - RKF Compact Runtime Guide

Use [docs/ai/COMPACT-PLAYBOOK.md](/Users/fredrik/Developer/rode-kors-felt/docs/ai/COMPACT-PLAYBOOK.md) as canonical policy.

## Runtime Rules
1. Prioritize `Safety > Offline > Accessibility > GDPR > Performance > DX`.
2. Use canonical target-state implementation (no compatibility layers unless requested).
3. Keep one logical change per commit and push frequently.
4. Update `PLAN.md` checkpoints for milestone-level changes.

## Delegation
- Prefer parallel specialists in `prompts/agents/`.
- Default to cheapest capable model + low reasoning.
- Integrate, verify, and finalize centrally.
