# AGENTS.md - RKF Compact Orchestration

Use [docs/ai/COMPACT-PLAYBOOK.md](/Users/fredrik/Developer/rode-kors-felt/docs/ai/COMPACT-PLAYBOOK.md) as the canonical agent operating model.

## Required Defaults
1. Multi-agent for non-trivial work.
2. Cheapest capable model, low reasoning, parallel execution with disjoint ownership.
3. No backward compatibility unless explicitly requested.
4. `PLAN.md` is execution source of truth.
5. Small, isolated commits with frequent push.

## Agent Files (4-file setup)
1. `prompts/agents/backend-engineer.md`
2. `prompts/agents/frontend-engineer.md`
3. `prompts/agents/routing-matrix.md`
4. `prompts/agents/specialists-lite.md`

## Routing Source
Use `prompts/agents/routing-matrix.md` for all task-to-agent mapping.
Use `prompts/agents/specialists-lite.md` for QA/UX/DevOps/Product/Field-user overlays.

## Field-User Rule
Any blocker from `field-user` is P0 for release.
