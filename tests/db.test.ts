import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'

describe('database upgrade', () => {
  it('keeps every record saved by the previous version', async () => {
    const v1 = await openDB('pricebook', 1, {
      upgrade(d) {
        for (const kind of ['items', 'stores', 'prices']) d.createObjectStore(kind, { keyPath: 'id' })
      },
    })
    await v1.put('items', { id: 'i', name: 'Milk', unit: 'L', updatedAt: 1 })
    await v1.put('stores', { id: 's', name: 'Lidl', updatedAt: 1 })
    await v1.put('prices', { id: 'p', itemId: 'i', storeId: 's', cents: 99, qty: 1, at: 1, updatedAt: 1 })
    v1.close()

    const { loadAll, loadKey } = await import('../src/db')
    const data = await loadAll()
    expect(data.items.map((i) => i.name)).toEqual(['Milk'])
    expect(data.stores.map((s) => s.name)).toEqual(['Lidl'])
    expect(data.prices.map((p) => p.cents)).toEqual([99])
    expect(await loadKey()).toBeUndefined()
  })
})
