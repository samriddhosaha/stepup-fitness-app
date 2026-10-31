# 0005 — Coach: opt-in wellbeing summary, plan-next-week, and no bring-your-own-key

**Status:** accepted. Extends [0004](0004-ai-coach-contract.md); does not replace it.

**Decision:**

1. `buildWeeklyReviewPayload()` still defines everything that leaves the device, and `shared/weeklyReviewSchema.ts` still validates it on both sides. Two optional fields were added to that schema:
   - `focus: 'review' | 'next-week'` picks the instruction the server gives the model. Absent means the usual review.
   - `wellbeing` holds 7-day averages of protein and calories (with the protein target), sleep, soreness and energy from check-ins, and daily water. Averages only: no food names, no habit names, no free text. All ranges are bounded and every object is `.strict()`.
2. `wellbeing` is a **second, separate consent** (`profile.aiCoachIncludeHealth`), asked for with its own dialog that lists what it adds. It is off by default and the key is absent from the payload unless it is on and there is something to send. Turning the coach off clears it, so turning the coach back on never sends more than was agreed to in that dialog. The Preview button shows the exact payload, including this section.
3. "Plan next week" is the same request with `focus: 'next-week'`. It is cached under `next:<Monday>` in `weeklyReviews`, so it has its own six-hour floor and never overwrites the review.
4. The on-device recap that always shows on Home gained a sentence on protein and sleep. It is computed locally from the same summary function and needs no opt-in because nothing leaves the device.
5. **Bring-your-own-key was not built.** A browser-direct call to Google needs the deliberate `connect-src 'self'` in `vercel.json` loosened; the alternative, sending the person's key to this app's server so it can forward it, puts a secret in a place the app otherwise never holds. Neither is worth it for a convenience feature, and the hosted path already has a local fallback. If this is revisited, it should be an explicit decision to add one origin to `connect-src`, with the key kept in `settings` (never in backups) and sent in a header, not a URL.

**Consequences:** changing what the coach sends still means changing the shared schema and the consent copy together; `api/weekly-review.test.ts` and `src/lib/recap.test.ts` pin that the extra section is absent by default, contains no names, and is rejected when out of range or padded with extra keys.
