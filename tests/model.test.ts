import { describe, expect, it } from 'vitest'
import { bestByItem, bestPrice, findByName, latestByStore, normalizeName, rows, upsert, type Price } from '../src/model'

const price = (id: string, cents: number, qty: number, at: number, extra: Partial<Price> = {}): Price => ({
  id, itemId: 'milk', storeId: 's1', cents, qty, at, updatedAt: at, ...extra,
})

describe('names', () => {
  it('normalizes whitespace', () => expect(normalizeName('  oat   milk ')).toBe('oat milk'))
  it('finds live records case-insensitively', () => {
    const list = [
      { id: 'a', name: 'Milk', updatedAt: 1, deleted: true as const },
      { id: 'b', name: 'Milk', updatedAt: 1 },
    ]
    expect(findByName(list, ' milk ')?.id).toBe('b')
  })
})

describe('bestPrice', () => {
  it('compares unit price, not pack price', () => {
    expect(bestPrice([price('a', 300, 0.5, 1), price('b', 550, 1, 2)])?.id).toBe('b')
  })
  it('keeps the earlier entry on a tie', () => {
    expect(bestPrice([price('late', 200, 1, 9), price('early', 100, 0.5, 1)])?.id).toBe('early')
  })
  it('ignores deleted entries', () => {
    expect(bestPrice([price('a', 1, 1, 1, { deleted: true }), price('b', 5, 1, 2)])?.id).toBe('b')
  })
  it('is undefined with no entries', () => expect(bestPrice([])).toBeUndefined())
})

describe('bestByItem', () => {
  it('tracks the minimum per item', () => {
    const best = bestByItem([price('a', 500, 1, 1), price('b', 400, 1, 2), price('c', 100, 1, 3, { itemId: 'egg' })])
    expect(best.get('milk')?.id).toBe('b')
    expect(best.get('egg')?.id).toBe('c')
  })
})

describe('latestByStore', () => {
  it('takes the newest per store and sorts cheapest first', () => {
    const list = latestByStore([
      price('old', 100, 1, 1),
      price('new', 300, 1, 5),
      price('other', 200, 1, 2, { storeId: 's2' }),
    ])
    expect(list.map((p) => p.id)).toEqual(['other', 'new'])
  })
})

describe('rows', () => {
  const data = {
    items: [
      { id: 'b', name: 'bread', unit: 'pc' as const, updatedAt: 1 },
      { id: 'a', name: 'Apples', unit: 'kg' as const, updatedAt: 1 },
      { id: 'x', name: 'Axe', unit: 'pc' as const, updatedAt: 1, deleted: true as const },
    ],
    stores: [],
    prices: [price('p', 100, 1, 1, { itemId: 'a' })],
  }
  it('sorts alphabetically ignoring case and hides deleted', () => {
    expect(rows(data, '').map((r) => r.item.id)).toEqual(['a', 'b'])
  })
  it('filters by query and attaches best', () => {
    const [row] = rows(data, ' APP')
    expect(row?.item.id).toBe('a')
    expect(row?.best?.id).toBe('p')
  })
})

describe('upsert', () => {
  it('replaces by id and appends new records', () => {
    const data = { items: [], stores: [{ id: 's', name: 'A', updatedAt: 1 }], prices: [] }
    const next = upsert(data, { stores: [{ id: 's', name: 'B', updatedAt: 2 }, { id: 't', name: 'C', updatedAt: 2 }] })
    expect(next.stores.map((s) => s.name)).toEqual(['B', 'C'])
    expect(next.items).toBe(data.items)
  })
})
