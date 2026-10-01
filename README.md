# StepUp

A personal trainer that lives in your phone. A local-first strength-training tracker: no account, no server, and no data leaving the device unless you explicitly opt in.

## What it does

- **A plan built around you.** Eleven quick questions (or a three-question quick start) produce a weekly plan from a library of 94 exercises. It respects your equipment, level, goal, time, training days, injuries and anything you'd rather not do.
- **Real progressive overload.** The first time you do a lift you pick the weight. After that StepUp suggests your next weight from what you actually lifted: add load when every set tops the rep range, hold when it was heavy, deload after two tough sessions.
- **A logger that gets out of the way.** Weight and reps, timed holds with a stopwatch, or minutes and distance. Edit, delete and undo sets, see last time's numbers, and use a rest timer that survives reloads. A workout resumes exactly where you left it.
- **History and progress.** Day-by-day detail, per-exercise history, personal bests, body weight with a 7-day average, weekly volume and sets per muscle. Every chart has a data table.
- **Calm consistency.** Weekly consistency instead of streaks, optional XP that never goes down, and no pressure.
- **Your data stays yours.** Everything is stored in IndexedDB. Export a backup or a CSV, import with a preview, add your workout days to a calendar. Works offline and installs as an app.
- **Optional AI weekly review.** Off by default. See below.

## Stack

Vite 8, React 19, TypeScript (strict), Tailwind CSS v4, React Router 7, Dexie 4 (IndexedDB), Recharts, vite-plugin-pwa, and one optional Vercel function (Gemini).

## Getting started

```bash
npm install
npm run dev            # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run check` | lint + typecheck + unit tests + build |
| `npm test` | Vitest (unit and database tests); `npm run test:watch` to watch |
| `npm run e2e` | Playwright + axe against the production build (first run: `npx playwright install chromium`) |
| `npm run check:bundle` | enforce the bundle-size budgets (run after a build) |
| `npm run analyze` | build and write `dist/stats.html` to inspect the bundle |
| `npm run lint` / `npm run typecheck` | oxlint / `tsc -b` |
| `npm run format` | Prettier |

CI (`.github/workflows/ci.yml`) runs the same checks plus the end-to-end suite.

## Optional AI weekly review

Off by default and opt-in from Profile. To try it locally with `vercel dev`, or after deploying to Vercel:

```bash
cp .env.example .env
# fill in GEMINI_API_KEY and, if you like, the other variables in that file
```

The request carries only exercise IDs and aggregates (the exact payload can be previewed in Profile). The server validates the payload, checks the origin, rate limits per IP, install token and day, and returns generic errors. Without a key, or if the service is unavailable, the app shows a local, rules-based recap instead; the AI never blocks the core app.

## Deploying

`vercel.json` provides the single-page-app rewrite and security headers (CSP and friends). Set the variables from `.env.example` in your Vercel project. The function imports use `.js` extensions for Vercel's ESM output; verify the first deploy.

## Project layout

```
src/db/          Dexie schema and migrations, types, exercise library, data hooks (repo.ts)
src/lib/         Plan generator, progression, workout lifecycle, backup, units, and other pure logic
src/features/    Workout logger, history, plan editing, onboarding
src/components/  Shared UI, app shell, charts, update prompt
src/routes/      One file per screen (most lazy-loaded)
api/, shared/    The optional server function and the code it shares with the client
e2e/             Playwright specs
docs/            Architecture, ADRs, and per-phase notes
```

Read `docs/ARCHITECTURE.md` for the data flow and `docs/adr/` for the decisions behind it. `AUDIT.md` is the review this work follows, and `docs/phase0.md` to `docs/phase4.md` record what changed.

## Design

Plain black and white with a single red for errors and destructive actions. Type is Inter with IBM Plex Mono for labels. Tokens live in `src/index.css` as CSS custom properties mapped into Tailwind's `@theme`; `src/lib/contrast.test.ts` checks every text and background pair against WCAG AA in both themes.

## Contributing

See `CONTRIBUTING.md`. Weights are stored in kg, dates are local `YYYY-MM-DD`, copy stays calm, and bug fixes start with a failing test.

## License

MIT, see `LICENSE`.
