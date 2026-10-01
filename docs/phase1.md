# Phase 1 — make the engine real

| ID | What changed |
|---|---|
| D-03 | Dexie `version(2)`: `exerciseState`, `settings`, `weeklyReviews` tables; `personalRecords.sessionId` index; upgrade backfills `exerciseState` from completed sessions and clears the dead `exercises` store. The exercise library now lives only in code (`getExerciseById` is a `Map` lookup). Migration test seeds a real v1 database and opens it at v2. |
| C-01 | `suggestNextLoad(planned, history, state, {unit})` does per-set double progression from the weight actually lifted (`exerciseState`), holds after one failed session, deloads ~10% after two in a row, uses its own estimate for swapped exercises, and progresses bodyweight work through reps. `warmupSets()` ramps from today's working weight in unit-native steps and hides when there is no load. |
| C-05 | `src/lib/units.ts` (`formatWeight`, `parseWeight`, grids, ranges) + `useUnit()`. Onboarding asks for the unit; the logger, warm-ups, PRs, volume/lift charts and body weight all convert at the edge. The AI payload stays in kg. |
| C-06 | Sessions persist `plannedSnapshot`, `exerciseOrder`, `swapMap`, `currentIndex`, `restEndsAt`, `plannedDayIndex`. Starting reuses only the same fresh (< 12 h) session; otherwise a resume / discard prompt. Dashboard *Resume workout* banner; the logger redirects instead of rendering `null`; rest timer derives from `restEndsAt` (survives reload, vibrates, optional chime in Profile); Screen Wake Lock during a workout. "Leave" is now Save & exit or Discard. |
| C-07 | A set needs reps; double taps are no-ops (`setIndex` must be next); `finishSession` is one idempotent transaction (PRs + XP + exerciseState) and refuses a session with nothing logged; "Finish early" asks first. PRs need a prior baseline (first log is silent), carry `kind` and `sessionId`; e1RM is only estimated for ≤ 12 reps. |
| C-08 | XP loss mechanic and dead XP types removed. Streak replaced by weekly consistency (`activeWeeksInARow`: any week with a workout counts, one empty week is forgiven). `xpIntoLevel` is clamped. Guide and reminder copy match. |
| D-01, D-02 | Backup v2 with zod validation per table, dry-run summary, confirmation, automatic safety download, input reset, size cap, v1 upgrade, atomic apply (failed import leaves data untouched). Export attaches the anchor, delays `revokeObjectURL`, uses Web Share where files can be shared. *Last backup* tracking, nudge after 10 workouts, CSV export, `navigator.storage.persist()` after the first finished workout with status in Profile. Backup code is a lazy chunk, so zod is not in the main bundle. |
| D-04 | Onboarding and ProfileEdit write profile + plan in one transaction with error UI; `logSet`/`finishSession`/`recordSkip` are transactional. |
| F-01, P-01 | Weekly review cache keyed by week + payload hash (`weeklyReviews`); fetched only when the *AI review* disclosure is opened or Refresh is tapped, at most every 6 h; 8 s timeout, skeleton, calm fallback. Consent copy names Google (Gemini API) and the host, and Profile can preview the exact payload. The install token is generated once and sent as `x-stepup-install`. |

## Audit scenarios

- **E1** (40 kg × 10 @ RPE 2 for several weeks): loads were 40 → 42.5 → 42.5 → 42.5 forever. Now 40 → 42.5 → 45 → 47.5 → 50 (kg) and 87.5 → 92.5 → 97.5 → 102.5 (lb). Covered by `overload.test.ts`.
- **E2 / E3** (injuries, exclusions, preferences, session length; beginner barbell compounds): **not addressed in this phase.** They are Phase 3 (plan generator v2). Until then the onboarding copy says plainly that the plan does not change for them.

## Found by running the app
- Finishing the last exercise redirected to the dashboard instead of the summary (the in-progress query went null before `navigate`). Fixed with a `finishingId` guard; `scripts/flow-resume.mjs` covers it.
- `Card` ignored `bg-*` overrides (highlight cards were white); fixed.

## Verification
`npm run check` green; `TZ=America/Los_Angeles` and `TZ=Pacific/Auckland` test runs green; `src/lib` line coverage ≈ 90 % (gate 80 %). Main JS 438.28 kB → 456.88 kB (+4.2 %); lazy `backup` chunk 95 kB.
