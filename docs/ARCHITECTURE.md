# Architecture

StepUp is a Vite + React 19 + TypeScript single-page app. Everything the user creates lives in IndexedDB (Dexie). The only server code is one optional Vercel function for the AI weekly review.

```
src/
  db/          Dexie schema (v1–v3 + migrations), types, the exercise library, repo.ts (the hooks screens read from)
  lib/         Pure logic and small services: plan.ts + planning/ (generator), overload.ts (progression), workout.ts
               (session lifecycle), records.ts, xp.ts, consistency.ts, backup.ts, ics.ts, units.ts, format.ts …
  features/    Screen-sized building blocks: workout/ (set form, logged sets, dialogs), history/, plan/, onboarding/
  components/  Shared UI primitives (ui, forms, overlays), app shell, charts, update prompt, error boundary
  routes/      One file per screen; most are lazy-loaded
api/           weekly-review.ts, the only server code
shared/        Code used by both src/ and api/ (payload schema, rate limiter, output cleaner)
e2e/           Playwright specs (workout flows, onboarding, keyboard, offline, axe in both themes)
```

## Data flow
1. **Onboarding** produces a `Profile`; `generatePlan(profile)` returns a declarative `Plan` (exercises, sets, rep ranges, rest). Plans never hold weights.
2. **Starting a workout** copies the planned exercises into the `WorkoutSession` row (snapshot, order, swaps, position, rest end), so a reload or a plan edit never loses it.
3. **Logging** appends sets to the session; **finishing** runs one transaction: personal records, XP, and `exerciseState` (the last weight/reps/effort per exercise).
4. **Progression** (`suggestNextLoad`) reads `exerciseState`, never the plan, so what the person actually lifted drives the next suggestion.
5. **History, progress and consistency** are derived from `workoutSessions` and `personalRecords`.

## Boundaries
- Anything leaving the device goes through `buildWeeklyReviewPayload()`, which uses exercise IDs only; the server validates with the shared zod schema, resolves names itself and rate-limits.
- Backups are validated per table on import and applied in a single transaction.
- Custom exercises are kept in memory (loaded before first render) so exercise lookups stay synchronous; they never reach the AI server.

## Quality gates
`npm run check` (oxlint, strict `tsc`, Vitest with a coverage gate on `src/lib`, build), `npm run check:bundle` (size budgets), `npm run e2e` (Playwright + axe).
