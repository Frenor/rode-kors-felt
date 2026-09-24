# Presentation export

`index.html` is a self-contained page with the three RKF interfaces (field patrol, sick bay,
coordinator) prefilled with demo data and walked through one incident. Open it directly in a
browser — no server, build or network needed. Arrow keys move between screens; the notes column
says what to look at on each one. The screens are the app's real DOM with its own CSS and fonts
inlined, so text is crisp at any zoom; buttons are inert and the map is a picture.

Regenerate after UI changes (from the repo root):

```bash
VITE_DEMO_MODE=true VITE_BASE_PATH=/ pnpm --filter @rkf/web build
pnpm --filter @rkf/web exec vite preview --port 3200 &
pnpm --filter @rkf/web showcase:export
```

`SHOWCASE_CHROMIUM=/path/to/chromium` picks a system browser when Playwright's own download is
unavailable. Map tiles need network access at export time; without it the map shows markers on
a grey ground.
