# StepUp — Full Audit Report

**App:** StepUp (local-first strength-training PWA) · **Snapshot audited:** `stepup-fitness-app-main.zip` (files dated 2026-09-29) · **Audit date:** 2026-10-01
**Stack:** Vite 8 · React 19 · TypeScript 6 · Tailwind v4 · React Router 7 · Dexie 4 (IndexedDB) · Recharts 3 · vite-plugin-pwa · one Vercel serverless function (Gemini)

---

## 0. Scope, method and limits

**What I did**
- Read every source file (≈5,200 lines across `src/` and `api/`, plus config, scripts, README).
- Executed targeted checks in a sandbox (Node 22, TypeScript type-stripping) against the app's real `plan.ts`, `overload.ts` and `exerciseLibrary.ts`, plus a WCAG contrast computation on the design tokens.

**What I could not do** (sandbox has no network, no `node_modules`)
- I did not run `npm install`, `tsc -b`, `vitest`, `vite build`, Lighthouse, or the axe/Playwright scripts. Bundle sizes, real Lighthouse scores and axe results are therefore **not** in this report.
- I audited the uploaded zip, not the live GitHub repo. If `main` has moved, re-check the file/line references.

**Evidence tags used below**

| Tag | Meaning |
|---|---|
| **[SIM]** | Reproduced by running the app's real code in a sandbox |
| **[CODE]** | Confirmed by reading the cited file/line; not executed |
| **[VERIFY]** | Likely, but needs a runtime/device/deploy check |

**Severity:** **P0** = safety, data loss, money/security, or a headline feature that doesn't work · **P1** = high · **P2** = medium · **P3** = polish.

---

## 1. Executive summary

StepUp has a strong foundation: a clear product idea, a genuinely distinctive visual identity, a disciplined local-first architecture, a consistent calm voice, and readable typed code. The weaknesses are concentrated in one place: **the training engine doesn't yet do what the UI promises**, and a few trust and safety gaps follow from that.

### Scorecard

| Area | Score /10 | One-line verdict |
|---|:-:|---|
| Product concept & brand voice | 8 | Coherent, differentiated, calm |
| Visual design | 8 | Distinctive neo-brutalist system; dark-mode contrast broken |
| Architecture | 7 | Clean local-first layering; data access scattered in routes |
| **Training-engine correctness** | **3** | Progressive overload stalls; injuries ignored; goals don't change programming |
| **Safety & trust** | **3** | UI promises injury handling the code doesn't do; beginners get barbell deadlifts |
| Data integrity | 5 | No migrations, non-atomic writes, unvalidated import, volatile workout state |
| **API security** | **3** | Open, unauthenticated proxy to a paid LLM key |
| Privacy | 7 | Excellent default; consent copy over-claims |
| Performance | 6 | Fine today; AI call on every dashboard visit; unbounded scans later |
| PWA / offline / deploy | 5 | Good bones; no SPA rewrites, no headers, auto-update can interrupt a workout |
| Accessibility | 5 | Good targets/labels in places; toggles, calendar, live regions, focus, dark contrast fail |
| UX (workout logging, history, progress) | 5 | Happy path works; no editing, no resume, shallow history |
| Code quality & typing | 6 | Readable; lint effectively off; `strict` not explicit |
| Testing & CI | 3 | 4 suites, some tautological; no CI; README references a `test` script that doesn't exist |
| **Overall** | **≈5 / 10** | *Strong shell, engine not yet trustworthy* |

### The 10 things to fix first

1. **Progressive overload never progresses** (C-01) — suggestion caps at `startingLoad + 2.5 kg` forever **[SIM]**
2. **Injuries, exclusions, preferences and session length are collected but ignored**, while onboarding promises "we'll leave these out of your plan entirely" (C-02) **[SIM]**
3. **`/api/weekly-review` is an open, unthrottled, unvalidated proxy to your Gemini key** (S-01) **[CODE]**
4. **Beginners are assigned barbell deadlift/back squat/bench/OHP/row** whenever they own a rack (C-03) **[SIM]**
5. **Active-workout state lives in React state** — a reload, PWA update or OS tab kill resets you to exercise 1 and reverts swaps (C-06) **[CODE]**
6. **lb is cosmetic**: workout logging, warm-ups, PRs, volume charts are hardcoded kg (C-05) **[CODE]**
7. **Dark-mode primary/danger buttons fail WCAG** — white on accent is 2.62:1, white on danger 2.77:1 (V-01) **[SIM]**
8. **Timezone bug** — `new Date('YYYY-MM-DD')` is parsed as UTC, so weekday maths is off by one in the Americas (C-10) **[SIM]**
9. **Empty sets and zero-set "finish early" award XP and extend streaks; first-ever lifts all count as PRs** (C-07) **[CODE]**
10. **No CI, no `test` script, lint is two rules, `api/` isn't type-checked** (Q-01…Q-04) **[CODE]**

