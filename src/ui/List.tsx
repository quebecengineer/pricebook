import { signal } from '@preact/signals'
import { nameOf, normalizeName, rows, type Row } from '../model'
import { go, link } from '../router'
import { settings } from '../settings'
import { data } from '../state'
import { ago, formatUnitPrice } from '../units'
import { Bar, SyncChip } from './Bar'

const query = signal('')

export function List() {
  const list = rows(data.value, query.value)
  const q = normalizeName(query.value)
  return (
    <>
      <Bar title="Pricebook">
        <SyncChip />
        <button class="icon" aria-label="Settings" onClick={() => go('#/settings')}>
          ⚙
        </button>
      </Bar>
      <main>
        <input
          class="search"
          type="search"
          placeholder="Search items"
          aria-label="Search items"
          value={query.value}
          onInput={(e) => (query.value = e.currentTarget.value)}
        />
        {list.length ? (
          <ul class="list">{list.map((r) => <ItemRow key={r.item.id} row={r} />)}</ul>
        ) : (
          <Empty q={q} />
        )}
      </main>
      <button class="fab" aria-label="Log a price" onClick={() => go(`#/add/${encodeURIComponent(q)}`)}>
        +
      </button>
    </>
  )
}

function ItemRow({ row: { item, best } }: { row: Row }) {
  return (
    <li>
      <a class="item" {...link(`#/item/${item.id}`)}>
        <span class="name">{item.name}</span>
        {best ? (
          <>
            <b class="price">{formatUnitPrice(best, item.unit, settings.value.currency)}</b>
            <small>
              {nameOf(data.value.stores, best.storeId)} · {ago(best.at)}
            </small>
          </>
        ) : (
          <small>No price yet</small>
        )}
      </a>
      <button class="side" aria-label={`Log price for ${item.name}`} onClick={() => go(`#/add/${item.id}`)}>
        +
      </button>
    </li>
  )
}

function Empty({ q }: { q: string }) {
  if (!q) return <p class="empty">No prices yet. Tap + to log your first one.</p>
  return (
    <div class="empty">
      <p>No “{q}” yet.</p>
      <button class="primary" onClick={() => go(`#/add/${encodeURIComponent(q)}`)}>
        Add “{q}”
      </button>
    </div>
  )
}
