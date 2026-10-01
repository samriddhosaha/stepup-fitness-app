# Phase 2 — workout, history, progress UX and accessibility

| ID | What changed |
|---|---|
| V-02 | `src/components/forms.tsx`: `SegmentedControl` (radiogroup + arrow keys), `ToggleChip` (`aria-pressed`), `NumberField` (label, `aria-describedby`, optional ± stepper), `TextArea`, `Select`, `FieldGroup`. `overlays.tsx`: native-`<dialog>` `Dialog`/`ConfirmDialog` (focus trap, Esc, focus returns to opener, bottom sheet on phones) and `ToastProvider` (polite live region, optional Undo). `Button` defaults to `type="button"` and supports `loading`. Option lists live in `src/lib/options.ts`. ProfileEdit and Profile use the primitives; Onboarding moves to them in Phase 3.3 when it is rewritten. |
| U-01, A-02 | Logger split into `features/workout/*`. Logged-sets list with edit / delete / **Undo**; "Last time: 20 kg × 8, 9"; ± steppers sized for the exercise (plates vs dumbbells, unit-aware); **Same as last set**; per-set notes; extra sets and "Done with this exercise"; Swap / Skip / Leave / Finish are dialogs; RPE buttons are labelled (Easy … Max) with a legend; polite live announcements ("Set 2 logged"); rest timer is `role="timer"`; form cues are 14 px. Set XP is now settled at finish, so deleting and re-logging a set cannot farm XP. |
| U-02, A-03 | History: day detail with exercises, sets, volume, duration, personal bests, skips with reasons; per-set correction and delete for finished workouts (progression state is re-derived, PRs removed with the workout; XP stays). Per-exercise history at `/history/exercise/:id`. Calendar days have full accessible names and `aria-current="date"`, status uses marks (✓ – ○) as well as colour, and "Missed" is now a neutral "Not done". Scheduled-ness only counts from the day the plan began. |
| U-03 | Progress: lift picker lists only lifts with data (most recent first); one body-weight reading per day with Correct / Delete and a 7-day average; time-scaled x-axes; sets per muscle this week; personal bests show the best per exercise with history on tap; every chart has a spoken summary and a **View data** table. |
| U-05, F-04 | Dashboard: done-today state with "Train anyway", next-session preview, Resume banner. Skeletons instead of blank screens everywhere (`PageSkeleton`). |
| U-06 | `ErrorBoundary` with a calm recovery screen and an "Export my data first" action; real 404; toasts for saves; `navigate()`-during-render and state-during-render fixed earlier. |
| A-01, A-04, A-06 | One global `:focus-visible` ring (3 px); `<main>` landmark + skip link on every shell; each route sets `document.title` from its `<h1>` and moves focus to it (waiting for lazy routes); radiogroups / `aria-pressed` / fieldset+legend for choice groups; `prefers-reduced-motion` honoured; `min-h-dvh`, safe-area padding and `viewport-fit=cover`. |
| W-02, W-04 | `registerType: 'prompt'`: an update shows an "Update ready" prompt and is never offered while a workout is open. `clientsClaim`, `cleanupOutdatedCaches`, `/api` excluded from navigation fallback. |

## Tests
`e2e/` is a real Playwright Test suite (25 tests, run against the production build): workout durability, logger editing, progression, history, backup/import, offline, keyboard paths (skip link, route focus, focus ring, dialog focus + Esc, radiogroup arrows, keyboard-only set logging), and **axe** (WCAG 2 A/AA + 2.1) with no serious or critical violations on welcome, every onboarding step, all app screens, the active workout, dialogs, history and progress — in **both** themes. The old manual `scripts/*.mjs` drivers were removed.

Running the real app found two bugs that unit tests could not: browser form validation silently blocked "Complete set" (a `step` attribute made 12 kg "invalid"), and finishing a workout could redirect to the dashboard instead of the summary.

## Keyboard pass
Automated only (see `e2e/keyboard.spec.ts`). A manual screen-reader pass (VoiceOver / TalkBack) was **not** done and is worth doing before release.

## Size
Main JS 438.28 kB → **321.93 kB (−26.6 %)** after lazy-loading secondary routes; lazy chunks: `backup` 95 kB (zod), `Progress` (Recharts).
