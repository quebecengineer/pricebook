import { describe, expect, it } from 'vitest'
import {
  bestByItem, bestPrice, compare, currentByItem, findByName, isStale, latestByStore, normalizeName, recentStores, rows,
  sections, upsert,
  type Price,
} from '../src/model'

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
  it('treats equal unit prices as a tie despite float noise', () => {
    expect(bestPrice([price('kg', 10000, 1, 1), price('700g', 7000, 0.7, 2)])?.id).toBe('kg')
    expect(bestPrice([price('kg', 10000, 1, 1), price('stored', 7000, 0.7000000000000001, 2)])?.id).toBe('kg')
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
    expect(row?.price?.id).toBe('p')
  })
  it('finds items by category even when the name lacks the word', () => {
    const items = [{ id: 'd', name: 'Amul Masti Dahi', unit: 'kg' as const, updatedAt: 1 }]
    expect(rows({ items, stores: [], prices: [] }, 'yogurt').map((r) => r.item.id)).toEqual(['d'])
  })
})

describe('currentByItem', () => {
  it('uses the latest price at each store, so an old deal stops counting', () => {
    const now = currentByItem([price('old-deal', 100, 1, 1), price('now', 300, 1, 5), price('other', 200, 1, 2, { storeId: 's2' })])
    expect(now.get('milk')?.id).toBe('other')
  })
})

describe('rows by cost', () => {
  const item = (id: string, unit: 'kg' | 'L' | 'pc', name = id) => ({ id, name, unit, updatedAt: 1 })
  const data = {
    items: [item('pc1', 'pc'), item('kg-dear', 'kg'), item('kg-none', 'kg'), item('kg-cheap', 'kg'), item('kg-fresh', 'kg')],
    stores: [],
    prices: [
      price('a', 50, 1, 1, { itemId: 'pc1' }),
      price('b', 900, 1, 1, { itemId: 'kg-dear' }),
      price('c', 300, 1, 1, { itemId: 'kg-cheap' }),
      price('d', 150, 0.5, 9, { itemId: 'kg-fresh' }),
    ],
  }
  it('groups by unit, then cheapest, then fresher, with unpriced last', () => {
    expect(rows(data, 'k', true).map((r) => r.item.id)).toEqual(['kg-fresh', 'kg-cheap', 'kg-dear', 'kg-none'])
    expect(rows(data, '', true).map((r) => r.item.id)).toEqual(['kg-fresh', 'kg-cheap', 'kg-dear', 'kg-none', 'pc1'])
  })
})

describe('compare', () => {
  it('ranks stores and measures each against the cheapest', () => {
    const list = compare([price('a', 300, 1, 1), price('b', 200, 1, 2, { storeId: 's2' }), price('c', 100, 1, 3, { storeId: 's3' })])
    expect(list.map((c) => [c.price.id, c.deltaPct, Math.round(c.ratio * 100)])).toEqual([
      ['c', 0, 33],
      ['b', 100, 67],
      ['a', 200, 100],
    ])
  })
  it('is empty without prices', () => expect(compare([])).toEqual([]))
})

describe('recentStores', () => {
  it('orders used stores by last visit and skips unused ones', () => {
    const data = {
      items: [],
      stores: ['s1', 's2', 's3'].map((id) => ({ id, name: id, updatedAt: 1 })),
      prices: [price('a', 1, 1, 5), price('b', 1, 1, 9, { storeId: 's2' }), price('c', 1, 1, 1, { storeId: 's1' })],
    }
    expect(recentStores(data, 5).map((s) => s.id)).toEqual(['s2', 's1'])
    expect(recentStores(data, 1)).toHaveLength(1)
  })
})

describe('isStale', () => {
  const day = 86_400_000
  it('flags prices older than 90 days', () => {
    expect(isStale(0, 91 * day)).toBe(true)
    expect(isStale(0, 89 * day)).toBe(false)
  })
})

describe('sections', () => {
  const row = (name: string) => ({ item: { id: name, name, unit: 'pc' as const, updatedAt: 1 } })
  it('groups by first letter, folding accents and sending non-letters to #', () => {
    const groups = sections([row('7up'), row('apple'), row('Avocado'), row('Éclair'), row('eggs')])
    expect(groups.map(([letter, rs]) => [letter, rs.length])).toEqual([['#', 1], ['A', 2], ['E', 2]])
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
