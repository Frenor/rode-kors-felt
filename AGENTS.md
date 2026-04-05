# AGENTS.md - RKF Compact Orchestration

Use [docs/ai/COMPACT-PLAYBOOK.md](/Users/fredrik/Developer/rode-kors-felt/docs/ai/COMPACT-PLAYBOOK.md) as the canonical agent operating model.

## Required Defaults
1. Multi-agent for non-trivial work.
2. Cheapest capable model, low reasoning, parallel execution with disjoint ownership.
3. No backward compatibility unless explicitly requested.
4. `PLAN.md` is execution source of truth.
5. Small, isolated commits with frequent push.

## Routing Matrix
- UI: `frontend-engineer` + `ux-designer`
- API: `backend-engineer` (+ `frontend-engineer` if contract/UI impact)
- Full-stack: `frontend-engineer` + `backend-engineer` + `qa-engineer` (+ `ux-designer` if UX-impact)
- Infra/CI: `devops-engineer` + `backend-engineer`
- Usability: `ux-designer` + `field-user`
- Planning: `product-lead`

## Field-User Rule
Any blocker from `field-user` is P0 for release.
