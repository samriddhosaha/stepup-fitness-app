# Phase 4 — polish and reach

Done:
- **PWA:** manifest `id`, `scope`, `lang`, `categories`, `shortcuts`, start at `/dashboard`, no orientation lock; light/dark `theme-color` metas that follow an explicit appearance choice; Android install button and iOS instructions (Profile); update prompt that never interrupts a workout (Phase 2); `cleanupOutdatedCaches`, `/api` excluded from navigation fallback; precache restricted to Latin font subsets (1,389 → 1,237 KiB).
- **Theme:** `public/theme-init.js` applies the cached appearance before first paint (no light flash).
- **Performance:** lazy routes, a bundle visualizer (`npm run analyze`), size budgets enforced by `npm run check:bundle` and CI, Map-based exercise lookups, date-index range queries in `repo.ts`, `appEvents` capped at 500, delete-everything uses `db.delete()` and clears the service worker, caches and `stepup-*` keys.
- **Tooling:** `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` on (only three fixes were needed); oxlint `correctness` + `suspicious` + `exhaustive-deps` (zero warnings); unused ESLint/PostCSS/Autoprefixer/@vitest/ui/playwright packages removed; Prettier configured (`npm run format`) with `.editorconfig`; data-access hooks in `src/db/repo.ts`; `WorkoutActive` and `Onboarding` split into feature modules.
- **Tests:** coverage gate (lines and statements ≥ 80 % on `src/lib`) enforced by Vitest; real invariants replaced the vacuous XP/plan assertions; tests added for consistency, records, workout lifecycle, backup, recap, format/timezones, notifications, the API handler, plan generation, onboarding, calendar export and the error log.
- **Extras:** `.ics` export of training days (Plan), Web Share of a workout summary, opt-in local error log (Profile), CSV export (Phase 1).
- **Repo hygiene:** LICENSE (MIT, a default; change it if you want another), CONTRIBUTING, ARCHITECTURE, four ADRs.

Deferred, in order of value: program templates beyond the generated plans, Strong/Hevy CSV import, i18n scaffolding (strings are still inline), a manual screen-reader pass, and `npm run format` across the existing files (Prettier is configured but the codebase has not been reformatted, to keep diffs reviewable).
