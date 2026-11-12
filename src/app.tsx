import { useEffect, useRef, useState } from 'preact/hooks'
import { focusTitle, isSheet, parse, route, under } from './router'
import { loaded } from './state'
import { AuthReturn } from './ui/Backup'
import { ItemView } from './ui/ItemView'
import { List } from './ui/List'
import { LogSheet } from './ui/LogSheet'
import { MovePage } from './ui/Move'
import { PasswordSheet } from './ui/PasswordSheet'
import { RestoreSheet } from './ui/RestoreSheet'
import { SheetExit } from './ui/Sheet'
import { Settings } from './ui/Settings'
import { Toast } from './ui/Toast'

function Page({ hash }: { hash: string }) {
  const { view, arg } = parse(hash)
  if (view === 'item') return <ItemView id={arg} />
  if (view === 'settings') return <Settings />
  if (view === 'auth') return <AuthReturn result={arg} />
  if (view === 'move') return <MovePage />
  return <List />
}

function SheetFor({ hash }: { hash: string }) {
  const { view, arg } = parse(hash)
  if (view === 'restore') return <RestoreSheet />
  if (view === 'password') return <PasswordSheet />
  return <LogSheet arg={arg} edit={view === 'edit'} />
}

function Screens() {
  const sheet = isSheet(route.value)
  const base = sheet ? under.value : route.value
  const first = useRef(true)
  /** The sheet that just closed stays mounted until its exit animation ends, whichever way it was closed. */
  const last = useRef<string | null>(null)
  const [, rerender] = useState(0)
  if (sheet) last.current = route.value
  const shown = sheet ? route.value : last.current
  useEffect(() => {
    if (first.current) first.current = false
    else focusTitle()
  }, [base])
  const gone = () => {
    last.current = null
    rerender((n) => n + 1)
  }
  return (
    <>
      <Page key={base} hash={base} />
      {shown && (
        <SheetExit.Provider key={shown} value={sheet ? null : gone}>
          <SheetFor hash={shown} />
        </SheetExit.Provider>
      )}
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
