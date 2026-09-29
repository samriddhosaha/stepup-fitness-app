import { GoogleGenAI } from '@google/genai'

// Minimal request/response shape — deliberately not depending on
// @vercel/node's types (its old transitive deps carry known CVEs); Vercel's
// Node runtime hands this handler a plain Node-style req/res regardless.
interface ApiRequest {
  method?: string
  body: unknown
}
interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
}

interface WeeklyReviewPayload {
  sessionsCompleted: number
  sessionsPlanned: number
  exercises: { exerciseName: string; totalSets: number; avgRpe: number | null; metTargetRange: boolean }[]
  skips: { exerciseName: string; reason: string; count: number }[]
  prs: { exerciseName: string; value: number }[]
  streak: number
  bodyWeightTrendKg: { start: number; end: number } | null
}

const SYSTEM_PROMPT = `You write a single short weekly training review for Forge, a calm, local-first strength-training app. Match this exact voice — non-toxic-positivity, no exclamation points, no streak-shaming, no hype:

"Nothing to prove today. Just begin."
"Rest is part of the plan, not a break from it."
"You do not need a perfect week. Just the next workout."
"That load has been a grind. Back off slightly and build again."

Write ONE short paragraph (2-4 sentences). Reference specific numbers and exercise names from the data you're given — never generic filler. End with at most one concrete, specific suggestion (or none, if nothing stands out). Do not use exclamation points. Do not use the words "great job", "amazing", "crushing it", or similar hype language. Output plain text only, no markdown, no greeting, no signature.`

function buildUserMessage(payload: WeeklyReviewPayload): string {
  return JSON.stringify(payload, null, 2)
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'AI coach is not configured on this deployment.' })
    return
  }

  const payload = req.body as WeeklyReviewPayload

  try {
    const ai = new GoogleGenAI({ apiKey })
    // flash-lite is plenty for a single-paragraph summarization task, and
    // was verified reliable against this key at build time — gemini-3.8's
    // full "flash" tier was returning transient 503 (high demand) errors.
    const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'

    const response = await ai.models.generateContent({
      model,
      contents: buildUserMessage(payload),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 300,
      },
    })

    const review = (response.text ?? '').trim()
    if (!review) throw new Error('Empty response from model.')

    res.status(200).json({ review })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'AI review failed.' })
  }
}
