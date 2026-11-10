import { parse, route } from './router'
import { loaded } from './state'
import { AddSheet } from './ui/AddSheet'
import { ItemView } from './ui/ItemView'
import { List } from './ui/List'
import { Settings } from './ui/Settings'
import { Toast } from './ui/Toast'

function Page() {
  const { view, arg } = parse(route.value)
  switch (view) {
    case 'add':
      return <AddSheet key={`add:${arg}`} arg={arg} />
    case 'edit':
      return <AddSheet key={`edit:${arg}`} arg={arg} edit />
    case 'item':
      return <ItemView id={arg} />
    case 'settings':
      return <Settings />
    default:
      return <List />
  }
}

export function App() {
  return (
    <>
      {loaded.value === 'ready' && <Page />}
      {loaded.value === 'failed' && (
        <main class="empty">
          <p>Storage is unavailable, so prices can't be saved. Private browsing can block it; try a normal window.</p>
        </main>
      )}
      <Toast />
    </>
  )
}
