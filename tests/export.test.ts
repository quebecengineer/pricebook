import { describe, expect, it } from 'vitest'
import { toCsv } from '../src/export'
import type { Data } from '../src/model'

const data: Data = {
  items: [
    { id: 'i1', name: 'Amul Masti Dahi', unit: 'kg', updatedAt: 1 },
    { id: 'i2', name: '=HYPERLINK("http://evil")', unit: 'pc', updatedAt: 1 },
  ],
  stores: [{ id: 's1', name: 'Shop, "Main"', updatedAt: 1 }],
  prices: [
    { id: 'p1', itemId: 'i1', storeId: 's1', cents: 3000, qty: 0.4, at: Date.UTC(2026, 10, 1), updatedAt: 1 },
    { id: 'p2', itemId: 'i2', storeId: 's1', cents: 500, qty: 2, at: Date.UTC(2026, 10, 2), updatedAt: 1 },
    { id: 'gone', itemId: 'i1', storeId: 's1', cents: 1, qty: 1, at: 0, updatedAt: 1, deleted: true },
  ],
}
const lines = () => toCsv(data).slice(1).trimEnd().split('\r\n')

describe('toCsv', () => {
  it('starts with a UTF-8 BOM and the header', () => {
    expect(toCsv(data).charCodeAt(0)).toBe(0xfeff)
    expect(lines()[0]).toBe('Date,Item,Category,Store,Price,Size,Unit,Unit price')
  })
  it('writes live prices newest first with unit price per base unit', () => {
    expect(lines()).toHaveLength(3)
    expect(lines()[2]).toBe('2026-11-01,Amul Masti Dahi,Yogurt,"Shop, ""Main""",30,400 g,kg,75')
  })
  it('neutralizes spreadsheet formulas', () => {
    expect(lines()[1]).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })
})
