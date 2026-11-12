import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { KINDS, type Data, type Item, type Price, type Store } from './model'
import type { BackupKey } from './sync/crypto'

interface Schema extends DBSchema {
  items: { key: string; value: Item }
  stores: { key: string; value: Store }
  prices: { key: string; value: Price }
  keys: { key: string; value: BackupKey }
}

const BACKUP_KEY = 'backup'
let db: Promise<IDBPDatabase<Schema>> | undefined

/** Upgrades only ever add stores, so data saved by earlier versions is kept as is. */
const open = () =>
  (db ??= openDB<Schema>('pricebook', 2, {
    upgrade(d) {
      for (const kind of KINDS) if (!d.objectStoreNames.contains(kind)) d.createObjectStore(kind, { keyPath: 'id' })
      if (!d.objectStoreNames.contains('keys')) d.createObjectStore('keys')
    },
    blocked() {
      globalThis.alert?.('Pricebook is updating. Close its other tabs or windows to finish.')
    },
    blocking() {
      void db?.then((d) => d.close())
      db = undefined
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

/** The backup key is a non-extractable CryptoKey: it can encrypt here but can't be read out as bytes. */
export const loadKey = async () => (await open()).get('keys', BACKUP_KEY)
export const saveKey = async (key: BackupKey) => void (await open()).put('keys', key, BACKUP_KEY)
export const deleteKey = async () => (await open()).delete('keys', BACKUP_KEY)
