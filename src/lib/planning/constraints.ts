import type { Equipment, Exercise, FitnessLevel, InjuryArea, Profile } from '../../db/types'

// Hard rules for what may appear in a plan. Injuries and exclusions are never relaxed;
// only the skill ceiling can be (and only when nothing else is left for a slot).

const AREA_PATTERNS: [InjuryArea, RegExp][] = [
  ['lower-back', /\b(back|spine|spinal|lumbar|disc|disk|sciatic\w*|herniat\w*)\b/i],
  ['knee', /\b(knees?|acl|mcl|meniscus|patell\w*)\b/i],
  ['shoulder', /\b(shoulders?|rotator|labrum|impingement)\b/i],
  ['wrist-elbow', /\b(wrists?|elbows?|carpal|tendin\w*|tennis elbow)\b/i],
  ['neck', /\b(neck|cervical)\b/i],
  ['hip', /\b(hips?|groin|hip flexor)\b/i],
]

/** Reads free-text injury notes (older profiles, "other" notes) into body areas. */
export function inferInjuryAreas(text: string | undefined): InjuryArea[] {
  if (!text) return []
  return AREA_PATTERNS.filter(([, re]) => re.test(text)).map(([area]) => area)
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[-_/’'`]/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function singular(w: string): string {
  if (w.length <= 2) return w
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`
  if (/(ss|us|is)$/.test(w)) return w
  if (/(sh|ch|x|z|ss)es$/.test(w)) return w.slice(0, -2)
  return w.endsWith('s') ? w.slice(0, -1) : w
}

const LEAD =
  /^(no|not|never|avoid|skip|without|nothing|please no|(i )?(do not|don t|dont|can t|cant|cannot) (like|want|do)( any)?|(i )?(hate|dislike)|stay away from)\s+/

// A few plain-language words people use for what the library calls something else.
const SYNONYMS: Record<string, string[]> = {
  running: ['jog'],
  run: ['jog'],
  cardio: ['conditioning', 'jog', 'interval', 'bike', 'walk', 'rope'],
  jumping: ['jump'],
  pushup: ['push up'],
  pullup: ['pull up'],
  chinup: ['chin up'],
  situp: ['crunch'],
  weights: ['dumbbell', 'barbell'],
  stretching: ['stretch', 'mobility'],
}

export interface Keywords {
  /** Normalised phrases; an exercise matching any of them is excluded. */
  phrases: string[]
}

/**
 * Turns "no squats, avoid burpees and lunges" into match phrases. With `requireLead`, only
 * fragments that actually say no/avoid/hate count (used for injury notes, where plain
 * fragments like "bad lower back" describe a condition, not an exercise).
 */
export function parseExclusions(text: string | undefined, requireLead = false): Keywords {
  if (!text) return { phrases: [] }
  const phrases = new Set<string>()
  for (const raw of text.split(/[,;\n.]| and | but /i)) {
    let frag = norm(raw)
    if (!frag) continue
    const hadLead = LEAD.test(frag)
    if (requireLead && !hadLead) continue
    frag = frag.replace(LEAD, '').replace(/^(any|all|the|doing)\s+/, '').trim()
    if (frag.length < 3) continue
    const words = frag.split(' ').map(singular)
    const phrase = words.join(' ')
    phrases.add(phrase)
    for (const w of words) for (const syn of SYNONYMS[w] ?? SYNONYMS[w.replace(/s$/, '')] ?? []) phrases.add(syn)
    if (words.length === 1 && SYNONYMS[words[0]!]) for (const syn of SYNONYMS[words[0]!]!) phrases.add(syn)
  }
  return { phrases: [...phrases] }
}

function haystack(e: Exercise): string {
  return norm(
    [e.name, e.id, e.movementPattern, e.substitutionGroupId, e.kit, ...e.primaryMuscles].join(' '),
  )
    .split(' ')
    .map(singular)
    .join(' ')
}

export function matchesKeywords(e: Exercise, k: Keywords): boolean {
  if (k.phrases.length === 0) return false
  const hay = ` ${haystack(e)} `
  return k.phrases.some((p) => hay.includes(` ${p} `) || hay.includes(` ${p}`))
}

export function isAvailable(e: Exercise, equipment: Equipment[]): boolean {
  return e.equipmentRequired.some((eq) => eq === 'none' || equipment.includes(eq))
}

/** Highest skill a person at this level is given in a plan. */
export const SKILL_CEILING: Record<FitnessLevel, 1 | 2 | 3> = { new: 1, regular: 2, experienced: 3 }

export interface Constraints {
  injuryAreas: Set<InjuryArea>
  keywords: Keywords
  avoided: Set<string>
  equipment: Equipment[]
  level: FitnessLevel
  gentle: boolean
}

export function constraintsFor(profile: Profile): Constraints {
  const areas = new Set<InjuryArea>([...(profile.injuryAreas ?? []), ...inferInjuryAreas(profile.injuries)])
  const keywords = parseExclusions(profile.exclusions)
  const fromInjuries = parseExclusions(profile.injuries, true)
  return {
    injuryAreas: areas,
    keywords: { phrases: [...new Set([...keywords.phrases, ...fromInjuries.phrases])] },
    avoided: new Set(profile.avoidedExerciseIds ?? []),
    equipment: profile.equipment,
    level: profile.fitnessLevel,
    gentle: Boolean(profile.gentleStart),
  }
}

/** Safety and preference rules that are never relaxed. */
export function isPermitted(e: Exercise, c: Constraints): boolean {
  if (!isAvailable(e, c.equipment)) return false
  if (c.avoided.has(e.id)) return false
  if (e.contraindications.some((a) => c.injuryAreas.has(a))) return false
  if (matchesKeywords(e, c.keywords)) return false
  return true
}

/** Skill ceiling for this person; `relax` lets a slot with nothing left look one step higher (never to 3 for beginners). */
export function skillOk(e: Exercise, c: Constraints, relax = false): boolean {
  if (c.gentle) return e.skill === 1 && (relax || e.kit !== 'barbell')
  const ceiling = SKILL_CEILING[c.level] + (relax ? 1 : 0)
  const cap = c.level === 'new' ? 2 : 3
  if (c.level === 'new' && !relax && !e.beginnerFriendly) return false
  return e.skill <= Math.min(ceiling, cap)
}
