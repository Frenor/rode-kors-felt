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

## How to Invoke an Agent

### Via the Claude Code Agent tool

```
Use Agent tool with:
  subagent_type: general-purpose
  prompt: <contents of the agent file> + "\n\n---\n\nTask:\n" + <your task>
```

### Via the Claude Code CLI

```
/agent prompts/agents/frontend-engineer.md
```

### Escalation Protocol

- Any agent can flag a **blocker** back to the Product Lead.
- The Product Lead decides priority and re-assigns or resolves.
- The Field User is invoked by the Product Lead for usability reviews — never directly
  by engineers.

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
