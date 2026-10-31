# Architecture

StepUp is a Vite + React 19 + TypeScript single-page app. Everything the user creates lives in IndexedDB (Dexie). The only server code is one optional Vercel function for the AI weekly review.

```
src/
  db/          Dexie schema (v1–v5 + migrations), types, the exercise library, the food library, repo.ts (the hooks screens read from)
  lib/         Pure logic and small services: plan.ts + planning/ (generator), overload.ts (progression), workout.ts
               (session lifecycle), records.ts, xp.ts, consistency.ts, backup.ts, ics.ts, units.ts, format.ts,
               health.ts + healthStore.ts (water, check-in, habits, body), nutrition.ts + nutritionStore.ts,
               wellbeing.ts (7-day averages), badges.ts, heatmap.ts, plates.ts, shareCard.ts …
  features/    Screen-sized building blocks: workout/ (set form, logged sets, dialogs, plate calculator, share picture),
               history/, plan/, onboarding/, health/ (Log tab cards), nutrition/, progress/ (heatmap, milestones)
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
6. **The daily log** (water, check-ins, habits, measurements, meals) lives in its own tables (schema v4 and v5) and never touches workout rows. Meals store the macros as eaten, so editing or deleting a custom food never rewrites history. Weigh-ins reuse `progressSnapshots` through `saveBodyWeight`, so Log and Progress share the one-reading-a-day rule.

## Boundaries
- Anything leaving the device goes through `buildWeeklyReviewPayload()`, which uses exercise IDs only; the server validates with the shared zod schema, resolves names itself and rate-limits. Nutrition, recovery and water averages are an extra, separately consented section that is absent unless switched on (ADR 0005).
- Backups are validated per table on import and applied in a single transaction. The daily-log and nutrition tables are optional in the file, so a backup from before they existed still restores. The `settings` table (install token, reminder bookkeeping, plate bar) is never exported.
- Custom exercises are kept in memory (loaded before first render) so exercise lookups stay synchronous; they never reach the AI server.

## Quality gates
`npm run check` (oxlint, strict `tsc`, Vitest with a coverage gate on `src/lib`, build), `npm run check:bundle` (size budgets), `npm run e2e` (Playwright + axe).