### What's already good (keep it)
- **Local-first by design**: zero third-party analytics, fonts bundled (no CDN), data in IndexedDB, AI coach opt-in and off by default.
- **`buildWeeklyReviewPayload()` is isolated** so "what leaves the device" is auditable in one function — excellent pattern; build the "preview what's sent" UI on it.
- **Graceful AI fallback** to a rules-based recap.
- **Range validation** with generous bounds; unit-aware body-weight range.
- **Design tokens** in CSS variables; light tap targets at `min-h-12`; `--c-faint` was actually re-tuned for contrast (light theme passes everything I tested).
- **Consistent brand voice** in copy ("Nothing to prove today. Just begin.").
- **Regression test with an explanatory comment** (`plan.test.ts`) — the right habit.
- **Recharts is code-split**; responsive sidebar/bottom-nav shell.

---

## 2. Verified by execution (evidence table)

| # | Check | Result |
|---|---|---|
| E1 | User lifts 40 kg × 10 @ RPE 2, repeated for 5 weeks; app's `suggestNextLoad` output | **42.5 kg every single week** (40 → 42.5 → 42.5 → 42.5 → 42.5) |
| E2 | New user, age 45, `injuries="bad lower back, no deadlifts"`, `exclusions="no squats"`, preference `bodyweight`, 30 min, bench-rack or full-gym | Plan contains **back-squat, deadlift, bench-press, barbell-row, overhead-press**; 13 exercises across 3 sessions; none of the stated constraints honoured |
| E3 | Same profile, dumbbells only | No barbell lifts, but `dumbbell-rdl`, `goblet-squat` and `bodyweight-squat` still included despite "no squats"/"bad lower back" |
| E4 | 378 sessions generated (6 equipment combos × 6 day counts × 3 fitness levels) | **0 empty sessions, 0 duplicate exercises within a session** — my initial suspicion of duplicates was *not* borne out; the earlier regression fix holds |
| E5 | `new Date('2026-10-01').getDay()` (Thursday = 4) | `4` in UTC and Asia/Kolkata; **`3` in America/New_York and America/Los_Angeles** |
| E6 | Starting loads, "experienced" 100 kg male | Deadlift **130 kg**, back squat 97.5 kg, bench 77.5 kg as unvalidated first-session loads |
| E7 | 2.5 kg plate step in lb | 5.51 lb; 42.5 kg = 93.7 lb → awkward numbers for lb users |
| E8 | WCAG contrast, **light** theme | All tested pairs pass (5.2–7.2:1) |
| E9 | WCAG contrast, **dark** theme | `text-white` on `bg-accent` **2.62:1 FAIL**; `text-white` on `bg-danger` **2.77:1 FAIL**; faint/accent/danger text on surfaces all pass (5.1–7.4:1) |
| E10 | Library inventory | 32 exercises: squat 4, hinge 4, press 8, pull 7, carry 2, core 3, conditioning 2, mobility 2; IDs unique; `mobility` pattern is never scheduled by `plan.ts` |

---

## 3. Findings

### A. Training engine & product correctness

**C-01 · P0 · Progressive overload is broken** [SIM + CODE]
`overload.ts:28` — `const lastWeight = planned.startingLoadKg`. The "previous weight" is the plan's static estimate, not what the user actually lifted. Nothing writes loads back (no `plans.update`/`put` anywhere; grep-confirmed), so suggestions can never exceed `startingLoad + step`. `overload.test.ts` passes because every fixture lifts exactly the starting 40 kg. `Guide.tsx:19` tells users the plan "adjusts your suggested load after every set".
Related defects in the same loop:
- Uses the *average* reps across sets rather than per-set double progression (all sets hit the top of the range → add load).
- A swapped exercise falls back to the **original** exercise's `startingLoadKg` (`WorkoutActive.tsx:90–98`) — a goblet squat can be prefilled with a back-squat load.
- Warm-up ramp is computed from the static plan load, not today's working weight (`WorkoutActive.tsx:223`).
- Rebuilding the plan (`ProfileEdit.tsx:63`) discards all loads — harmless today only because loads never evolve.
**Fix:** add a per-exercise state record (`exerciseState`: last working weight, reps per set, RPE, date, consecutive-fail count). Progression reads this, not the plan. Apply double progression per set, deload after 2–3 failures, unit-aware increments, and fall back to a *swapped exercise's own* estimate. Plans stay declarative (exercises, sets, rep ranges). Add multi-session tests.

