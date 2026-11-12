import { category, categoryOf } from './categories'
import { byId, live, nameOf, unitPrice, type Data } from './model'
import { toSnapshot } from './sync/merge'
import { formatSize } from './units'

const HEADER = ['Date', 'Item', 'Category', 'Store', 'Price', 'Size', 'Unit', 'Unit price']
/** OWASP CSV injection: spreadsheet apps run cells that start with these as formulas. */
const FORMULA = /^[=+\-@\t\r]/

const cell = (v: string | number) => {
  const text = typeof v === 'number' ? String(v) : FORMULA.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** RFC 4180 CSV of every price, newest first, with a BOM so Excel reads it as UTF-8. */
export function toCsv({ items, stores, prices }: Data) {
  const itemOf = byId(items)
  const rows = live(prices)
    .sort((a, b) => b.at - a.at)
    .map((p) => {
      const item = itemOf.get(p.itemId)
      const unit = item?.unit ?? 'pc'
      return [
        new Date(p.at).toISOString().slice(0, 10),
        item?.name ?? 'Unknown item',
        (item && category(categoryOf(item))?.name) ?? '',
        nameOf(stores, p.storeId),
        p.cents / 100,
        formatSize(p.qty, unit),
        unit,
        Math.round(unitPrice(p)) / 100,
      ]
    })
  return `\uFEFF${[HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`
}

const stamp = () => new Date().toISOString().slice(0, 10)
export const backupFile = (data: Data) =>
  new File([JSON.stringify(toSnapshot(data))], `pricebook-${stamp()}.json`, { type: 'application/json' })
export const csvFile = (data: Data) => new File([toCsv(data)], `pricebook-${stamp()}.csv`, { type: 'text/csv' })

/** Opens the share sheet (WhatsApp, email, Files) where files can be shared, otherwise downloads. */
export async function share(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      return await navigator.share({ files: [file], title: file.name })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      throw e
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
