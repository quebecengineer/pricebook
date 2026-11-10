import { describe, expect, it } from 'vitest'
import { ago, formatSize, fromBase, parseAmount, parseCents, toBase, unitsFor } from '../src/units'

describe('units', () => {
  it('converts to base units', () => {
    expect(toBase(500, 'g')).toBe(0.5)
    expect(toBase(2, 'L')).toBe(2)
  })
  it('lists units of the same dimension', () => expect(unitsFor('kg')).toEqual(['g', 'kg']))
  it('formats small sizes in sub-units', () => {
    expect(formatSize(0.25, 'kg')).toBe('250 g')
    expect(formatSize(1.5, 'L')).toBe('1.5 L')
    expect(formatSize(6, 'pc')).toBe('6 pc')
  })
  it('round-trips a stored qty to a typed size', () => {
    expect(fromBase(0.5, 'kg')).toEqual(['500', 'g'])
    expect(fromBase(2, 'pc')).toEqual(['2', 'pc'])
  })
})

describe('parsing', () => {
  it('accepts dot and comma decimals', () => {
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount('12,5')).toBe(12.5)
  })
  it('rejects empty, zero, negative and junk', () => {
    for (const bad of ['', ' ', '0', '-1', 'abc', 'Infinity']) expect(parseAmount(bad)).toBeNaN()
  })
  it('rounds to whole cents', () => {
    expect(parseCents('0.29')).toBe(29)
    expect(parseCents('19.999')).toBe(2000)
  })
})

describe('ago', () => {
  const now = Date.UTC(2026, 0, 31)
  const day = 86_400_000
  it('picks the largest fitting unit', () => {
    expect(ago(now, now)).toMatch(/today/i)
    expect(ago(now - 3 * day, now)).toMatch(/3/)
    expect(ago(now - 400 * day, now)).toMatch(/year|yr/i)
  })
})