**C-02 · P0 · Injuries, exclusions, preferences, session length are ignored** [SIM + CODE]
`plan.ts` reads only `equipment`, `daysPerWeek`, `primaryGoal/secondaryGoal`, `doesCardioAlready`, `fitnessLevel`, `sex`, `age`, `startingWeightKg`. Unused: `injuries`, `exclusions`, `trainingPreferences`, `sessionLengthMinutes`, `liftsAlready`, `heightCm`. Meanwhile `Onboarding.tsx:439–441` says injuries are left "out of your plan entirely", and step 8 says "we lean towards these". `ProfileEdit` lets you edit them but they never affect anything. This is both a trust and a safety problem.
**Fix:** replace free-text injuries with a structured picker (lower back, knees, shoulders, wrists/elbows, neck, hips, other) mapped to `contraindications` tags on exercises; keyword-match free-text exclusions against names/patterns; score candidates by `trainingPreferences`; size sessions from `sessionLengthMinutes` (≈ 8–10 min per exercise incl. rest); schedule `mobility` as warm-up/cool-down. A "discomfort-or-pain" skip should offer "stop suggesting this exercise". Until shipped, change the copy to be truthful.

**C-03 · P1 · Beginners get barbell compounds** [SIM]
`pickForPattern` sorts by equipment tier descending (`plan.ts:46`) and ignores `fitnessLevel`. "New to structured workouts" + bench-rack or full-gym → back squat, deadlift, bench, OHP, barbell row in week one, with starting loads from a demographic formula (E6).
**Fix:** add `skill: 1|2|3` and `beginnerFriendly` to `Exercise`; choose by fitness level first, equipment tier second; beginners start with goblet squat, DB/machine patterns, bodyweight progressions; add a short first-session calibration ("pick a weight you could lift ~10 times") instead of demographic multipliers.

**C-04 · P1 · Goals don't change programming** [CODE]
Every strength session is 3 × 6–10 regardless of goal (`plan.ts:110–113`; `pattern === 'core' ? 3 : 3` is a dead ternary). "Lift heavier", "build muscle", "lean out" and "feel better" produce identical prescriptions.
**Fix:** goal-driven sets/reps/rest/RIR targets (e.g., strength 3–5 × 3–6; hypertrophy 3–4 × 8–12; general 2–3 × 8–15), plus rest-timer defaults per exercise type.

**C-05 · P1 · The lb setting is cosmetic** [CODE]
Only the body-weight widget respects `weightUnit` (`Progress.tsx`). Hardcoded kg elsewhere: workout weight label and validation (`WorkoutActive.tsx:323`), warm-up list (`:226`), "kg est." in PRs (`Progress.tsx:99,115`, `WorkoutComplete.tsx:72`), volume chart (`Charts.tsx`, `unit="kg"`). Onboarding hardcodes kg (`Onboarding.tsx:154`, weight field label) and never asks. `kgToDisplay`/`displayToKg` exist but are barely used; `Progress.tsx:34` re-implements the constant.
**Fix:** single `useUnit()` hook + `formatWeight()` / `parseWeight()`; ask in onboarding; DB keeps kg; snap loads to unit-native increments (2.5/1.25 kg or 5/2.5 lb); update every label, chart and validation.

**C-06 · P1 · Active-workout state is volatile and has dead ends** [CODE]
- `index`, `exerciseIds`, `swapMap`, rest timer are component state (`WorkoutActive.tsx:38–49`). Reload, PWA auto-update (W-02) or an OS tab kill → back to exercise 1, swaps reverted, rest timer gone.
- Plan is looked up by **name** (`:54–57`); if the plan is rebuilt mid-session, `planSession` is `undefined` and the screen renders `null` (`:102–104`) — a blank page with no exit. Same blank screen if `/workout/active` is opened with no session.
- `startSession` returns *any* in-progress session (`workout.ts:12`), however old and whichever workout was requested — tap "Lower Body", get last Tuesday's abandoned "Upper Body". The dashboard has no "Resume workout" affordance.
**Fix:** persist `currentIndex`, `exerciseOrder` (with swaps), `restEndsAt` and a **snapshot of planned exercises** on the session row; dashboard "Resume" banner; auto-expire stale sessions (>12 h) with save/discard; redirect instead of rendering `null`.

**C-07 · P1 · XP / streak / PR integrity** [CODE]
- "Complete set" accepts blank weight and reps (`WorkoutActive.tsx:113–131`) → +5 XP each; unlimited.
- "Finish early" (`:206`) needs no confirmation and completes a session with **zero sets** → +30 XP, counts toward streak.
- First-ever log of any lift is a PR (`records.ts:34`: prior best defaults to 0) → several +50 XP PRs in workout one. `WorkoutComplete` finds "this session's PRs" by `achievedAt` within 60 s of completion (`:23`) — a heuristic; store `sessionId` on the record.
- Finishing is non-idempotent and non-transactional (`handleFinish`, `:165–179`): double-tap → double XP; interruption → half-applied.
**Fix:** require reps (or duration) per set; refuse/offer-discard for 0-set sessions; PRs need a prior baseline and distinguish weight PR / e1RM PR / rep PR; store `sessionId`; wrap finish in one transaction guarded by `completedAt`.

