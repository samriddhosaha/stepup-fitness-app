# StepUp — working notes

Local-first strength-training PWA. Vite 8, React 19, TypeScript, Tailwind v4, React Router 7, Dexie 4 (IndexedDB), Recharts, vite-plugin-pwa, one Vercel function `api/weekly-review.ts` (Gemini).

## Principles
- **Local-first.** No accounts, no analytics, no new network calls except the opt-in AI coach. All user data stays in IndexedDB.
- **Weights are stored in kg** in the DB. Convert only at the UI edge (`formatWeight` / `parseWeight`).
- **Dates are local `YYYY-MM-DD` strings.** Never `new Date(dateOnlyString)` (parses as UTC). Use `parseISODateLocal`.
- **Calm brand voice.** No exclamation points, no streak-shaming, no hype. Reference: "Nothing to prove today. Just begin."
- **Keep the current visual identity** (tokens in `src/index.css`: navy/lime palette, Inter + IBM Plex Mono, 1px navy borders, solid offset shadows). Extend tokens, don't restyle.
- Bug fixes are test-first. Small commits: `fix(C-01): …`, `feat(…)`, `chore(…)`. Branch `audit/remediation`. Never force-push.
- Don't weaken: range validation, AI consent toggle, graceful AI fallback, `buildWeeklyReviewPayload()` isolation, bundled fonts, contrast tokens.
- No new runtime dependency without justification in the commit body.

## Commands
- `npm run dev` · `npm run check` (lint + typecheck + test + build)
- `npm run lint` (oxlint) · `npm run typecheck` (tsc -b) · `npm test` (vitest run)

## Map
- `src/db/` Dexie schema, types, exercise library, seed
- `src/lib/` pure logic: plan, overload, workout, xp, records, streak, backup, recap, aiCoach, format, validation
- `src/components/` AppShell, ui primitives, Charts
- `src/routes/` screens
- `api/` Vercel function · `shared/` code shared by `src/` and `api/`
- `AUDIT.md` findings (C-/S-/D-/…); `docs/` per-phase notes
