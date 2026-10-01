# Baseline (before remediation, branch audit/remediation @ restyle commit)

- `npm run check`: passes (lint, typecheck, test, build).
- Lint: 1 warning (react/only-export-components in src/lib/theme.tsx). Only two oxlint rules configured.
- Typecheck: 0 errors. `tsc --showConfig -p tsconfig.app.json` shows **no `strict`** flag, so strict mode is effectively off.
- Tests: 4 files, 19 tests, all pass.
- Build: `dist/` ≈ 1370 KB on disk. Largest JS: `index` 438.28 kB (135.94 kB gzip), `Progress` 381.65 kB (109.90 kB gzip, lazy). CSS 28.04 kB.
- Fonts: all Inter + IBM Plex Mono unicode-range subsets are emitted and precached.
- PWA precache: 31 entries, 1172.78 KiB.
