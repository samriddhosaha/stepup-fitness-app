/** Enforces the voice rules the prompt only requests: no "!", no markdown, bounded length. */
export function cleanReview(raw: string, maxChars = 600): string {
  let t = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`#~]/g, '')
    .replace(/!/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim()
  if (t.length > maxChars) {
    const cut = t.slice(0, maxChars)
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.'))
    t = lastStop > maxChars * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…'
  }
  return t
}
