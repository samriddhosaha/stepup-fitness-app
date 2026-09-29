# Forge

A personal trainer that lives in your phone. Fully local-first strength-training tracker — no account, no server, no data leaving the device unless you explicitly opt in.

Rebuilt per `FORGE_AUDIT.md` and `BUILD_GUIDE.md` (see the parent directory).

## Stack

Vite + React 19 + TypeScript + Tailwind CSS v4 + React Router + Dexie (IndexedDB) + Recharts + vite-plugin-pwa.

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run test      # vitest
npm run lint      # oxlint
```

## Optional AI weekly coach

Off by default. To test it locally with `vercel dev`, or after deploying to Vercel:

```bash
cp .env.example .env
# then fill in GEMINI_API_KEY=
```

Without a configured key, the app falls back to a local, rules-based weekly recap — the AI coach never blocks the core app.

## Architecture notes

- **Fully local-first.** All data lives in IndexedDB via Dexie. The only network call in the entire app is the opt-in AI weekly coach (`api/weekly-review.ts`), and it's a single-shot, stateless summarization call to the Gemini API — no chat, no persisted session, no data stored server-side.
- **Design tokens** live in `src/index.css` as CSS custom properties, mapped into Tailwind's `@theme`. The `--c-faint` values were recalculated from the original audit spec to actually clear WCAG AA (4.5:1) against both `canvas` and `elevated` in both themes — see the comment in that file.
- **`scripts/`** holds one-off tooling: `gen-icons.mjs` (regenerates PWA icons), and Playwright-based manual QA drivers (`drive*.mjs`, `offline-test.mjs`) used to smoke-test flows headlessly — not part of the automated test suite.