**C-08 · P1 · Gamification contradicts its own documentation** [CODE]
- `Guide.tsx` says skipping/missing costs capped XP; `awardXP('loss')` is never called. `'streak'` and `'weekly-mission'` XP types are also never awarded (grep).
- `Guide.tsx:23` says "Missing one changes nothing"; `streak.ts:25` ends the streak at the first missed *scheduled* day.
- Streak is computed against the **current** plan, so rebuilding the plan rewrites history; workouts on unscheduled days ("Train anyway") don't count.
- XP level can go negative (`getLevelProgress` with negative total → negative `xpIntoLevel`).
**Decision needed:** either implement as documented or simplify. Recommendation: replace punitive streaks with a calm *weekly consistency* model ("3 of 4 sessions this week", "active weeks in a row", with a grace day), keep XP optional, fix copy to match behaviour.

**C-09 · P2 · Conditioning and holds aren't loggable** [CODE]
`buildConditioningSession` creates `easy-jog` with 1 set × "1–1 reps" and `intervals-bike` with 6 × "1–1"; the logger still asks weight and reps. Plank targets "30–60 reps" (`plan.ts:110–112`) — seconds labelled as reps, then fed to the rep-based overload logic.
**Fix:** `trackingType: 'weight-reps' | 'bodyweight-reps' | 'duration' | 'distance-time'` on `Exercise`; per-type logger UI (countdown/stopwatch for holds and intervals), summaries and overload rules.

**C-10 · P2 · Timezone bugs** [SIM + CODE]
`new Date('YYYY-MM-DD')` is UTC; `getDay()` is local → off by one west of UTC (E5). Affected: `progress.ts:16` (weekly volume bucketed into the wrong week), `useReminderChecks.ts:14,17` (wrong "yesterday's session is still open" notifications), `History.tsx:135` (wrong rest-day text). `recap.ts`/`aiCoach.ts` use `Date.parse(weekAgo)` (UTC midnight) for PR windows. Session `date` is fixed at start time, so a workout crossing midnight lands on the earlier day.
**Fix:** `parseISODateLocal()` helper; forbid `new Date(dateOnlyString)`; add a `TZ` matrix (UTC, America/Los_Angeles, Pacific/Auckland) to the test run.

**C-11 · P2 · Plan rigidity** [CODE]
- Sessions pinned to fixed weekdays (`spreadAcrossWeek`); no day picker, no rescheduling of a missed day.
- 4–6 days = identical Lower/Upper repeated (the 4+ branch clears `usedPerWeek` each session) — no variation, periodisation or deload.
- Plan screen is read-only: no swap/reorder/add exercise, no custom workout, no ad-hoc exercise during a session.
- `volumeUneven` shows a warning (`Plan.tsx`) with no way to act on it; it only counts `press` vs `pull` sets.

**C-12 · P2 · Exercise library is thin** [SIM]
32 exercises (E10). Missing: lunges/split squats, hip thrust/glute bridge, leg curl/extension, calves, biceps/triceps/rear-delt isolation, anti-rotation core, vertical vs horizontal push/pull distinction. `mobility` exercises are never scheduled. `primaryMuscles` isn't used for volume tracking. No images/video; only 3 text cues. The library is duplicated in code **and** an IndexedDB `exercises` table that is only seeded when empty (`seed.ts:6`) — library updates never reach existing installs, and all lookups use the in-memory array anyway.

**C-13 · P2 · Warm-up ramp** [CODE] — only three barbell lifts; "kg" hardcoded; shows `0 kg × 8` when base load is 0; not rounded to plates.

**C-14 · P2 · RPE 1–5** [CODE] — a custom scale with no legend; thresholds (`≤ 2.5`, `≥ 4`) are invisible to users. Label the buttons (Easy / Solid / Hard / Very hard / Max) or move to standard RIR.

**C-15 · P3 · e1RM / PR maths** — Epley at any rep count is unreliable above ~12 reps; duplicated in `records.ts` and `progress.ts`.

---

### B. Data layer & persistence

**D-01 · P1 · Import is destructive and unvalidated** [CODE]
`backup.ts:43` `JSON.parse(...) as BackupPayload`; tables are cast `as never[]` (`:69…`) and inserted with no schema checks; `Profile.tsx:46` replaces all data with **no confirmation**; file input isn't reset (re-selecting the same file does nothing). The transaction rolls back on a thrown error (good), but malformed-but-insertable rows can crash later screens. No migration path — `version: 1` only.
**Fix:** per-table schema validation (zod or hand-rolled); dry-run summary ("48 workouts, Mar–Sep. Replace current data?"); auto-download a safety copy first; optional merge mode; versioned migrations.

**D-02 · P1 · Local-first durability gaps** [CODE + VERIFY]
- Export creates an anchor that is never attached to the DOM and revokes the URL immediately (`backup.ts:33–38`) — unreliable on iOS Safari / some browsers. No `navigator.share({ files })` path for mobile.
- **Never calls `navigator.storage.persist()`**; Safari can evict script-writable storage for sites not used for ~7 days unless installed as a PWA. For an app whose pitch is "your data stays on this device", this is the single biggest data-loss risk.
- No "last backup" tracking or nudge; no CSV export.
**Fix:** request persistent storage after first workout; surface status; install-to-home-screen prompt (incl. iOS instructions); backup reminder after N workouts; Web Share export; CSV export; optional File System Access auto-backup where supported.

