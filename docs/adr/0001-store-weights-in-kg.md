# 0001 — Store weights in kg

**Status:** accepted.

**Context:** users choose kg or lb.

**Decision:** the database and every API contract hold kilograms. Conversion and unit-native rounding (2.5 kg / 5 lb plates, dumbbell steps) happen only at the UI edge (`src/lib/units.ts`).

**Consequences:** switching units never rewrites data. lb users see tidy numbers because loads are snapped to lb grids before being converted back. Any new weight field must go through `formatWeight` / `parseWeight`.
