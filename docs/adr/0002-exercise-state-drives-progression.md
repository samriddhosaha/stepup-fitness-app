# 0002 — Progression reads `exerciseState`, not the plan

**Status:** accepted.

**Context:** the original engine compared results to the plan's static starting load, so suggestions could never rise past one step (audit C-01).

**Decision:** plans are declarative (exercises, sets, rep ranges, rest). A per-exercise `exerciseState` row (last working weight, reps per set, effort, failure count) is updated atomically when a session finishes. Double progression, holds and deloads read only that.

**Consequences:** rebuilding or editing a plan keeps every load. Swapped exercises have their own state. The first time someone meets a loaded lift they calibrate a weight instead of receiving a demographic guess.
