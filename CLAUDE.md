# CLAUDE.md - RKF Compact Runtime Guide

Use [docs/ai/COMPACT-PLAYBOOK.md](/Users/fredrik/Developer/rode-kors-felt/docs/ai/COMPACT-PLAYBOOK.md) as canonical policy.

## Runtime Rules
1. Prioritize `Safety > Offline > Accessibility > GDPR > Performance > DX`.
2. Use canonical target-state implementation (no compatibility layers unless requested).
3. Keep one logical change per commit and push frequently.
4. Update `PLAN.md` checkpoints for milestone-level changes.

## Environment Setup

If `node_modules` is missing (fresh clone or CI-like environment), install first:

```bash
pnpm install
```

Signs that install is needed: `vitest: not found`, `eslint: not found`, or similar `command not found` errors when running scripts.

## Pre-Commit Checklist

**Always run before committing:**

```bash
# 1. Lint (catches ESLint + Prettier violations — same as CI)
pnpm lint

# 2. Type-check
pnpm typecheck

# 3. Unit tests (vitest, runs in-process — fast)
pnpm test
```

**E2E tests — run when touching UI or routes:**

The e2e suite starts real dev servers automatically. Run from the repo root:

```bash
# Full local suite (code-entry, coordinator-flow, incident-flow, local-full)
pnpm --filter @rkf/web test:e2e -- --project=local-full

# Single spec
pnpm --filter @rkf/web test:e2e -- --project=local-full apps/web/e2e/local-full.spec.ts
```

**Available e2e projects:**
| Project | Specs | Requires |
|---|---|---|
| `local-full` | code-entry, coordinator-flow, incident-flow, local-full | local dev server (auto-started) |
| `pages-demo` | pages-demo | `PLAYWRIGHT_DEMO_BASE_URL` env var |
| `gce-prod-smoke` | gce-prod-smoke | `PLAYWRIGHT_GCE_BASE_URL` env var |

> `pages-demo` runs against the live GitHub Pages deployment (triggered by `pages.yml` after every push to `main`). Test it locally by building in demo mode and pointing Playwright at it:
> ```bash
> VITE_DEMO_MODE=true VITE_BASE_PATH=/ pnpm --filter @rkf/web build
> pnpm --filter @rkf/web exec vite preview --port 3200 &
> PLAYWRIGHT_DEMO_BASE_URL=http://127.0.0.1:3200 \
>   pnpm --filter @rkf/web exec playwright test --project=pages-demo
> ```

> `gce-prod-smoke` needs an external URL — skip locally unless testing a deployed env.

**What lint-staged does on commit:** runs `eslint --fix` + `prettier --write` on staged `*.ts/tsx` files. If it fails, fix with `pnpm lint:fix` then re-stage.

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
