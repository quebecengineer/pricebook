import type { Ref } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { bestPrice, byId, findByName, live, nameOf, normalizeName, unitPrice, type Price, type Unit } from '../model'
import { back } from '../router'
import { settings, updateSettings } from '../settings'
import { data, editPrice, logPrice } from '../state'
import {
  ALL_SIZE_UNITS, baseOf, formatMoney, formatUnitPrice, fromBase, parseAmount, parseCents, toBase, unitsFor,
  type SizeUnit,
} from '../units'
import { Bar } from './Bar'
import { fail, toast } from './Toast'

interface FieldProps {
  label: string
  value: string
  onValue: (value: string) => void
  class?: string
  list?: string
  decimal?: boolean
  placeholder?: string
  required?: boolean
  autoFocus?: boolean
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
}

function Field({ label, onValue, inputRef, decimal, list, class: cls, ...input }: FieldProps) {
  return (
    <label class={cls}>
      {label}
      <input
        {...input} list={list} ref={inputRef} maxLength={100} autoComplete="off"
        inputMode={decimal ? 'decimal' : undefined} pattern={decimal ? '[0-9]*[.,]?[0-9]*' : undefined}
        onInput={(e) => onValue(e.currentTarget.value)}
      />
    </label>
  )
}

/** `arg` is an item id or a new item name; with `edit`, it is the id of the price to edit. */
export function AddSheet({ arg, edit }: { arg: string; edit?: boolean }) {
  const { items, stores, prices } = data.value
  const editing = edit ? live(prices).find((p) => p.id === arg) : undefined
  const [init] = useState(() => initial(arg, editing))
  const [item, setItem] = useState(init.item)
  const [store, setStore] = useState(init.store)
  const [price, setPrice] = useState(init.price)
  const [size, setSize] = useState(init.size)
  const [unit, setUnit] = useState<SizeUnit>(init.unit)
  const itemInput = useRef<HTMLInputElement>(null)

  const known = findByName(items, item)
  const options = known ? unitsFor(known.unit) : ALL_SIZE_UNITS
  const u = options.includes(unit) ? unit : (known?.unit ?? 'pc')
  const cents = parseCents(price)
  const qty = size.trim() ? toBase(parseAmount(size), u) : 1
  const preview = cents && qty ? `= ${formatMoney(cents / qty, settings.value.currency)}/${baseOf(u)}` : ''

  async function submit(e: Event) {
    e.preventDefault()
    if (!cents || !qty) return toast('Enter a valid price and size', { tone: 'bad' })
    const entry = { item, store, cents, qty, unit: baseOf(u) }
    try {
      if (editing) {
        await editPrice(editing, entry)
        toast('Saved')
        return back()
      }
      const { price: p, prevBest } = await logPrice(entry)
      updateSettings({ lastStore: normalizeName(store) })
      toast(...verdict(p, prevBest, baseOf(u)))
      setItem('')
      setPrice('')
      setSize('')
      itemInput.current?.focus()
    } catch (err) {
      fail(err)
    }
  }

  return (
    <>
      <Bar title={editing ? 'Edit price' : 'Log price'} hasBack />
      <main>
        <form class="sheet" onSubmit={submit}>
          <Field
            label="Item" value={item} onValue={setItem} inputRef={itemInput} list="item-names" required
            autoFocus={!init.item} disabled={!!editing}
          />
          <datalist id="item-names">{live(items).map((i) => <option key={i.id} value={i.name} />)}</datalist>
          <Field label="Store" value={store} onValue={setStore} list="store-names" required />
          <datalist id="store-names">{live(stores).map((s) => <option key={s.id} value={s.name} />)}</datalist>
          <div class="fields">
            <Field
              label="Price" class="grow" value={price} onValue={setPrice} decimal required
              autoFocus={!!init.item && !editing}
            />
            <Field label="Size" value={size} onValue={setSize} decimal placeholder={`1 ${baseOf(u)}`} />
            <label>
              Unit
              <select aria-label="Unit" value={u} onChange={(e) => setUnit(e.currentTarget.value as SizeUnit)}>
                {options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          </div>
          <p class="hint" aria-live="polite">{preview}</p>
          <button class="primary" type="submit">
            {editing ? 'Save changes' : 'Save price'}
          </button>
        </form>
      </main>
    </>
  )
}

function initial(arg: string, editing?: Price) {
  const { items, stores } = data.value
  if (editing) {
    const item = byId(items).get(editing.itemId)
    const [size, unit] = fromBase(editing.qty, item?.unit ?? 'pc')
    return { item: item?.name ?? '', store: nameOf(stores, editing.storeId), price: String(editing.cents / 100), size, unit }
  }
  const item = live(items).find((i) => i.id === arg)
  return { item: item?.name ?? arg, store: settings.value.lastStore, price: '', size: '', unit: item?.unit ?? 'pc' }
}

/** Feedback after logging: did this price beat the all-time best? */
function verdict(p: Price, prev: Price | undefined, unit: Unit): Parameters<typeof toast> {
  const { currency } = settings.value
  const store = (x: Price) => nameOf(data.value.stores, x.storeId)
  if (!prev) return [`Saved · first price ${formatUnitPrice(p, unit, currency)}`]
  if (bestPrice([prev, p]) === prev) return [`Best is still ${formatUnitPrice(prev, unit, currency)} at ${store(prev)}`]
  const pct = Math.max(1, Math.round((1 - unitPrice(p) / unitPrice(prev)) * 100))
  return [`↓ New best! ${pct}% cheaper than ${store(prev)}`, { tone: 'good' }]
}
