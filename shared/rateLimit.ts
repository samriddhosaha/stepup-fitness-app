// Sliding-window limiter. Uses Upstash Redis over its REST API when
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set (no SDK needed);
// otherwise falls back to a per-instance in-memory limiter and warns once.
// ponytail: in-memory fallback is per serverless instance — configure Upstash for a real global limit.

export interface RateResult {
  ok: boolean
  retryAfterSeconds: number
}

const memory = new Map<string, number[]>()
let warned = false

export function resetMemoryLimiterForTests(): void {
  memory.clear()
  warned = false
}

function memoryLimit(key: string, limit: number, windowMs: number, now: number): RateResult {
  const hits = (memory.get(key) ?? []).filter((t) => t > now - windowMs)
  if (hits.length >= limit) {
    memory.set(key, hits)
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((hits[0]! + windowMs - now) / 1000)) }
  }
  hits.push(now)
  memory.set(key, hits)
  // keep the map from growing without bound on a long-lived instance
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (!v.some((t) => t > now - windowMs)) memory.delete(k)
  }
  return { ok: true, retryAfterSeconds: 0 }
}

async function upstashLimit(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<RateResult> {
  const k = `stepup:rl:${key}`
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['ZREMRANGEBYSCORE', k, '0', String(now - windowMs)],
      ['ZADD', k, String(now), `${now}-${Math.random().toString(36).slice(2, 8)}`],
      ['ZCARD', k],
      ['PEXPIRE', k, String(windowMs)],
    ]),
    signal: AbortSignal.timeout(2000),
  })
  if (!res.ok) throw new Error(`rate-limit store responded ${res.status}`)
  const out = (await res.json()) as { result: number }[]
  const count = out[2]?.result ?? 0
  return count > limit
    ? { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)) }
    : { ok: true, retryAfterSeconds: 0 }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    try {
      return await upstashLimit(url, token, key, limit, windowMs, now)
    } catch (err) {
      console.warn('[weekly-review] rate-limit store unavailable, using in-memory limiter', err)
    }
  } else if (!warned) {
    warned = true
    console.warn('[weekly-review] UPSTASH_REDIS_REST_URL not set — using in-memory rate limiter')
  }
  return memoryLimit(key, limit, windowMs, now)
}