**D-03 · P1 · No schema evolution** [CODE] — `schema.ts:26` has only `version(1)`. Add `version(2)+` with `upgrade()` discipline before adding `exerciseState`, `settings`, `weeklyReviews`, session snapshot fields.

**D-04 · P2 · Non-atomic multi-step writes** [CODE]
`handleFinish` (finish → PR → XP → track); onboarding (`profile.add` then `plans.add`, `Onboarding.tsx:160–162` — failure leaves an "onboarded" user with no plan); `ProfileEdit.saveProfile`; `logSet` read-modify-write of the whole `exercises` array (`workout.ts:34–50`) → lost update on rapid taps; `awardXP` loss-cap read-then-write. `Onboarding.finishOnboarding` sets `submitting` and never resets on error (`:136`) → stuck disabled button.
**Fix:** `db.transaction('rw', …)` wrappers; idempotent finish; disable-while-pending; try/catch with user feedback.

**D-05 · P2 · Unbounded growth and full-table scans** [CODE]
`appEvents` grows forever and nothing reads it (dead data, also exported/imported). `workoutSessions.toArray()` on Dashboard (`:18`), History, and every 5 minutes in `useReminderChecks`; `xpEvents` fully loaded and sorted; `getInProgressSession` uses `filter()` (scan).
**Fix:** range queries; cache derived stats; cap/prune or remove `appEvents`; `Map` for exercise lookups.

**D-06 · P2 · "Delete everything" isn't** [CODE] — `wipeAllData` leaves `exercises`, `localStorage` (`stepup-appearance`, notification flags), caches and the service worker (`Profile.tsx:55–59`). Use `db.delete()` + reopen/reseed and clear keys.

**D-07 · P2 · Theme: two sources of truth + flash** [CODE]
Appearance lives in both `localStorage` and `profile.appearance`. Theme is applied in `useLayoutEffect` (`theme.tsx:43`) — after the JS bundle loads, so dark-mode users see a light flash (no inline script in `index.html`). `theme-color` is a fixed light value in `index.html:9` and the manifest (`vite.config.ts:18`).

**D-08 · P3** — `ensureExerciseLibrarySeeded()` is fire-and-forget (`main.tsx:7`); `orderBy('createdAt').last()` repeated 8+ times (centralise as `useProfile()`).

---

### C. Security & API

**S-01 · P0 · Open LLM proxy** [CODE]
`api/weekly-review.ts:50` `req.body as WeeklyReviewPayload` — no schema, no size cap, no rate limit, no origin/device check. Anyone who finds the URL can (a) spend your Gemini quota/budget and (b) inject arbitrary text through `exerciseName` / `reason` (free strings that go straight into the model input). Internal error messages are returned to the client (`:73`).
**Fix:**
- Validate with a strict schema: array max lengths, string max lengths, numeric ranges, `reason` as an enum.
- Send **exercise IDs**, not names; map to names server-side using a shared library module.
- Reject bodies > ~8 KB; `Origin` allowlist; `Cache-Control: no-store`.
- Rate limit (Upstash/Vercel KV sliding window: IP + anonymous install token); daily spend kill-switch.
- Timeout via `AbortSignal`; map upstream 429/503 to 503 + `Retry-After`; generic client errors, detailed server logs.

**S-02 · P1 · Model-call robustness** [CODE]
`maxOutputTokens: 300` (`:64`) can return empty text on reasoning-capable models (tokens spent on thinking) → disable thinking or raise the cap. `gemini-flash-lite-latest` (`:57`) is a moving alias — pin via `GEMINI_MODEL` and add it to `.env.example`. Add an output guard (strip `!`, markdown, length cap) since the voice rules are only prompt-enforced.

**S-03 · P1 · No security headers / no SPA rewrites** [CODE + VERIFY]
No `vercel.json`. Add a CSP (`default-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`; style allowances as Recharts/Tailwind require), `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`. Also SPA rewrites (W-01).

**S-04 · P2 · Dependency hygiene** [CODE] — no `npm audit`/Dependabot; ESLint, Prettier, `eslint-plugin-*`, `autoprefixer`, `postcss` are installed but unused (Tailwind v4 via the Vite plugin needs none of the PostCSS pair). Run `depcheck`; remove or configure.

**S-05 · P3** — import file size/type limits; `.env.example` missing `GEMINI_MODEL` and rate-limit variables.

---

### D. Privacy, trust & safety

**P-01 · P1 · Consent copy over-claims** [CODE]
`Profile.tsx:11` says "Nothing else is sent, and it isn't stored." StepUp can't promise what Google (Gemini API) or the host retains. Name the processors, link a privacy page, say "StepUp doesn't store it", add **"Preview what will be sent"** (reuse `buildWeeklyReviewPayload`). Body-weight trend and "discomfort/pain" skips are health-related data; keep consent explicit and easy to withdraw.

