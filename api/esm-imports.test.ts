// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The serverless function runs as plain Node ESM, which requires file extensions on relative
// imports. Everything it reaches at runtime must follow that rule (vitest/Vite don't enforce it,
// which is how the first deploy crashed). Type-only imports are erased and exempt.
const REACHABLE = ['api/weekly-review.ts', 'shared/weeklyReviewSchema.ts', 'shared/rateLimit.ts', 'shared/cleanReview.ts', 'shared/skipReasons.ts', 'src/db/exerciseLibrary.ts', 'src/db/exerciseData.ts']

describe('server-reachable modules use extension-qualified relative imports', () => {
  for (const file of REACHABLE) {
    it(file, () => {
      const src = readFileSync(file, 'utf8')
      const bad = [...src.matchAll(/^import\s+(?!type\b)[^'"]*from\s+['"](\.[^'"]+)['"]/gm)]
        .map((m) => m[1]!)
        .filter((spec) => !/\.(js|json)$/.test(spec))
      expect(bad).toEqual([])
    })
  }
})
