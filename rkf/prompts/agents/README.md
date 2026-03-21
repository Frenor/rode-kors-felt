# RKF Agent Team — Multi-Agent Structure

## Overview

This directory defines the AI agent team for the Røde Kors Felt project. Each file is a
self-contained agent prompt. When you need a specialist, paste the file's contents as the
agent's system prompt (or use the Agent tool with the file as context).

The **Product Lead** is the orchestrator. All other agents receive tasks from and report
back to the Product Lead. The Product Lead talks directly to the human stakeholder.

---

## Team Structure

```
Human Stakeholder
      │
      ▼
Product Lead        ← you talk to this agent
      │
      ├── UX Designer         prompts/agents/ux-designer.md
      ├── Frontend Engineer   prompts/agents/frontend-engineer.md
      ├── Backend Engineer    prompts/agents/backend-engineer.md
      ├── QA Engineer         prompts/agents/qa-engineer.md
      ├── DevOps Engineer     prompts/agents/devops-engineer.md
      └── Field User          prompts/agents/field-user.md
```

---

## Agent Roles at a Glance

| Agent | Primary Concern | Delivers |
|---|---|---|
| **Product Lead** | Vision, priorities, coordination | Sprint plan, user stories, decisions |
| **UX Designer** | Flows, accessibility, design tokens, Norwegian copy | Specs, a11y reports, copy review |
| **Frontend Engineer** | React 19 PWA, offline sync, state | Working components, PRs |
| **Backend Engineer** | Fastify API, Drizzle, WebSockets | API routes, schemas, migrations |
| **QA Engineer** | Test coverage, regression, a11y | Test plans, Vitest/Playwright suites |
| **DevOps Engineer** | Infra, CI/CD, observability | Terraform, Docker, GitHub Actions |
| **Field User** | Usability from the field crew perspective | Feedback, pain points, failure modes |

---

## How to Invoke Agents (Parallel-First)

**Default: launch multiple agents in parallel.** Do not invoke one agent at a time
when specialists can work simultaneously. For how to classify requests and select
agents, see the routing matrix in `rkf/CLAUDE.md`.

### Parallel Invocation via Claude Code Agent tool

Send a single message with multiple Agent tool calls — one per specialist:

```
# Example: full-stack feature → 4 agents in parallel

Agent tool call 1:
  subagent_type: general-purpose
  prompt: <contents of frontend-engineer.md> + non-negotiables + specific sub-task

Agent tool call 2:
  subagent_type: general-purpose
  prompt: <contents of backend-engineer.md> + non-negotiables + specific sub-task

Agent tool call 3:
  subagent_type: general-purpose
  prompt: <contents of ux-designer.md> + non-negotiables + specific sub-task

Agent tool call 4:
  subagent_type: general-purpose
  prompt: <contents of qa-engineer.md> + non-negotiables + specific sub-task
```

Collect all four responses, resolve any conflicts, then implement.

### When Sequential Invocation Is Acceptable

Only invoke agents one-at-a-time when there is a hard dependency:
- UX Designer spec must be finalised before Frontend Engineer implements pixel-perfect UI
- Backend Engineer schema must be agreed before QA Engineer writes seed scripts
- DevOps Engineer needs Backend Engineer's env var list before updating secrets config

In all other cases: **parallel first**.

### Escalation Protocol

- Any agent can flag a **blocker** back to the orchestrating Claude Code session.
- Resolve conflicts using priority order: Safety > Offline > Accessibility > GDPR > Performance > DX.
- A single Field User blocker is a **P0** — stops all work until resolved.

---

## Collaboration Rules

1. **One source of truth** — agents read from the codebase, not from memory.
2. **Norwegian first** — all user-facing strings must be in Norwegian Bokmål.
3. **Safety-critical defaults** — when in doubt, be more conservative (offline fallback,
   append-only writes, explicit error messages).
4. **Handoffs** — each agent produces a concrete artifact (file, PR, report, spec).
   No verbal-only handoffs.
5. **Field User has veto on UX** — if the Field User cannot complete a task during
   usability review, it is a P0 blocker regardless of engineering opinion.
