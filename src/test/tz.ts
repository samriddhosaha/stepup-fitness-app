/** Runs fn with the process time zone temporarily set (Node applies TZ changes at runtime). */
export async function withTZ<T>(tz: string, fn: () => T | Promise<T>): Promise<T> {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    return await fn()
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}

export const TIME_ZONES = ['UTC', 'America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata'] as const
