import { signal } from '@preact/signals'
import { isStale, live, nameOf, normalizeName, rows, sections, type Row as ItemRowData } from '../model'
import { go } from '../router'
import { settings } from '../settings'
import { data } from '../state'
import { ago, formatUnitPrice } from '../units'
import { IconButton, NavBar, SyncButton, Toolbar } from './Bar'
import { Icon } from './Icon'
import { Empty, Group, Row } from './kit'

const query = signal('')
const logFor = (arg: string) => go(`#/add/${encodeURIComponent(arg)}`)

function Highlight({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}

function ItemRow({ row: { item, best }, q }: { row: ItemRowData; q: string }) {
  const stale = !!best && isStale(best.at)
  const subtitle = best ? (
    <>
      {nameOf(data.value.stores, best.storeId)} · {stale && <Icon name="clock" size={13} />}
      {ago(best.at)}
      {stale && <span class="sr-only">, may be outdated</span>}
    </>
  ) : (
    'No price yet'
  )
  return (
    <Row
      title={<Highlight text={item.name} q={q} />}
      subtitle={subtitle}
      value={best && formatUnitPrice(best, item.unit, settings.value.currency)}
      accent
      href={`#/item/${item.id}`}
      after={
        <button class="accessory" aria-label={`Log price for ${item.name}`} onClick={() => logFor(item.id)}>
          <Icon name="plus-circle" size={24} />
        </button>
      }
    />
  )
}

function Search() {
  return (
    <div class="search" role="search">
      <Icon name="search" size={18} />
      <input
        type="search" placeholder="Search" aria-label="Search items" enterKeyHint="search" autoComplete="off"
        value={query.value} onInput={(e) => (query.value = e.currentTarget.value)}
      />
      {query.value && (
        <button aria-label="Clear search" onClick={() => (query.value = '')}>
          <Icon name="x-circle" size={18} />
        </button>
      )}
    </div>
  )
}

export function List() {
  const q = normalizeName(query.value)
  const list = rows(data.value, q)
  const total = live(data.value.items).length
  return (
    <div class="list-page">
      <NavBar
        title="Pricebook"
        large
        actions={
          <>
            <SyncButton />
            <IconButton icon="settings" label="Settings" onClick={() => go('#/settings')} />
          </>
        }
      />
      <main>
        {total > 0 && <Search />}
        {list.length ? (
          sections(list).map(([letter, group]) => (
            <Group key={letter} header={letter} class="letters">
              {group.map((r) => <ItemRow key={r.item.id} row={r} q={q} />)}
            </Group>
          ))
        ) : q ? (
          <Empty icon="search" title={`No Results for “${q}”`} text="Check the spelling, or log it as a new item.">
            <button class="toolbar-action" onClick={() => logFor(q)}>
              <Icon name="plus-circle" /> Log “{q}”
            </button>
          </Empty>
        ) : (
          <Empty icon="tag" title="No Prices Yet" text="Log what you pay, and Pricebook remembers the cheapest store for every item.">
            <button class="toolbar-action" onClick={() => logFor('')}>
              <Icon name="plus-circle" /> Log First Price
            </button>
          </Empty>
        )}
      </main>
      <Toolbar>
        <button class="toolbar-action" onClick={() => logFor(q)}>
          <Icon name="plus-circle" size={24} /> Log Price
        </button>
        <span class="toolbar-note">{total === 1 ? '1 item' : `${total} items`}</span>
      </Toolbar>
    </div>
  )
}
