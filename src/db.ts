import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { KINDS, type Data, type Item, type Price, type Store } from './model'

interface Schema extends DBSchema {
  items: { key: string; value: Item }
  stores: { key: string; value: Store }
  prices: { key: string; value: Price }
}

let db: Promise<IDBPDatabase<Schema>> | undefined

const open = () =>
  (db ??= openDB<Schema>('pricebook', 1, {
    upgrade(d) {
      for (const kind of KINDS) d.createObjectStore(kind, { keyPath: 'id' })
    },
  }))

export async function loadAll(): Promise<Data> {
  const d = await open()
  const [items, stores, prices] = await Promise.all([d.getAll('items'), d.getAll('stores'), d.getAll('prices')])
  return { items, stores, prices }
}

/** Writes all changes in one transaction: everything lands or nothing does. */
export async function save(changes: Partial<Data>) {
  const tx = (await open()).transaction(KINDS, 'readwrite')
  const puts = [
    ...(changes.items ?? []).map((r) => tx.objectStore('items').put(r)),
    ...(changes.stores ?? []).map((r) => tx.objectStore('stores').put(r)),
    ...(changes.prices ?? []).map((r) => tx.objectStore('prices').put(r)),
  ]
  await Promise.all([...puts, tx.done])
}
