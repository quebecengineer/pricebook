import { describe, expect, it } from 'vitest'
import { upsert, type Data, type Store } from '../src/model'
import { count, newer, parseSnapshot, toSnapshot } from '../src/sync/merge'

const store = (id: string, updatedAt: number, extra: Partial<Store> = {}): Store => ({ id, name: id, updatedAt, ...extra })
const data = (stores: Store[] = []): Data => ({ items: [], stores, prices: [] })
const valid = {
  items: [{ id: 'i', name: 'Milk', unit: 'L', updatedAt: 1 }],
  stores: [{ id: 's', name: 'Lidl', updatedAt: 1, deleted: true }],
  prices: [{ id: 'p', itemId: 'i', storeId: 's', cents: 99, qty: 0.5, at: 1, updatedAt: 1 }],
}

describe('parseSnapshot', () => {
  it('accepts a valid snapshot and round-trips toSnapshot', () => {
    const parsed = parseSnapshot(JSON.parse(JSON.stringify(toSnapshot(valid as Data))))
    expect(parsed).toEqual(valid)
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['another app', { ...toSnapshot(data()), app: 'other' }],
    ['a future version', { ...toSnapshot(data()), version: 2 }],
    ['a missing list', { app: 'pricebook', version: 1, items: [], stores: [] }],
  ])('rejects %s', (_, json) => expect(() => parseSnapshot(json)).toThrow())

  const withPrice = (patch: object) => ({ ...toSnapshot(valid as Data), prices: [{ ...valid.prices[0], ...patch }] })
  it.each([
    ['negative cents', { cents: -1 }],
    ['fractional cents', { cents: 1.5 }],
    ['zero qty', { qty: 0 }],
    ['infinite qty', { qty: Infinity }],
    ['missing item ref', { itemId: '' }],
    ['deleted: false', { deleted: false }],
    ['string timestamp', { updatedAt: '1' }],
  ])('rejects a price with %s', (_, patch) => expect(() => parseSnapshot(withPrice(patch))).toThrow(/prices record #1/))

  it('rejects an unknown unit and over-long names', () => {
    const bad = (item: object) => ({ ...toSnapshot(valid as Data), items: [{ ...valid.items[0], ...item }] })
    expect(() => parseSnapshot(bad({ unit: 'oz' }))).toThrow(/items/)
    expect(() => parseSnapshot(bad({ name: 'x'.repeat(201) }))).toThrow(/items/)
  })

  it('accepts a slug category and rejects anything else', () => {
    const withCategory = (category: unknown) => ({ ...toSnapshot(valid as Data), items: [{ ...valid.items[0], category }] })
    expect(parseSnapshot(withCategory('greek-yogurt')).items[0]?.category).toBe('greek-yogurt')
    for (const bad of [1, '', 'Greek Yogurt', '<b>x</b>', 'x'.repeat(41)]) {
      expect(() => parseSnapshot(withCategory(bad))).toThrow(/items/)
    }
  })
})

describe('newer', () => {
  it('returns records the other side is missing or holds older', () => {
    const a = data([store('new', 1), store('fresh', 5), store('same', 3)])
    const b = data([store('fresh', 4), store('same', 3)])
    expect(newer(a, b).stores.map((s) => s.id)).toEqual(['new', 'fresh'])
    expect(count(newer(b, a))).toBe(0)
  })

  it('breaks timestamp ties the same way on both sides', () => {
    const a = data([store('s', 7, { name: 'A' })])
    const b = data([store('s', 7, { name: 'B' })])
    expect(count(newer(a, b)) + count(newer(b, a))).toBe(1)
  })

  it('converges two devices with a concurrent rename and delete', () => {
    const base = [store('x', 1), store('y', 1)]
    const phone = data([{ ...base[0]!, name: 'Renamed', updatedAt: 2 }, base[1]!])
    const laptop = data([base[0]!, { ...base[1]!, deleted: true, updatedAt: 3 }])
    const phoneAfter = upsert(phone, newer(laptop, phone))
    const laptopAfter = upsert(laptop, newer(phone, laptop))
    expect(phoneAfter).toEqual(laptopAfter)
    expect(phoneAfter.stores.find((s) => s.id === 'y')?.deleted).toBe(true)
    expect(phoneAfter.stores.find((s) => s.id === 'x')?.name).toBe('Renamed')
  })
})
