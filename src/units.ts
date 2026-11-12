import { unitPrice, type Price, type Unit } from './model'

/** Units a size can be typed in, mapped to their base unit and how many make one base unit. */
export const SIZE_UNITS = {
  g: ['kg', 1000],
  kg: ['kg', 1],
  ml: ['L', 1000],
  L: ['L', 1],
  pc: ['pc', 1],
} as const satisfies Record<string, readonly [Unit, number]>
export type SizeUnit = keyof typeof SIZE_UNITS
export const ALL_SIZE_UNITS = Object.keys(SIZE_UNITS) as SizeUnit[]

export const baseOf = (u: SizeUnit): Unit => SIZE_UNITS[u][0]
/** Divides rather than multiplying by 0.001, which is inexact (700 g would be 0.7000000000000001 kg). */
export const toBase = (amount: number, u: SizeUnit) => amount / SIZE_UNITS[u][1]
export const unitsFor = (base: Unit) => ALL_SIZE_UNITS.filter((u) => baseOf(u) === base)

/** Parses "12.5" or "12,5"; returns NaN unless a positive finite number. */
export function parseAmount(text: string) {
  const n = Number(text.trim().replace(',', '.'))
  return text.trim() && Number.isFinite(n) && n > 0 ? n : NaN
}
export const parseCents = (text: string) => Math.round(parseAmount(text) * 100)

const SIZE_IN = /\b(?:(\d+)\s*[x×*]\s*)?(\d+(?:[.,]\d+)?)\s*(kgs?|g|gms?|grams?|ml|l|ltrs?|litres?|liters?|pcs?|pieces?)\b/i
const PACK_OF = /\bpack of (\d+)\b/i
const UNIT_BY_LETTER: Record<string, SizeUnit> = { k: 'kg', g: 'g', m: 'ml', l: 'L', p: 'pc' }

/** Net content printed in a product name: "400g", "1.5 L", "6 x 200 ml", "pack of 6". */
export function sizeIn(name: string): [number, SizeUnit] | undefined {
  const m = SIZE_IN.exec(name)
  if (m) {
    const amount = parseAmount(m[2]!) * Number(m[1] ?? 1)
    return amount > 0 ? [amount, UNIT_BY_LETTER[m[3]!.charAt(0).toLowerCase()]!] : undefined
  }
  const pack = PACK_OF.exec(name)
  return pack && Number(pack[1]) > 0 ? [Number(pack[1]), 'pc'] : undefined
}

const formatters = new Map<string, Intl.NumberFormat>()
function formatter(currency: string) {
  let f = formatters.get(currency)
  if (!f) formatters.set(currency, (f = new Intl.NumberFormat(undefined, { style: 'currency', currency })))
  return f
}
export const formatMoney = (cents: number, currency: string) => formatter(currency).format(cents / 100)
export const currencySymbol = (currency: string) =>
  formatter(currency).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
export const formatDateTime = (at: number) => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
export const formatBytes = (bytes: number) =>
  new Intl.NumberFormat(undefined, { style: 'unit', unit: bytes < 1e6 ? 'kilobyte' : 'megabyte', maximumFractionDigits: 1 }).format(
    bytes < 1e6 ? Math.max(0.1, bytes / 1e3) : bytes / 1e6,
  )
export const formatDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export const formatUnitPrice = (p: Price, unit: Unit, currency: string) =>
  `${formatMoney(unitPrice(p), currency)}/${unit}`

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
