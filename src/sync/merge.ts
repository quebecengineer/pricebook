import { KINDS, UNITS, type Base, type Data, type Kind } from '../model'

const APP = 'pricebook'
const VERSION = 1

export const toSnapshot = (data: Data) => ({ app: APP, version: VERSION, ...data })

type Fields = Record<string, unknown>
const isObj = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v)
const isText = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isBase = (r: Fields) => isText(r.id) && isNum(r.updatedAt) && (r.deleted === undefined || r.deleted === true)

const VALID: Record<Kind, (r: Fields) => boolean> = {
  items: (r) => isText(r.name) && (UNITS as readonly unknown[]).includes(r.unit),
  stores: (r) => isText(r.name),
  prices: (r) =>
    isText(r.itemId) && isText(r.storeId) && Number.isInteger(r.cents) && isNum(r.cents) && r.cents > 0 &&
    isNum(r.qty) && r.qty > 0 && isNum(r.at),
}

/** Validates untrusted JSON (Drive file or import); throws instead of merging bad data. */
export function parseSnapshot(json: unknown): Data {
  if (!isObj(json) || json.app !== APP) throw new Error('Not a Pricebook file')
  if (json.version !== VERSION) throw new Error(`Unsupported file version: ${String(json.version)}`)
  for (const kind of KINDS) {
    const list = json[kind]
    if (!Array.isArray(list)) throw new Error(`Missing ${kind}`)
    const bad = list.findIndex((r) => !isObj(r) || !isBase(r) || !VALID[kind](r))
    if (bad >= 0) throw new Error(`Invalid ${kind} record #${bad + 1}`)
  }
  return { items: json.items, stores: json.stores, prices: json.prices } as Data
}

/** Last write wins; equal timestamps fall back to content so every device picks the same winner. */
const wins = (a: Base, b: Base) =>
  a.updatedAt > b.updatedAt || (a.updatedAt === b.updatedAt && JSON.stringify(a) > JSON.stringify(b))

function newerList<T extends Base>(a: T[], b: T[]) {
  const theirs = new Map(b.map((r) => [r.id, r]))
  return a.filter((r) => {
    const other = theirs.get(r.id)
    return !other || wins(r, other)
  })
}

/** Records in `a` that `b` is missing or holds an older version of. */
export const newer = (a: Data, b: Data): Data => ({
  items: newerList(a.items, b.items),
  stores: newerList(a.stores, b.stores),
  prices: newerList(a.prices, b.prices),
})

export const count = (d: Partial<Data>) => KINDS.reduce((n, k) => n + (d[k]?.length ?? 0), 0)
