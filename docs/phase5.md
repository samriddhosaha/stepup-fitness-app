# Phase 5 — daily log, nutrition, coach extensions, extras

Built on top of the audit/remediation work (phases 0–4), reusing its primitives, data layer and conventions.

Done:
- **Data (schema v4 and v5, backup v4):** tables for water, body measurements, check-ins, habits and habit logs (v4), and custom foods, meals and saved meals (v5), with new optional profile fields. Upgrades are additive, so existing rows are never touched; migration tests seed a real v3 database and check it upgrades intact. The backup schema was extended (it strips unknown keys), the new tables are optional in the file so older backups still restore, a damaged row rejects the whole file, and a duplicate-key failure rolls everything back.
- **Log tab** (nav is now Home / Plan / Log / Progress / Profile; History is a tab under Progress and keeps Progress lit): water ring with quick amounts and undo, a three-tap check-in with a readiness hint, habits with weekly strips and streaks that survive "not done yet today", and a quick weigh-in plus measurements. Home gets readiness, water, habit and nutrition cards. Profile gets a hydration goal and optional reminders that ride on the existing `runReminderChecks` (daytime only, quietened by logging a drink).
- **Nutrition:** protein-first page with a searchable approximate food list (Indian staples first), quick-add, custom foods, favourites, 7-day averages (days not logged are not counted as zero) and Mifflin-St Jeor targets with a 1,200 kcal floor that the person can override. Disclaimer and "approximate" notes are on screen. Open Food Facts was deliberately not added.
- **Coach (ADR 0005):** optional `wellbeing` averages as a separate consent, `focus: 'next-week'` with its own cache entry, a richer local recap, tests that pin the contract. Bring-your-own-key was not built.
- **Extras:** plate calculator, a share picture drawn on-device, milestones on the XP page and a twelve-week training-days heatmap on Progress.
- **Tests:** about 180 new unit and component tests (the maths, stores, migrations, backup round-trips, reminder rules, contract tests for the coach, four-time-zone checks for date logic) and four new e2e specs; axe now also covers `/log` and `/nutrition` in light and dark.

Not ported, on purpose:
- **Supersets** change the durable workout-session flow (planned snapshot, order, swaps, position); that deserves its own change with its own tests rather than riding along.
- **Program templates / starter programmes in onboarding:** already on the deferred list above; the generator is slot-based, so templates are a design question first.
- **Bring-your-own-key:** needs the CSP `connect-src` loosened or the key sent to the app's server (see ADR 0005).
- **Exponential-moving-average weight chart, PR engine, overload rules, warm-ups, rest timer, backup/restore, consistency:** the remote already has these, so nothing was ported.

Known upstream issue, not changed here: the e2e `a whole set can be logged with the keyboard alone` types only reps, but the first time a lift appears the weight field is empty, so the set can't be submitted. It fails identically on a clean checkout of `4d9c18f`.
