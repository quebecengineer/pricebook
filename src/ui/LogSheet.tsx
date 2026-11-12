import { useRef, useState } from 'preact/hooks'
import {
  bestPrice, byId, findByName, live, nameOf, normalizeName, perUnit, pricesOf, recentStores, rows, unitPrice,
  type Price, type Unit,
} from '../model'
import { back } from '../router'
import { settings, updateSettings } from '../settings'
import { data, editPrice, logPrice } from '../state'
import {
  ALL_SIZE_UNITS, baseOf, currencySymbol, formatMoney, formatUnitPrice, fromBase, parseAmount, parseCents, sizeIn,
  toBase, unitsFor, type SizeUnit,
} from '../units'
import { Cell, Chips, Field, Group, Row, Segmented, haptic, nextOnEnter } from './kit'
import { Sheet } from './Sheet'
import { fail, toast } from './Toast'
import { removeWithUndo } from './undo'

const ITEM_CHIPS = 5
const STORE_CHIPS = 6
const store = (p: Price) => nameOf(data.value.stores, p.storeId)

function initial(arg: string, editing?: Price) {
  const { items } = data.value
  if (editing) {
    const item = byId(items).get(editing.itemId)
    const [size, unit] = fromBase(editing.qty, item?.unit ?? 'pc')
    return { item: item?.name ?? '', store: store(editing), price: String(editing.cents / 100), size, unit }
  }
  const item = live(items).find((i) => i.id === arg)
  return { item: item?.name ?? arg, store: settings.value.lastStore, price: '', size: '', unit: item?.unit ?? 'pc' }
}

/** Live answer to "is this cheaper than my best?" while typing. */
function describe(unitCents: number, best: Price | undefined, unit: Unit, currency: string) {
  const per = `${formatMoney(unitCents, currency)}/${unit}`
  if (!best) return { text: `${per} · first price for this item`, good: false }
  const ref = `${store(best)} ${formatUnitPrice(best, unit, currency)}`
  const pct = Math.max(1, Math.round(Math.abs(unitCents / unitPrice(best) - 1) * 100))
  if (unitCents < unitPrice(best)) return { text: `${per} · ${pct}% below your best (${ref})`, good: true }
  if (unitCents === unitPrice(best)) return { text: `${per} · same as your best (${ref})`, good: false }
  return { text: `${per} · ${pct}% above your best (${ref})`, good: false }
}

/** A blank size means one base unit; a sub-unit like g needs an amount. */
function quantity(size: string, u: SizeUnit | undefined) {
  if (!u) return NaN
  if (size.trim()) return toBase(parseAmount(size), u)
  return u === baseOf(u) ? 1 : NaN
}

function savedMessage(name: string, p: Price, prev: Price | undefined, unit: Unit): Parameters<typeof toast> {
  if (prev && bestPrice([prev, p]) === p) return [`New best for ${name}`, { tone: 'good' }]
  if (!prev) return [`Saved ${name}`]
  return [`Saved · best is still ${formatUnitPrice(prev, unit, settings.value.currency)} at ${store(prev)}`]
}

