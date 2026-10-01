# 0004 — AI coach contract

**Status:** accepted.

**Decision:** `buildWeeklyReviewPayload()` is the single place that defines what leaves the device. Its shape is the zod schema in `shared/weeklyReviewSchema.ts`, shared by client and server. The server resolves exercise names from the library (unknown IDs are rejected), validates origin, size and schema, rate-limits per IP, install token and day, times out upstream calls, returns generic errors and cleans the model's output (no "!", no markdown, bounded length). The client caches one review per week, fetches only when the AI section is opened or Refresh is tapped (at most every six hours), and shows the exact payload on request.

**Consequences:** custom exercises are excluded from the payload. Changing the payload means changing the shared schema and the consent copy together.
