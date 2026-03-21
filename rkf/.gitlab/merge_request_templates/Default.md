## Summary

<!-- What does this MR do? One paragraph max. -->

## Ticket

<!-- Link to the issue/ticket: e.g. DS-01, FE-04, BE-03 -->

## Type of Change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Accessibility improvement
- [ ] Design system update
- [ ] Infrastructure
- [ ] Documentation
- [ ] Chore / tooling

## Screenshots / Recordings

<!-- For UI changes: attach before/after screenshots or a short recording. -->
<!-- For dark mode: include screenshots in BOTH light and dark mode. -->

## Checklist

### Code Quality

- [ ] Conventional commit messages used
- [ ] No `console.log` or debug code
- [ ] No hardcoded secrets, URLs, or env-specific values
- [ ] TypeScript strict — no `any` types
- [ ] Small, focused commits (one logical change each)

### Testing

- [ ] Unit tests added/updated
- [ ] All existing tests pass
- [ ] Manual testing completed

### Accessibility (UI changes)

- [ ] Contrast ratio verified (≥ 4.5:1 text, ≥ 7:1 clinical data)
- [ ] Keyboard navigation works
- [ ] Screen reader tested (VoiceOver / NVDA)
- [ ] Touch targets ≥ 56px (mobile views)
- [ ] `aria-*` attributes on interactive elements
- [ ] No new axe violations
- [ ] Works in both light and dark mode

### Design (UI changes)

- [ ] Matches design spec / component spec
- [ ] Responsive across breakpoints (mobile 375px → desktop 1440px)
- [ ] Designer review requested

### API (backend changes)

- [ ] OpenAPI spec updated
- [ ] All queries scoped by eventId
- [ ] Validation with Zod schemas
- [ ] Error responses follow standard shape

### Documentation

- [ ] README updated if needed
- [ ] ADR written for architectural decisions
- [ ] Storybook stories added (UI components)

## Review Assignments

- **Team Lead:** @lead (required)
- **Domain reviewer:** <!-- @designer / @backend / @frontend / @devops / @qa -->
- **Designer:** <!-- @designer — required for all UI changes -->
