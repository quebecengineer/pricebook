import { searcher } from './categories'

export type Unit = 'kg' | 'L' | 'pc'
export const UNITS: readonly Unit[] = ['kg', 'L', 'pc']

export interface Base {
  id: string
  updatedAt: number
  deleted?: true
}
export interface Item extends Base {
  name: string
  unit: Unit
  /** Taxonomy id you picked; when absent the name decides. */
  category?: string
}
export interface Store extends Base {
  name: string
}
/** `cents` is hundredths of the currency; `qty` is in the item's base unit. */
export interface Price extends Base {
  itemId: string
  storeId: string
  cents: number
  qty: number
  at: number
}

export interface Data {
  items: Item[]
  stores: Store[]
  prices: Price[]
}
export type Kind = keyof Data
export const KINDS: readonly Kind[] = ['items', 'stores', 'prices']
export const empty = (): Data => ({ items: [], stores: [], prices: [] })

export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ')
const key = (name: string) => normalizeName(name).toLocaleLowerCase()

export const live = <T extends Base>(list: T[]) => list.filter((r) => !r.deleted)
export const byId = <T extends Base>(list: T[]) => new Map(list.map((r) => [r.id, r]))
export const findByName = <T extends Base & { name: string }>(list: T[], name: string) =>
  live(list).find((r) => key(r.name) === key(name))

export const nameOf = (list: Store[], id: string) => list.find((r) => r.id === id)?.name ?? 'Unknown store'
export const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/** Rounded to a millionth of a cent so equal prices compare equal despite float noise in stored quantities. */
export const perUnit = (cents: number, qty: number) => Math.round((cents / qty) * 1e6) / 1e6
export const unitPrice = (p: Price) => perUnit(p.cents, p.qty)
export const pricesOf = (prices: Price[], itemId: string) =>
  live(prices).filter((p) => p.itemId === itemId)

/** Strictly cheaper wins; on a tie the earlier entry keeps the title. */
const cheaper = (a: Price, b: Price) =>
  unitPrice(a) < unitPrice(b) || (unitPrice(a) === unitPrice(b) && a.at < b.at)

export const bestPrice = (prices: Price[]) =>
  live(prices).reduce<Price | undefined>((best, p) => (!best || cheaper(p, best) ? p : best), undefined)

export function bestByItem(prices: Price[]) {
  const best = new Map<string, Price>()
  for (const p of live(prices)) {
    const current = best.get(p.itemId)
    if (!current || cheaper(p, current)) best.set(p.itemId, p)
  }
  return best
}

function latestBy(prices: Price[], keyOf: (p: Price) => string) {
  const latest = new Map<string, Price>()
  for (const p of live(prices)) {
    const current = latest.get(keyOf(p))
    if (!current || p.at > current.at) latest.set(keyOf(p), p)
  }
  return [...latest.values()]
}

/** Most recent price at each store, cheapest first. */
export const latestByStore = (prices: Price[]) =>
  latestBy(prices, (p) => p.storeId).sort((a, b) => unitPrice(a) - unitPrice(b))

/** What each item costs now: the cheapest of its latest prices at each store. */
export const currentByItem = (prices: Price[]) => bestByItem(latestBy(prices, (p) => `${p.itemId} ${p.storeId}`))

/** Percent above the cheapest unit price; 0 for the cheapest. */
export const pctAbove = (price: number, min: number) => (min ? Math.round((price / min - 1) * 100) : 0)

export interface Comparison {
  price: Price
  /** Unit price relative to the dearest store, for bar widths. */
  ratio: number
  /** Percent above the cheapest store; 0 for the cheapest. */
  deltaPct: number
}

export function compare(prices: Price[]): Comparison[] {
  const latest = latestByStore(prices)
  const min = latest[0] ? unitPrice(latest[0]) : 0
  const max = latest.length ? unitPrice(latest[latest.length - 1]!) : 0
  return latest.map((price) => ({
    price,
    ratio: max ? unitPrice(price) / max : 1,
    deltaPct: pctAbove(unitPrice(price), min),
  }))
}

/** Stores you have logged prices at, most recently used first. */
export function recentStores({ stores, prices }: Data, limit: number) {
  const last = new Map<string, number>()
  for (const p of live(prices)) last.set(p.storeId, Math.max(last.get(p.storeId) ?? 0, p.at))
  return live(stores)
    .filter((s) => last.has(s.id))
    .sort((a, b) => last.get(b.id)! - last.get(a.id)!)
    .slice(0, limit)
}

const STALE_MS = 90 * 86_400_000
export const isStale = (at: number, now = Date.now()) => now - at > STALE_MS

export interface Row {
  item: Item
  /** All-time best, or the current price when ranking by cost. */
  price?: Price
}

const byItem = (a: Row, b: Row) => byName(a.item, b.item) || a.item.id.localeCompare(b.item.id)
const costOf = (r: Row) => (r.price ? unitPrice(r.price) : Infinity)

/** Unit, then cheapest, then freshest; unpriced rows last. Infinity - Infinity is NaN, which falls through. */
const byCost = (a: Row, b: Row) =>
  UNITS.indexOf(a.item.unit) - UNITS.indexOf(b.item.unit) ||
  costOf(a) - costOf(b) ||
  (b.price?.at ?? 0) - (a.price?.at ?? 0) ||
  byItem(a, b)

/** Items matching `query` by name or category, A–Z or (with `cheapest`) ranked by current unit price. */
export function rows({ items, prices }: Data, query: string, cheapest = false): Row[] {
  const price = (cheapest ? currentByItem : bestByItem)(prices)
  return live(items)
    .filter(searcher(query))
    .map((item) => ({ item, price: price.get(item.id) }))
    .sort(cheapest ? byCost : byItem)
}

function replace<T extends Base>(list: T[], changes: T[] = []) {
  if (!changes.length) return list
  const map = new Map(list.map((r) => [r.id, r]))
  for (const r of changes) map.set(r.id, r)
  return [...map.values()]
}

const letterOf = (name: string) => {
  const ch = name.normalize('NFD').charAt(0).toLocaleUpperCase()
  return /\p{L}/u.test(ch) ? ch : '#'
}

/** Groups already-sorted rows by key; by default under their first letter, for an indexed list. */
export function sections(list: Row[], keyOf = (r: Row) => letterOf(r.item.name)): [string, Row[]][] {
  const groups = new Map<string, Row[]>()
  for (const row of list) {
    const k = keyOf(row)
    groups.set(k, [...(groups.get(k) ?? []), row])
  }
  return [...groups]
}

/** Replaces records by id. */
export const upsert = (data: Data, changes: Partial<Data>): Data => ({
  items: replace(data.items, changes.items),
  stores: replace(data.stores, changes.stores),
  prices: replace(data.prices, changes.prices),
})
