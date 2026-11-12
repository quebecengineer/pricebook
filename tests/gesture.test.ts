import { describe, expect, it } from 'vitest'
import { rubberBand, settle, Tracker } from '../src/ui/gesture'

describe('rubberBand', () => {
  it('starts near 1:1, slows down, and never reaches the limit', () => {
    const values = [1, 50, 200, 1000, 100_000].map((x) => rubberBand(x, 100))
    expect(values[0]).toBeCloseTo(0.55, 1)
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeGreaterThan(values[i - 1]!)
    expect(values.at(-1)!).toBeLessThan(100)
  })
  it('is symmetric and zero at rest', () => {
    expect(rubberBand(0, 100)).toBe(0)
    expect(rubberBand(-80, 100)).toBeCloseTo(-rubberBand(80, 100))
  })
})

describe('Tracker', () => {
  it('measures px/ms over the recent window only', () => {
    const t = new Tracker()
    t.add(0, 0)
    t.add(500, 100)
    t.add(520, 140)
    t.add(560, 180)
    expect(t.velocity(180)).toBeCloseTo(60 / 80, 5)
  })
  it('reads a pause before release as no velocity', () => {
    const t = new Tracker()
    t.add(0, 0)
    t.add(100, 16)
    expect(t.velocity(400)).toBe(0)
  })
})

describe('settle', () => {
  const snaps = [0, -150]
  it('goes to the nearest snap on a slow release', () => {
    expect(settle(-60, 0, snaps)).toBe(0)
    expect(settle(-100, 0, snaps)).toBe(-150)
  })
  it('follows momentum on a flick', () => {
    expect(settle(-40, -1, snaps)).toBe(-150)
    expect(settle(-120, 1, snaps)).toBe(0)
  })
})
