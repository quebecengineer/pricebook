import { bestPrice, latestByStore, nameOf, pricesOf, type Data, type Kind, type Price } from '../model'
import { back, go, link } from '../router'
import { settings } from '../settings'
import { data, remove, rename } from '../state'
import { ago, formatMoney, formatSize, formatUnitPrice } from '../units'
import { Bar } from './Bar'
import { NameField } from './NameField'
import { fail, toast } from './Toast'

async function removeWithUndo<K extends Kind>(kind: K, r: Data[K][number]) {
  try {
    const undo = await remove(kind, r)
    toast('Deleted', { action: { label: 'Undo', run: () => void undo().catch(fail) } })
    return true
  } catch (e) {
    fail(e)
    return false
  }
}

export function ItemView({ id }: { id: string }) {
  const { items, stores, prices } = data.value
  const item = items.find((i) => i.id === id && !i.deleted)
  if (!item) {
    return (
      <>
        <Bar title="Not found" hasBack />
        <main>
          <p class="empty">This item no longer exists.</p>
        </main>
      </>
    )
  }
  const own = pricesOf(prices, id)
  const best = bestPrice(own)
  const { currency } = settings.value
  const perUnit = (p: Price) => formatUnitPrice(p, item.unit, currency)
  const store = (p: Price) => nameOf(stores, p.storeId)

  const saveName = async (name: string) => {
    const merged = await rename('items', item, name)
    if (merged) {
      toast(`Merged into ${merged.name}`)
      back()
    }
  }

  return (
    <>
      <Bar title={item.name} hasBack>
        <button class="icon" aria-label={`Log price for ${item.name}`} onClick={() => go(`#/add/${id}`)}>
          +
        </button>
      </Bar>
      <main>
        {best && (
          <section class="best">
            <small>All-time best</small>
            <b>{perUnit(best)}</b>
            <span>
              {store(best)} · {ago(best.at)}
            </span>
          </section>
        )}
        <h2>Latest at each store</h2>
        <ul class="list">
          {latestByStore(own).map((p) => (
            <li key={p.id}>
              <div class="item">
                <span class="name">{store(p)}</span>
                <b class="price">{perUnit(p)}</b>
                <small>{ago(p.at)}</small>
              </div>
            </li>
          ))}
        </ul>
        <h2>History</h2>
        <ul class="list">
          {[...own].sort((a, b) => b.at - a.at).map((p) => (
            <li key={p.id}>
              <a class="item" {...link(`#/edit/${p.id}`)} aria-label={`Edit ${store(p)} entry`}>
                <span class="name">{store(p)}</span>
                <b class="price">{formatMoney(p.cents, currency)}</b>
                <small>
                  {formatSize(p.qty, item.unit)} · {perUnit(p)} · {new Date(p.at).toLocaleDateString()}
                </small>
              </a>
              <button class="side" aria-label={`Delete ${store(p)} entry`} onClick={() => removeWithUndo('prices', p)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <details>
          <summary>Rename or delete item</summary>
          <p class="hint">Renaming to an existing item merges their prices.</p>
          <NameField label="Item name" value={item.name} onSave={saveName} />
          <button class="danger" onClick={() => removeWithUndo('items', item).then((ok) => ok && back())}>
            Delete item
          </button>
        </details>
      </main>
    </>
  )
}