**P-02 · P1 · Health-safety framing** [CODE]
Minimum age is 13 (`validation.ts`); no readiness screen; the only disclaimer is 12px text on the last onboarding step (`Onboarding.tsx:449`). Recommend: 16+/18+ gate or parental-consent note; 4–5 readiness questions (chest pain, dizziness, clinician-advised limits, pregnancy/postpartum) that soften the plan and show a "check with a professional" message; disclaimers in Guide and a Terms page.

**P-03 · P2 · Demographic load multipliers** [CODE] — `plan.ts:85` scales load by sex (0.7 / 1.0 / 0.85) and age. Replace with self-estimated strength or a calibration set; it's more accurate and more inclusive. Onboarding hint (`:188`) says the name is "used for your progress chart" — it's used for the greeting.

**P-04 · P3** — `track()` events have no consumer; reminder copy "Your N-session streak is waiting" contradicts the no-pressure voice.

---

### E. Performance

**F-01 · P1 · AI call on every dashboard visit** [CODE]
`Dashboard.tsx:59` — effect deps `[sessions, aiCoachEnabled]`; `sessions` is a new array on each live-query emission and the effect runs on every mount. With the coach on, **each visit (and each DB write while mounted) hits Gemini**, uncached, with no timeout, and the card is blank until it resolves.
**Fix:** cache per ISO-week + payload hash in Dexie; fetch once per week or on an explicit button; `AbortController` + ~8 s timeout; skeleton.

**F-02 · P2 · Bundle / precache** [VERIFY] — only `Progress` is lazy. `globPatterns` includes all `woff2` (`vite.config.ts:43`), so every Fraunces unicode-range subset may be precached; import the Latin subset only. Run a bundle visualizer and set budgets.

**F-03 · P2** — linear `EXERCISE_LIBRARY.find` in loops → `Map`; screens re-derive from full tables on any change.

**F-04 · P3 · Blank loading states** [CODE] — `RequireOnboarded`, Dashboard, Plan, History, Progress all `return null` while loading; add skeletons/splash.

---

### F. PWA, offline & deployment

**W-01 · P1 · Deep-link refresh** [VERIFY] — no `vercel.json`; Vercel needs an SPA rewrite (excluding `/api`) or a hard refresh on `/dashboard` 404s until the service worker is installed.
**W-02 · P1 · `registerType: 'autoUpdate'`** (`vite.config.ts:12`) — can reload the page mid-workout; with C-06 unfixed that loses position and swaps. Use prompt-based updates; defer while a session is in progress.
**W-03 · P2 · Manifest** — add `id`, `scope`, `lang`, `categories` (health, fitness), `shortcuts` (Start workout, Log weight), `screenshots`; drop `orientation: portrait` (hurts tablets/desktop/accessibility); dark `theme-color` via `media` meta.
**W-04 · P2 · Service worker** — add `navigateFallbackDenylist: [/^\/api\//]`, `cleanupOutdatedCaches`; add an install-prompt UX (Android `beforeinstallprompt`; iOS instructions) since persistence and notifications on iOS depend on installation.
**W-05 · P2 · Notifications can throw** [CODE] — `notifications.ts:44` reads `Notification.permission` without the `notificationsSupported()` guard used elsewhere → `ReferenceError` (unhandled rejection) every 5 minutes from `AppShell` on browsers without the API (e.g. iOS Safari tab). Reminders only run while the app is open; set expectations in the UI and offer a **calendar (.ics) export of workout days** as a robust cross-platform reminder.
**W-06 · P2 · Workout-session platform features** — no Screen Wake Lock; rest timer is a per-second `setTimeout` chain (drifts/pauses when the screen locks) with no vibration or sound at zero. Use `restEndsAt` timestamps, `navigator.vibrate`, optional beep, Wake Lock.
**W-07 · P2 · Mobile layout** — `min-h-screen` (100vh) should be `min-h-dvh`; fixed bottom nav has no `env(safe-area-inset-bottom)` padding and the viewport meta lacks `viewport-fit=cover` (home-indicator overlap when installed on iPhone).

---

### G. Accessibility (static review; run the existing axe script to confirm)

