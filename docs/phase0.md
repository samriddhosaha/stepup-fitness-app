# Phase 0 — stop the bleeding

| ID | Change |
|---|---|
| S-01, S-02 | `/api/weekly-review`: zod schema (`shared/weeklyReviewSchema.ts`), exercise IDs resolved server-side, origin allowlist (`ALLOWED_ORIGINS`), 8 KB cap, JSON-only, per-IP + per-install-token + daily-cap rate limit (Upstash REST if configured, in-memory fallback with warning), 8 s timeout, 503+Retry-After on upstream 429/503, generic 502, pinned `GEMINI_MODEL`, thinking budget 0, output cleaning (`shared/cleanReview.ts`). `api/` + `shared/` type-checked via `tsconfig.api.json`. 15 handler tests. |
| S-03, W-01 | `vercel.json`: SPA rewrite (excludes `/api`, assets, icons, files with extensions) + CSP / nosniff / referrer / permissions headers. Verified with a static server applying those headers: every route loads directly, no CSP violations, fonts load. No CSP changes were needed. |
| W-05 | Reminder checks guarded when `Notification` is unsupported; `checkOnce` catches failures. |
| C-10 | `parseISODateLocal`, `weekdayIndexOfISO`, `weekStartOfISO`; all `new Date(dateOnly)` / `Date.parse(dateOnly)` removed. Tests run across UTC, America/Los_Angeles, Pacific/Auckland, Asia/Kolkata. Confirmed to fail before the fix under America/Los_Angeles (progress bucketing, yesterday-missed). |
| V-01 | `--c-on-accent` and `--c-on-danger` tokens; `Button` danger uses it. `contrast.test.ts` asserts ≥ 4.5:1 for 17 text/background pairs in both themes (warning token darkened to pass). |
| C-02, C-08 (interim) | Onboarding injuries / preferences copy, Guide (XP loss, streak, load adjustment) and name hint now describe actual behaviour. Revisited in Phases 1 and 3. |
| Q-06 | `.github/workflows/ci.yml` (lint, typecheck, test, build, bundle size summary). |

## Size

| | before | after |
|---|---|---|
| main JS | 438.28 kB (135.94 gzip) | 438.56 kB (136.03 gzip) |
| precache | 31 entries, 1172.78 KiB | 31 entries, 1173.15 KiB |

(`zod` is server-only: the client imports types and `shared/skipReasons.ts`, so it is not bundled.)

## Notes
- The install-token header for rate limiting is read by the server but not yet sent; the client generates it once the `settings` table exists (Phase 1.1 / 1.8).
- `api/` imports use `.js` extensions so they resolve under Vercel's ESM output; this could not be verified without a deploy.
