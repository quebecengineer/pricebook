import { signal } from '@preact/signals'
import { loadAll, save } from './db'
import {
  bestPrice, empty, findByName, live, normalizeName, pricesOf, upsert,
  type Base, type Data, type Item, type Kind, type Price, type Store, type Unit,
} from './model'
import { count, newer } from './sync/merge'

export const data = signal<Data>(empty())
export const loaded = signal<'loading' | 'ready' | 'failed'>('loading')
/** Bumped on every local change; sync listens to it. */
export const localEdits = signal(0)

export async function load() {
  try {
    data.value = await loadAll()
    loaded.value = 'ready'
  } catch (e) {
    loaded.value = 'failed'
    throw e
  }
}

async function commit(changes: Partial<Data>, local = true) {
  await save(changes)
  data.value = upsert(data.value, changes)
  if (local) localEdits.value++
}

const touch = <T extends Base>(r: T): T => ({ ...r, updatedAt: Date.now() })
const create = <T extends Base>(fields: Omit<T, keyof Base>) =>
  ({ ...fields, id: crypto.randomUUID(), updatedAt: Date.now() }) as T
const one = <K extends Kind>(kind: K, r: Data[K][number]) => ({ [kind]: [r] }) as Partial<Data>

export interface Entry {
  item: string
  store: string
  cents: number
  qty: number
  unit: Unit
}

function resolve(e: Entry) {
  const { items, stores } = data.value
  const item = findByName(items, e.item) ?? create<Item>({ name: normalizeName(e.item), unit: e.unit })
  if (item.unit !== e.unit) throw new Error(`${item.name} is priced per ${item.unit}`)
  const store = findByName(stores, e.store) ?? create<Store>({ name: normalizeName(e.store) })
  const added = { items: items.includes(item) ? [] : [item], stores: stores.includes(store) ? [] : [store] }
  return { item, store, added }
}

/** Logs a price and reports the best it had to beat. */
export async function logPrice(e: Entry) {
  const { item, store, added } = resolve(e)
  const prevBest = bestPrice(pricesOf(data.value.prices, item.id))
  const price = create<Price>({ itemId: item.id, storeId: store.id, cents: e.cents, qty: e.qty, at: Date.now() })
  await commit({ ...added, prices: [price] })
  return { price, prevBest }
}

export async function editPrice(p: Price, e: Entry) {
  const { store, added } = resolve(e)
  await commit({ ...added, prices: [touch({ ...p, storeId: store.id, cents: e.cents, qty: e.qty })] })
}

/** An empty id returns the item to automatic categorizing. */
export const setCategory = (item: Item, id: string) =>
  commit(one('items', touch({ ...item, category: id || undefined })))

/** Tombstones a record and returns its undo. */
export async function remove<K extends Kind>(kind: K, r: Data[K][number]) {
  await commit(one(kind, touch({ ...r, deleted: true as const })))
  return () => commit(one(kind, touch(r)))
}

const REF = { items: 'itemId', stores: 'storeId' } as const

/** Renames; renaming onto an existing name merges the two and returns the survivor. */
export async function rename(kind: 'items' | 'stores', r: Item | Store, name: string): Promise<Item | Store | undefined> {
  const clean = normalizeName(name)
  if (!clean) throw new Error('Name is required')
  const target = findByName<Item | Store>(data.value[kind], clean)
  if (!target || target.id === r.id) {
    await commit(one(kind, touch({ ...r, name: clean })))
    return undefined
  }
  if ('unit' in r && 'unit' in target && r.unit !== target.unit) {
    throw new Error(`${target.name} is priced per ${target.unit}`)
  }
  const ref = REF[kind]
  const moved = live(data.value.prices).filter((p) => p[ref] === r.id).map((p) => touch({ ...p, [ref]: target.id }))
  await commit({ prices: moved, ...one(kind, touch({ ...r, deleted: true as const })) })
  return target
}

/** Pulls in records newer than ours; `behind` means `other` lacks some of ours. */
export async function absorb(other: Data, local: boolean) {
  const incoming = newer(other, data.value)
  const pulled = count(incoming)
  if (pulled) await commit(incoming, local)
  return { pulled, behind: count(newer(data.value, other)) > 0 }
}
