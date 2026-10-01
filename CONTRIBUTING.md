# Contributing

StepUp is a local-first strength-training PWA. Before changing anything, read `CLAUDE.md` (the principles) and `docs/ARCHITECTURE.md`.

## Ground rules
- **Local-first.** No accounts, no analytics, no new network calls beyond the opt-in AI coach.
- **Weights are stored in kg**; convert only at the UI edge. **Dates are local `YYYY-MM-DD`**; never `new Date(dateOnlyString)` (use `parseISODateLocal`).
- **Calm voice.** No exclamation points, no streak-shaming, no hype. New copy should sound like "Nothing to prove today. Just begin."
- **Bug fixes are test-first**: write the failing test, then fix.
- Keep dependencies out unless they earn their place; say why in the commit body.

## Workflow
```bash
npm ci
npm run dev          # http://localhost:5173
npm run check        # lint + typecheck + unit tests + build
npm run check:bundle # size budgets
npm run e2e          # Playwright + axe against the production build (first run: npx playwright install chromium)
```
Commits are small and described like `fix(C-01): …`, `feat(…)`, `chore(…)`; the IDs refer to `AUDIT.md`.

## Where things live
See `docs/ARCHITECTURE.md`. Decisions with lasting consequences are recorded in `docs/adr/`.
