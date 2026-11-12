import type { Item } from './model'
import { TAXONOMY, WEAK } from './taxonomy'

export interface Category {
  id: string
  name: string
  parent?: string
  depth: number
}
/** A dictionary hit: the category and the term in the name that chose it. */
export interface Match {
  id: string
  term: string
}

/** Unicode-folds (NFKD, accents stripped), lowercases and splits on anything but letters and digits. */
const words = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

export const fold = (text: string) => words(text).join(' ')

/** Harman's S-stemmer, extended for -ches, -shes, -xes, -zes and -oes plurals. */
export function stem(word: string) {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (/(ch|sh|x|z|o)es$/.test(word)) return word.slice(0, -2)
  if (/[^su]s$/.test(word) && !word.endsWith('is')) return word.slice(0, -1)
  return word
}

export const tokens = (text: string) => words(text).map(stem)

export const CATEGORIES: Category[] = []
const byId = new Map<string, Category>()
const TERMS = new Map<string, Match>()
let longest = 1

for (const [id, name, parent, terms] of TAXONOMY) {
  const c = { id, name, parent: parent || undefined, depth: (byId.get(parent)?.depth ?? 0) + 1 }
  CATEGORIES.push(c)
  byId.set(id, c)
  for (const term of terms.split(',').map((t) => t.trim()).filter(Boolean)) {
    const key = tokens(term)
    TERMS.set(key.join(' '), { id, term })
    longest = Math.max(longest, key.length)
  }
}

export const category = (id?: string) => (id ? byId.get(id) : undefined)

/** The longest dictionary phrase starting at word `at`, and how many words it spans. */
function longestAt(list: string[], at: number): [Match | undefined, number] {
  for (let n = Math.min(longest, list.length - at); n > 0; n--) {
    const match = TERMS.get(list.slice(at, at + n).join(' '))
    if (match) return [match, n]
  }
  return [undefined, 1]
}

/** Head-noun rule: a later match replaces an earlier one, except that a weak match never replaces a strong one. */
export function categorize(name: string): Match | undefined {
  const list = tokens(name)
  let pick: Match | undefined
  for (let at = 0; at < list.length; ) {
    const [match, size] = longestAt(list, at)
    if (match && !(pick && WEAK.has(match.id) && !WEAK.has(pick.id))) pick = match
    at += size
  }
  return pick
}

/** Your override when it is a known id, otherwise the dictionary's pick. */
export const categoryOf = (item: Item) => (category(item.category) ? item.category : categorize(item.name)?.id)

/** The category and its ancestors, nearest first. */
export function pathOf(id?: string) {
  const path: string[] = []
  for (let c = category(id); c; c = category(c.parent)) path.push(c.id)
  return path
}

const MIN_TERM = 2

/** Categories a folded search phrase names exactly, or whose name it begins. */
function named(phrase: string) {
  const ids = new Set<string>()
  if (phrase.length < MIN_TERM) return ids
  const exact = TERMS.get(tokens(phrase).join(' '))
  if (exact) ids.add(exact.id)
  for (const c of CATEGORIES) if (fold(c.name).startsWith(phrase)) ids.add(c.id)
  return ids
}

/**
 * Matches an item when the whole query names one of its categories, or when every query word is in its name
 * or names one of its categories. Plain substring matches therefore still work.
 */
export function searcher(query: string): (item: Item) => boolean {
  const q = fold(query)
  if (!q) return () => true
  const whole = named(q)
  const parts = q.split(' ').map((word) => [word, named(word)] as const)
  return (item) => {
    const name = fold(item.name)
    const path = pathOf(categoryOf(item))
    const within = (ids: Set<string>) => path.some((id) => ids.has(id))
    return within(whole) || parts.every(([word, ids]) => name.includes(word) || within(ids))
  }
}
