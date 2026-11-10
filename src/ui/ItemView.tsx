import { useState } from 'preact/hooks'
import { bestPrice, compare, isStale, nameOf, pricesOf, type Comparison, type Item, type Price } from '../model'
import { back, go } from '../router'
import { settings } from '../settings'
import { data, rename } from '../state'
import { ago, formatDate, formatMoney, formatSize, formatUnitPrice } from '../units'
import { NavBar, Toolbar } from './Bar'
import { Icon } from './Icon'
import { Cell, Empty, Group, NameRow, Row } from './kit'
import { toast } from './Toast'
import { removeWithUndo } from './undo'

const store = (p: Price) => nameOf(data.value.stores, p.storeId)

function CompareRow({ c: { price, ratio, deltaPct }, item }: { c: Comparison; item: Item }) {
  return (
    <Cell>
      <div class={`compare ${deltaPct === 0 ? 'best' : ''}`}>
        <span class="row-title">{store(price)}</span>
        <span class="row-value accent">{formatUnitPrice(price, item.unit, settings.value.currency)}</span>
        <span class="bar" aria-hidden="true">
          <span style={{ width: `${Math.max(4, ratio * 100)}%` }} />
        </span>
        <span class="row-sub">{ago(price.at)}</span>
        {deltaPct === 0 ? <span class="badge">Best</span> : <span class="row-sub">+{deltaPct}%</span>}
      </div>
    </Cell>
  )
}

export function ItemView({ id }: { id: string }) {
  const [editing, setEditing] = useState(false)
  const item = data.value.items.find((i) => i.id === id && !i.deleted)
  if (!item) {
    return (
      <>
        <NavBar title="Not Found" back="Pricebook" />
        <main>
          <Empty icon="alert" title="Item Not Found" text="It may have been deleted on this or another device." />
        </main>
      </>
    )
  }
  const own = pricesOf(data.value.prices, id)
  const best = bestPrice(own)
  const { currency } = settings.value
  const perUnit = (p: Price) => formatUnitPrice(p, item.unit, currency)

  const saveName = async (name: string) => {
    const merged = await rename('items', item, name)
    toast(merged ? `Merged into ${merged.name}` : 'Renamed')
    if (merged) back()
  }
  const deleteItem = async () => (await removeWithUndo('items', item, item.name)) && back()

  return (
    <>
      <NavBar
        title={item.name}
        large
        back="Pricebook"
        actions={
          <button class="nav-btn strong" onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        }
      />
      <main>
        {best && (
          <section class="hero" aria-label="All-time best price">
            <span class="caption">All-Time Best</span>
            <span class="hero-price">{perUnit(best)}</span>
            <span class="row-sub">
              {store(best)} · {formatDate(best.at)}
              {isStale(best.at) && <> · <Icon name="clock" size={13} /> may be outdated</>}
            </span>
          </section>
        )}
        {editing && (
          <Group header="Name" footer="Renaming to an existing item merges their prices.">
            <NameRow label="Name" value={item.name} onSave={saveName} />
          </Group>
        )}
        {own.length > 0 && (
          <Group header="Compare Stores" footer="Latest price at each store, per unit.">
            {compare(own).map((c) => <CompareRow key={c.price.id} c={c} item={item} />)}
          </Group>
        )}
        <Group header="History" footer={editing ? undefined : 'Tap an entry to correct it.'}>
          {[...own].sort((a, b) => b.at - a.at).map((p) => (
            <Row
              key={p.id}
              title={store(p)}
              subtitle={`${formatSize(p.qty, item.unit)} · ${perUnit(p)} · ${formatDate(p.at)}`}
              value={formatMoney(p.cents, currency)}
              href={`#/edit/${p.id}`}
              label={`${store(p)}, ${formatMoney(p.cents, currency)}, ${formatDate(p.at)}. Edit entry`}
              before={
                editing && (
                  <button class="delete-btn" aria-label={`Delete ${store(p)} entry from ${formatDate(p.at)}`} onClick={() => void removeWithUndo('prices', p, 'Entry')}>
                    <Icon name="minus-circle" size={24} />
                  </button>
                )
              }
            />
          ))}
        </Group>
        {editing && (
          <Group footer="You can undo this right after.">
            <Row title="Delete Item" tone="danger" onClick={() => void deleteItem()} />
          </Group>
        )}
      </main>
      <Toolbar>
        <button class="toolbar-action" onClick={() => go(`#/add/${id}`)}>
          <Icon name="plus-circle" size={24} /> Log Price
        </button>
      </Toolbar>
    </>
  )
}
