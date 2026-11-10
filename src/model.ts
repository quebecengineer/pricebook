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

export const unitPrice = (p: Price) => p.cents / p.qty
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

/** Most recent price at each store, cheapest first. */
export function latestByStore(prices: Price[]) {
  const latest = new Map<string, Price>()
  for (const p of live(prices)) {
    const current = latest.get(p.storeId)
    if (!current || p.at > current.at) latest.set(p.storeId, p)
  }
  return [...latest.values()].sort((a, b) => unitPrice(a) - unitPrice(b))
}

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
    deltaPct: min ? Math.round((unitPrice(price) / min - 1) * 100) : 0,
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
  best?: Price
}

export function rows({ items, prices }: Data, query: string): Row[] {
  const q = key(query)
  const best = bestByItem(prices)
  return live(items)
    .filter((i) => i.name.toLocaleLowerCase().includes(q))
    .sort(byName)
    .map((item) => ({ item, best: best.get(item.id) }))
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

/** Groups already-sorted rows under their first letter, for an indexed list. */
export function sections(list: Row[]): [string, Row[]][] {
  const groups = new Map<string, Row[]>()
  for (const row of list) {
    const letter = letterOf(row.item.name)
    groups.set(letter, [...(groups.get(letter) ?? []), row])
  }
  return [...groups]
}

/** Replaces records by id. */
export const upsert = (data: Data, changes: Partial<Data>): Data => ({
  items: replace(data.items, changes.items),
  stores: replace(data.stores, changes.stores),
  prices: replace(data.prices, changes.prices),
})