**A-01 · P1 · Choice controls have no state semantics** — `Chip` (`ui.tsx:27`) conveys selection by colour only: no `aria-pressed`, single-select groups (fitness level, goal, sex, units, appearance) lack `role="radiogroup"`/`fieldset`+`legend`. Onboarding steps don't move focus or announce; FullScreenShell has no `<main>`; no skip link; no per-route `document.title`.
**A-02 · P1 · Workout screen** — rest timer isn't `role="timer"`/live region; "set logged" isn't announced; RPE group has a visual label only; input errors use `aria-invalid` without `aria-describedby` (`WorkoutActive.tsx:329–336`, `TextField`).
**A-03 · P2 · History calendar** — day buttons are named only by the number (`History.tsx:96–105`); status is colour-only (red/blue/grey dots, WCAG 1.4.1). Add `aria-label="Thu 12 Mar — workout completed"`, `aria-current="date"`, and non-colour markers.
**A-04 · P2 · Focus visibility** — only inputs define `focus:outline-2`; the 2 px ink borders mask the UA ring elsewhere. Add a global `:focus-visible` style.
**A-05 · P2 · Small text for important content** — form cues during a lift are `text-xs text-faint`; eyebrow labels are 11 px uppercase.
**A-06 · P3** — honour `prefers-reduced-motion` (press/transition effects); text alternative or data table for charts.

---

### H. UX & product

**U-01 · P1 · Workout logger ergonomics** [CODE]
No list of logged sets this session (only "x of y"), no edit/delete/undo of a set, no "Last time: 40 × 8, 8, 7", no +/− weight steppers or "same as last set", no notes, no extra-set/skip-set, no reorder/superset, no plate calculator. "Leave" deletes everything (`:302–306`); "Finish early" has no confirm. Swap/skip/leave render as inline cards (no focus trap/Esc) rather than sheets/dialogs.
**U-02 · P1 · History is shallow** — selecting a day shows only "Workout completed." (`History.tsx:126–133`). Add session detail (exercises, sets, volume, duration, PRs), edit/delete, per-exercise history, notes. "Missed" in red, evaluated against the *current* plan, clashes with the calm voice.
**U-03 · P2 · Progress** — lift selector lists every library lift, so the default is usually empty (`Progress.tsx:19–22`); body weight allows many entries per day (`:34–35`) — upsert by date, edit/delete, add 7-day average; x-axis is categorical strings, not a time scale; add per-muscle weekly sets, PR board, consistency view.
**U-04 · P2 · Onboarding** — 9 steps before any value; state is lost on refresh; no quick-start path; no unit question; step 4 answers barely used; no review step or "why this plan" explanation; can't pick training days; `PlanReady` lists names only and its CTA goes to the dashboard.
**U-05 · P2 · Dashboard** — shows "Start workout" even if today's session is already completed (double-count risk); no next-session preview (exercises, duration); AI card fails silently.
**U-06 · P2 · Global states** — no error boundary/`errorElement`; unknown routes silently redirect to `/` (no 404); async handlers (`begin`, `finishOnboarding`) have no error UI; no toast system for saves/imports; `WorkoutComplete` calls `navigate()` during render (`:33`) and `ProfileEdit` sets state during render (`:47`).
**U-07 · P3 · Gamification vs brand** — XP/levels/ranks sit awkwardly with "no streak-shaming, no hype"; the XP page is reachable only from a dashboard link. Make it optional or fold into "quiet progress" (PR moments, monthly recap).

---

### I. Design system

**V-01 · P1 · Dark-mode contrast fails** [SIM] — `text-white` on `--c-accent` (145,150,255) is **2.62:1**; on `--c-danger` (248,113,113) **2.77:1** (required: 4.5:1 for normal text). Affects every primary button, selected chip, active nav item and the "Complete set" CTA in dark mode. Fix: use dark ink text on the dark-theme accent/danger, or darken those fills; define `--c-on-accent` / `--c-on-danger` tokens. (Light theme passes.)
**V-02 · P2 · Component gaps** — input/textarea/select styles are duplicated (`WorkoutActive`, `Progress`, `Onboarding`, `ProfileEdit`); `Button` lacks default `type="button"` and a loading state; variants are typed `Record<string,string>`. Extract `NumberField`, `TextArea`, `Select`, `SegmentedControl`, `Stepper`, `Sheet/Dialog`, `ConfirmDialog`, `Toast`, `Skeleton`; single `options.ts` for the goal/equipment/level lists currently duplicated with differing labels.
**V-03 · P3 · Moments** — the workout-complete screen is minimal (no volume, PR summary, next session); a calm-but-felt PR moment (haptic + quiet animation) fits the brand.

---

### J. Code quality, tooling & testing

