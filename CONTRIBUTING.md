# Contributing to RKF

## Git Branch Strategy

```
main              ← production-ready, protected, requires 2 approvals + CI green
  └── develop     ← integration branch, requires 1 approval + CI green
       ├── feature/fe-XX-description   ← frontend features
       ├── feature/be-XX-description   ← backend features
       ├── feature/ai-XX-description   ← AI integration features
       ├── design/description          ← design system work
       ├── fix/XX-description          ← bug fixes
       ├── chore/description           ← tooling, config, dependencies
       ├── infra/description           ← infrastructure changes
       ├── docs/description            ← documentation only
       └── spike/XX-description        ← time-boxed investigation
```

### Branch Naming

- Always lowercase, kebab-case
- Prefix with category: `feature/`, `fix/`, `chore/`, `infra/`, `docs/`, `design/`, `spike/`
- Include ticket ID where applicable: `feature/fe-04-auth-ui`
- Keep names short but descriptive

### Protected Branches

| Branch    | Approvals | CI Required | Force Push |
|-----------|-----------|-------------|------------|
| `main`    | 2         | Yes         | Never      |
| `develop` | 1         | Yes         | Never      |

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type       | Use for                                 |
|------------|-----------------------------------------|
| `feat`     | New feature                             |
| `fix`      | Bug fix                                 |
| `docs`     | Documentation only                      |
| `style`    | Formatting, no code change              |
| `refactor` | Code change that neither fixes nor adds |
| `perf`     | Performance improvement                 |
| `test`     | Adding or updating tests                |
| `chore`    | Build process, tooling, dependencies    |
| `ci`       | CI/CD configuration                     |
| `a11y`     | Accessibility improvement               |
| `design`   | Design system tokens, components, specs |

### Scopes

Use the package or app name: `web`, `api`, `shared-types`, `ui`, `infra`, `ci`

### Examples

```
feat(web): add AVPU selector component with glove-friendly targets
fix(api): prevent event data leaking across tenant boundaries
a11y(ui): ensure vitals display meets 7:1 contrast in dark mode
chore(ci): add Lighthouse performance budget gate
docs(adr): add ADR-002 offline sync strategy
design(ui): add status badge tokens for incident states
```

### Rules

- **One logical change per commit.** Don't mix a feature with a refactor.
- **Small commits.** If a diff is hard to review, split it.
- **No WIP on develop/main.** Use draft MRs or your feature branch.
- **Squash and merge** to develop. Merge commit to main (preserves history).

## Merge Request Process

### Opening an MR

1. Create branch from `develop`
1. Make your changes with focused commits
1. Push and open MR against `develop`
1. Fill in the MR template completely
1. Assign reviewers (Team Lead always + domain reviewer)
1. For frontend: Designer must be added as reviewer

### Review Checklist

Before requesting review, ensure:

- [ ] All CI checks pass locally (`pnpm lint && pnpm typecheck && pnpm test`)
- [ ] New code has tests (unit minimum, integration where applicable)
- [ ] Accessibility: no new axe violations, keyboard navigation works
- [ ] Storybook stories added/updated (UI components)
- [ ] OpenAPI spec updated (API changes)
- [ ] No `console.log` or debug code left
- [ ] No hardcoded secrets, URLs, or environment-specific values
- [ ] Norwegian language used for all user-facing strings

### Definition of Done

A ticket is complete when:

- Code reviewed and approved by Team Lead + domain reviewer
- Designer has approved (all frontend/UI tickets)
- All CI checks pass
- Deployed to staging and smoke-tested
- No new accessibility violations
- Documentation updated

## Code Standards

### TypeScript

- Strict mode enabled (`strict: true`)
- No `any` — use `unknown` and narrow
- Prefer `interface` over `type` for object shapes
- Export types from `@rkf/shared-types`

### React

- Functional components only
- Hooks for all state management
- `aria-*` attributes on all interactive elements
- All images require `alt` text
- All form inputs require visible labels (not just `placeholder`)

### CSS / Tailwind

- Design tokens via CSS custom properties (see `tokens.css`)
- Tailwind utilities for layout, tokens for colour/typography
- No inline styles
- Dark mode via `prefers-color-scheme` + `[data-theme]` override
- Minimum touch target: 56×56px for first aider views

### API

- OpenAPI spec first — implement to match
- All endpoints return consistent error shape
- All queries scoped by `eventId` (row-level security)
- Validation with Zod schemas (shared with frontend via `@rkf/shared-types`)

## Accessibility Standards

- **Target:** WCAG 2.2 AA minimum, AAA for clinical data
- **Contrast:** ≥ 4.5:1 body text, ≥ 7:1 vitals/alerts/AVPU
- **Touch targets:** ≥ 56×56px on mobile (glove operation)
- **Keyboard:** All interactive elements reachable and operable
- **Screen readers:** Semantic HTML, ARIA where needed, `aria-live` for alerts
- **Motion:** Respect `prefers-reduced-motion`
- **Testing:** axe-core in CI, manual screen reader pass per feature
