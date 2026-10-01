# 0003 — Local-first constraints

**Status:** accepted.

**Decision:** no accounts, no server-side user store, no third-party analytics or tracking. User data lives in IndexedDB; backup is a user-initiated file. The sole network call is the opt-in AI weekly review, which sends only exercise IDs and aggregates.

**Consequences:** durability depends on the browser, so StepUp asks for persistent storage after the first workout, tracks the last backup, and nudges after ten workouts without one. Anything that would require a user store or tracking is out of scope and needs a new ADR.