**Q-01 · P1** — `package.json` has no `test`, `typecheck` or `format` script, though the README says `npm run test`.
**Q-02 · P1 · Typing** — `tsconfig.app.json` sets no explicit `strict` (confirm the effective value with `tsc --showConfig`); make it explicit and add `noUncheckedIndexedAccess`, `noImplicitReturns`. `api/` and `scripts/` are in no tsconfig (`tsconfig.node.json` includes only `vite.config.ts`) → server code is never type-checked. Replace `as never[]`, `req.body as …`, `response.json() as …`, `location.state as …` with validated parsing.
**Q-03 · P2 · Tests are thin and partly vacuous** — 4 suites, pure functions only. Tautologies: `xp.test.ts` "rankForLevel monotonic" loops asserting `level > lastLevel`; the `levelForXP` consistency assertion compares against itself + 1; `plan.test.ts` only checks `typeof volumeUneven === 'boolean'`. Untested: streak, records, workout session lifecycle, backup, recap, progress, format/TZ, notifications, API handler, any component. C-01 survives the suite. Add `fake-indexeddb` Dexie tests, multi-session overload tests, RTL flows for the logger, handler tests, and real Playwright specs with assertions.
**Q-04 · P2 · Lint** — `.oxlintrc.json` enables two rules; ESLint/Prettier are installed but unconfigured (no config files); `WorkoutActive.tsx:99` disables an ESLint rule that isn't running. Enable oxlint `correctness`+`suspicious`, `react-hooks/exhaustive-deps`; choose *one* formatter and commit its config.
**Q-05 · P2 · Structure** — DB queries inside route components; `WorkoutActive` (418 lines) and `Onboarding` (476) should split into hooks/components (`useActiveWorkout`, `SetLogger`, `RestTimer`); duplicated `estimatedOneRepMax`; duplicated option lists; add `src/db/repo.ts` (or hooks) as the only data-access layer.
**Q-06 · P2 · CI/CD** — no `.github/workflows`. `scripts/*.mjs` are manual Playwright drivers that hardcode `localhost:5173` and assert nothing; convert to a Playwright Test suite with `webServer` and axe checks.
**Q-07 · P3 · Repo hygiene** — README references `FORGE_AUDIT.md`/`BUILD_GUIDE.md` that aren't in the repo; no LICENSE, `.editorconfig`, `CLAUDE.md`, ADRs; `package.json` version `0.0.0`.
**Q-08 · P3 · Observability** — none. Add an opt-in/local error log (exportable from Profile) so bug reports are possible without telemetry.

---

## 4. Roadmap

| Phase | Theme | Items | Effort |
|---|---|---|---|
| **0** | Stop the bleeding | S-01, S-03, W-01, W-05, C-10, V-01, Q-01, Q-06 (CI), C-02 *copy honesty* | 1–2 days |
| **1** | Make the engine real | C-01, C-03, C-04, C-06, C-07, C-05, D-03, D-04, D-01, D-02, F-01 | 1–2 weeks |
| **2** | Workout, history, progress UX + a11y | U-01…U-06, A-01…A-05, W-02, W-06, W-07, V-02 | 1–2 weeks |
| **3** | Programming depth | C-02 *full*, C-09, C-11, C-12, C-13, C-14, P-02, P-03 | 2–3 weeks |
| **4** | Polish & reach | W-03, W-04, F-02…F-04, Q-02…Q-05, P-01, U-07, V-03, CSV import/export, `.ics`, templates, i18n | ongoing |

---

## 5. Feature ideas for "maximum potential" (after the above)

- **Program templates** (full body, upper/lower, PPL, 5×5-style) and a real program editor; custom exercises.
- **Smart deloads** and autoregulation (RIR-based), plate calculator, per-exercise rest defaults.
- **Supersets, notes, tempo, per-set targets**, timers for holds/intervals.
- **Progress depth:** per-muscle weekly volume, PR board, body measurements, optional local progress photos, monthly recap.
- **Portability:** CSV export/import (Strong/Hevy formats), `.ics` schedule, Web Share, optional encrypted backup to a user-chosen file/folder.
- **Coach:** explain *why* a load changed ("3 sets at 10 reps at RPE 2 → +2.5 kg"), plan-adjustment suggestions after repeated pain/equipment skips (the skip-reason data is already captured and is the app's most interesting signal).
- **i18n** and unit/locale formatting; expanded exercise media.

---

## 6. Appendix — file map (what's where)

| Path | Role | Notes |
|---|---|---|
| `src/lib/plan.ts` | Plan generator | Findings C-02/03/04/09/11 |
| `src/lib/overload.ts` | Load suggestions | C-01 |
| `src/lib/workout.ts` | Session lifecycle | C-06, D-04 |
| `src/lib/xp.ts`, `records.ts`, `streak.ts` | Gamification | C-07, C-08 |
| `src/lib/backup.ts` | Export/import | D-01, D-02 |
| `src/lib/notifications.ts`, `useReminderChecks.ts` | Reminders | W-05, C-10 |
| `src/lib/aiCoach.ts`, `api/weekly-review.ts` | AI coach | S-01, S-02, F-01, P-01 |
| `src/routes/WorkoutActive.tsx` | Logger (418 lines) | C-01/05/06/07, U-01, A-02 |
| `src/routes/Onboarding.tsx`, `ProfileEdit.tsx` | Profile capture | C-02, U-04, D-04 |
| `src/db/*` | Dexie schema, types, library | D-03, C-12 |
| `src/index.css`, `components/ui.tsx` | Tokens, primitives | V-01, V-02, A-01 |
| `vite.config.ts`, `index.html` | PWA config | W-02/03/04, D-07 |
| `scripts/*.mjs` | Manual Playwright drivers | Q-06 |
