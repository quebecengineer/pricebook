import type { Price, Unit } from './model'

/** Units a size can be typed in, mapped to their base unit and factor. */
export const SIZE_UNITS = {
  g: ['kg', 0.001],
  kg: ['kg', 1],
  ml: ['L', 0.001],
  L: ['L', 1],
  pc: ['pc', 1],
} as const satisfies Record<string, readonly [Unit, number]>
export type SizeUnit = keyof typeof SIZE_UNITS
export const ALL_SIZE_UNITS = Object.keys(SIZE_UNITS) as SizeUnit[]

export const baseOf = (u: SizeUnit): Unit => SIZE_UNITS[u][0]
export const toBase = (amount: number, u: SizeUnit) => amount * SIZE_UNITS[u][1]
export const unitsFor = (base: Unit) => ALL_SIZE_UNITS.filter((u) => baseOf(u) === base)

/** Parses "12.5" or "12,5"; returns NaN unless a positive finite number. */
export function parseAmount(text: string) {
  const n = Number(text.trim().replace(',', '.'))
  return text.trim() && Number.isFinite(n) && n > 0 ? n : NaN
}
export const parseCents = (text: string) => Math.round(parseAmount(text) * 100)

const formatters = new Map<string, Intl.NumberFormat>()
export function formatMoney(cents: number, currency: string) {
  let f = formatters.get(currency)
  if (!f) formatters.set(currency, (f = new Intl.NumberFormat(undefined, { style: 'currency', currency })))
  return f.format(cents / 100)
}

export const formatUnitPrice = (p: Price, unit: Unit, currency: string) =>
  `${formatMoney(p.cents / p.qty, currency)}/${unit}`

const round = (n: number) => Math.round(n * 1000) / 1000
const SMALL: Record<Unit, string> = { kg: 'g', L: 'ml', pc: 'pc' }

export function formatSize(qty: number, unit: Unit) {
  if (unit !== 'pc' && qty < 1) return `${round(qty * 1000)} ${SMALL[unit]}`
  return `${round(qty)} ${unit}`
}

/** Splits a stored base quantity back into the friendliest typed unit. */
export function fromBase(qty: number, unit: Unit): [string, SizeUnit] {
  if (unit !== 'pc' && qty < 1) return [String(round(qty * 1000)), SMALL[unit] as SizeUnit]
  return [String(round(qty)), unit]
}

const DAY = 86_400_000
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [['year', 365], ['month', 30], ['week', 7], ['day', 1]]
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' })

export function ago(at: number, now = Date.now()) {
  const days = Math.max(0, Math.floor((now - at) / DAY))
  const [unit, size] = STEPS.find(([, n]) => days >= n) ?? ['day', 1]
  return relative.format(-Math.floor(days / size), unit)
}
