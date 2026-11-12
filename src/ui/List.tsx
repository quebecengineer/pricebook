import { signal } from '@preact/signals'
import { category, categoryOf } from '../categories'
import {
  isStale, live, nameOf, normalizeName, pctAbove, rows, sections, unitPrice, type Price, type Row as ItemRowData,
} from '../model'
import { go } from '../router'
import { settings } from '../settings'
import { data } from '../state'
import { signIn } from '../sync/drive'
import { account, syncStatus } from '../sync/sync'
import { ago, formatUnitPrice } from '../units'
import { IconButton, NavBar, SyncButton, Toolbar } from './Bar'
import { Icon } from './Icon'
import { Chips, Empty, Group, Row, Segmented } from './kit'
import { MoveGroup } from './Move'

const SORTS = ['Price', 'A–Z'] as const
const query = signal('')
const sort = signal<(typeof SORTS)[number]>('Price')
const logFor = (arg: string) => go(`#/add/${encodeURIComponent(arg)}`)
/** Signed in: show what Drive holds. Otherwise sign in first; the return trip offers the restore. */
const restoreFromDrive = () => (account.value ? go('#/restore') : signIn())

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

/** "Best" for the cheapest in its group, otherwise how much dearer it is. */
function Rank({ price, cheapest }: { price: Price; cheapest: Price }) {
  const pct = pctAbove(unitPrice(price), unitPrice(cheapest))
  return pct === 0 ? <span class="badge">Best</span> : <>+{pct}% ·{' '}</>
}

function ItemRow({ row: { item, price }, q, cheapest }: { row: ItemRowData; q: string; cheapest?: Price }) {
  const stale = !!price && isStale(price.at)
  const subtitle = price ? (
    <>
      {cheapest && <Rank price={price} cheapest={cheapest} />}
      {nameOf(data.value.stores, price.storeId)} · {stale && <Icon name="clock" size={13} />}
      {ago(price.at)}
      {stale && <span class="sr-only">, may be outdated</span>}
    </>
  ) : (
    'No price yet'
  )
  return (
    <Row
      title={<Highlight text={item.name} q={q} />}
      subtitle={subtitle}
      value={price && formatUnitPrice(price, item.unit, settings.value.currency)}
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
        type="search" placeholder="Search items or categories" aria-label="Search items or categories" enterKeyHint="search"
        autoComplete="off" value={query.value} onInput={(e) => (query.value = e.currentTarget.value)}
      />
      {query.value && (
        <button aria-label="Clear search" onClick={() => (query.value = '')}>
          <Icon name="x-circle" size={18} />
        </button>
      )}
    </div>
  )
}

/** Names of the categories among the results, to narrow by; only worth showing when there is a choice. */
function categoriesIn(list: ItemRowData[]) {
  const names = new Set(list.map((r) => category(categoryOf(r.item))?.name).filter((n): n is string => !!n))
  return names.size > 1 ? [...names] : []
}

/** A–Z under letters, or ranked by cost under each unit with the cheapest as the yardstick. */
function Results({ list, q, byCost }: { list: ItemRowData[]; q: string; byCost: boolean }) {
  const groups = byCost ? sections(list, (r) => r.item.unit) : sections(list)
  return (
    <>
      {groups.map(([key, group]) => (
        <Group key={key} header={byCost ? `Per ${key}` : key} class="letters">
          {group.map((r) => <ItemRow key={r.item.id} row={r} q={q} cheapest={byCost ? group[0]!.price : undefined} />)}
        </Group>
      ))}
    </>
  )
}

export function List() {
  const q = normalizeName(query.value)
  const byCost = !!q && sort.value === 'Price'
  const list = rows(data.value, q, byCost)
  const total = live(data.value.items).length
  const status = q ? `${list.length === 1 ? '1 result' : `${list.length} results`}${byCost ? ', cheapest first' : ''}` : ''
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
        {!q && <MoveGroup />}
        {total > 0 && <Search />}
        {q && (
          <>
            <Segmented label="Sort" options={SORTS} value={sort.value} onChange={(v) => (sort.value = v)} />
            <Chips label="Categories" options={categoriesIn(list)} selected={q} onPick={(v) => (query.value = v)} />
          </>
        )}
        <p class="sr-only" aria-live="polite">{status}</p>
        {list.length ? (
          <Results list={list} q={q} byCost={byCost} />
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
            {syncStatus.value !== 'unavailable' && (
              <button class="toolbar-action" onClick={restoreFromDrive}>
                <Icon name="cloud-check" /> Restore from Google Drive
              </button>
            )}
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