/** `arg` is an item id or a new item name; with `edit`, it is the id of the price to edit. */
export function LogSheet({ arg, edit }: { arg: string; edit?: boolean }) {
  const { items, prices } = data.value
  const { currency } = settings.value
  const editing = edit ? live(prices).find((p) => p.id === arg) : undefined
  const [init] = useState(() => initial(arg, editing))
  const [item, setItem] = useState(init.item)
  const [storeName, setStore] = useState(init.store)
  const [price, setPrice] = useState(init.price)
  const [size, setSize] = useState(init.size)
  const [unit, setUnit] = useState<SizeUnit>(init.unit)
  const itemInput = useRef<HTMLInputElement>(null)

  const known = findByName(items, item)
  const options = known ? unitsFor(known.unit) : ALL_SIZE_UNITS
  const u = options.includes(unit) ? unit : size.trim() ? undefined : known?.unit
  const base = u ? baseOf(u) : (known?.unit ?? 'pc')
  const cents = parseCents(price)
  const qty = quantity(size, u)
  const valid = !!item.trim() && !!storeName.trim() && cents > 0 && qty > 0
  const best = known && bestPrice(pricesOf(prices, known.id).filter((p) => p.id !== editing?.id))
  const hint = valid
    ? describe(perUnit(cents, qty), best, base, currency)
    : { text: known && !u ? `${known.name} is priced per ${known.unit} · pick a unit` : '', good: false }
  const dirty = editing ? storeName !== init.store || price !== init.price || size !== init.size : !!price.trim()
  const itemChips = item.trim() && !known ? rows(data.value, item).slice(0, ITEM_CHIPS).map((r) => r.item.name) : []
  const named = size.trim() ? undefined : sizeIn(item)
  const sizeChip = named && options.includes(named[1]) ? named : undefined

  const close = () => (!dirty || confirm('Discard this price?')) && back()

  async function submit(e: Event) {
    e.preventDefault()
    if (!valid) return
    const entry = { item, store: storeName, cents, qty, unit: base }
    try {
      if (editing) {
        await editPrice(editing, entry)
        toast('Changes saved')
        return back()
      }
      const { price: p, prevBest } = await logPrice(entry)
      updateSettings({ lastStore: normalizeName(storeName) })
      const [text, opts] = savedMessage(normalizeName(item), p, prevBest, base)
      haptic(opts?.tone === 'good' ? 'success' : 'tap')
      toast(text, opts)
      setItem('')
      setPrice('')
      setSize('')
      itemInput.current?.focus()
    } catch (err) {
      fail(err)
    }
  }

  const save = (
    <button type="submit" form="log-form" class="sheet-btn strong" disabled={!valid}>
      Save
    </button>
  )
  return (
    <Sheet title={editing ? 'Edit Price' : 'Log Price'} onClose={close} trailing={save}>
      <form id="log-form" onSubmit={submit} onKeyDown={nextOnEnter} noValidate>
        <Group>
          <Cell>
            <Field
              label="Item" value={item} onValue={setItem} inputRef={itemInput} placeholder="e.g. Milk"
              autoFocus={!init.item} disabled={!!editing}
            />
          </Cell>
        </Group>
        <Chips label="Matching items" options={itemChips} onPick={setItem} />
        <Group>
          <Cell>
            <Field label="Store" value={storeName} onValue={setStore} placeholder="e.g. DMart" />
          </Cell>
        </Group>
        <Chips label="Recent stores" options={recentStores(data.value, STORE_CHIPS).map((s) => s.name)} selected={storeName} onPick={setStore} />
        <Group>
          <Cell>
            <Field
              label="Price" class="price-field" prefix={currencySymbol(currency)} decimal value={price} onValue={setPrice}
              placeholder="0.00" autoFocus={!!init.item && !editing}
            />
          </Cell>
          <Cell>
            <Field label="Size" decimal value={size} onValue={setSize} suffix={u} placeholder={u === base ? '1' : 'Required'} />
          </Cell>
          <Cell>
            <Segmented label="Unit" options={options} value={u} onChange={setUnit} />
          </Cell>
        </Group>
        <p class={`verdict ${hint.good ? 'good' : ''}`} aria-live="polite">{hint.text}</p>
        {sizeChip && (
          <Chips
            label="Size from name" options={[`Use ${sizeChip.join(' ')}`]}
            onPick={() => {
              setSize(String(sizeChip[0]))
              setUnit(sizeChip[1])
            }}
          />
        )}
      </form>
      {editing && (
        <Group>
          <Row title="Delete Entry" tone="danger" onClick={() => void removeWithUndo('prices', editing, 'Entry').then((ok) => ok && back())} />
        </Group>
      )}
    </Sheet>
  )
}
