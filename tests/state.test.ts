import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadAll } from '../src/db'
import { bestPrice, pricesOf } from '../src/model'
import { absorb, data, editPrice, load, localEdits, logPrice, remove, rename } from '../src/state'

const entry = (item: string, store: string, cents: number, qty = 1) => ({ item, store, cents, qty, unit: 'kg' as const })
const milk = () => data.value.items.find((i) => i.name === 'Milk')!

beforeAll(load)

describe('state', () => {
  it('creates item and store on first log, with no previous best', async () => {
    const { prevBest } = await logPrice(entry('Milk', 'Lidl', 300))
    expect(prevBest).toBeUndefined()
    expect(data.value.items).toHaveLength(1)
    expect(localEdits.value).toBe(1)
  })

  it('reuses names case-insensitively and reports the best to beat', async () => {
    const { prevBest } = await logPrice(entry(' milk ', 'ALDI', 250))
    expect(prevBest?.cents).toBe(300)
    expect(data.value.items).toHaveLength(1)
    expect(data.value.stores).toHaveLength(2)
  })

  it('rejects a unit that conflicts with the item', async () => {
    await expect(logPrice({ ...entry('Milk', 'Lidl', 1), unit: 'pc' })).rejects.toThrow(/per kg/)
  })

  it('persists to IndexedDB', async () => {
    expect((await loadAll()).prices).toHaveLength(2)
  })

  it('edits a price and recomputes the best', async () => {
    const cheapest = bestPrice(pricesOf(data.value.prices, milk().id))!
    await editPrice(cheapest, entry('Milk', 'ALDI', 400))
    expect(bestPrice(pricesOf(data.value.prices, milk().id))?.cents).toBe(300)
  })

  it('tombstones on remove and restores on undo', async () => {
    const undo = await remove('items', milk())
    expect(data.value.items[0]?.deleted).toBe(true)
    await undo()
    expect(data.value.items[0]?.deleted).toBeUndefined()
  })

  it('merges stores when renamed onto an existing name', async () => {
    const aldi = data.value.stores.find((s) => s.name === 'ALDI')!
    const survivor = await rename('stores', aldi, 'lidl')
    expect(survivor?.name).toBe('Lidl')
    expect(pricesOf(data.value.prices, milk().id).every((p) => p.storeId === survivor?.id)).toBe(true)
  })

  it('absorbs newer remote records without counting them as local edits', async () => {
    const before = localEdits.value
    const remote = { items: [{ ...milk(), name: 'Whole milk', updatedAt: Date.now() + 1000 }], stores: [], prices: [] }
    const { pulled, behind } = await absorb(remote, false)
    expect(data.value.items[0]?.name).toBe('Whole milk')
    expect(pulled).toBe(1)
    expect(behind).toBe(true)
    expect(localEdits.value).toBe(before)
  })
})
