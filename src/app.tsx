import { useEffect, useRef } from 'preact/hooks'
import { focusTitle, isSheet, parse, route, under } from './router'
import { loaded } from './state'
import { ItemView } from './ui/ItemView'
import { List } from './ui/List'
import { LogSheet } from './ui/LogSheet'
import { Settings } from './ui/Settings'
import { Toast } from './ui/Toast'

function Page({ hash }: { hash: string }) {
  const { view, arg } = parse(hash)
  if (view === 'item') return <ItemView id={arg} />
  if (view === 'settings') return <Settings />
  return <List />
}

function Screens() {
  const sheet = isSheet(route.value)
  const base = sheet ? under.value : route.value
  const first = useRef(true)
  useEffect(() => {
    if (first.current) first.current = false
    else focusTitle()
  }, [base])
  const { view, arg } = parse(route.value)
  return (
    <>
      <Page key={base} hash={base} />
      {sheet && <LogSheet key={route.value} arg={arg} edit={view === 'edit'} />}
    </>
  )
}

export function App() {
  return (
    <>
      {loaded.value === 'ready' && <Screens />}
      {loaded.value === 'failed' && (
        <main class="empty">
          <p>Storage is unavailable, so prices can't be saved. Private browsing can block it; try a normal window.</p>
        </main>
      )}
      <Toast />
    </>
  )
}
