import { signal } from '@preact/signals'

interface NavState {
  inApp?: boolean
  /** Page beneath a sheet. */
  under?: string
  /** Scroll position to restore when returning to this entry. */
  y?: number
}

const state = (): NavState => (history.state as NavState | null) ?? {}

export const route = signal(location.hash)
export const under = signal(state().under ?? '#/')

export function parse(hash: string) {
  const [, view = '', arg = ''] = hash.split('/')
  try {
    return { view, arg: decodeURIComponent(arg) }
  } catch {
    return { view, arg: '' }
  }
}

const SHEETS = new Set(['add', 'edit'])
export const isSheet = (hash: string) => SHEETS.has(parse(hash).view)

function read() {
  route.value = location.hash
  under.value = state().under ?? '#/'
}

/** Page change with a push/pop view transition where supported; scroll is set after the new page renders. */
function transition(direction: 'forward' | 'back', update: () => void, y: number) {
  document.documentElement.dataset.nav = direction
  const run = () => {
    update()
    return new Promise<void>((done) => setTimeout(() => (scrollTo(0, y), done())))
  }
  if ('startViewTransition' in document) document.startViewTransition(run)
  else void run()
}

addEventListener('popstate', () => {
  if (isSheet(route.value) || isSheet(location.hash)) return read()
  transition('back', read, state().y ?? 0)
})

export function go(hash: string) {
  const sheet = isSheet(hash)
  history.replaceState({ ...state(), y: scrollY }, '')
  const next: NavState = { inApp: true, under: sheet ? (isSheet(route.value) ? under.value : route.value) : undefined }
  const push = () => {
    history.pushState(next, '', hash)
    read()
  }
  if (sheet) push()
  else transition('forward', push, 0)
}

/** Steps back inside the app; a deep-linked page falls back to the list instead of leaving. */
export function back() {
  if (state().inApp) return history.back()
  history.replaceState(null, '', '#/')
  read()
}

/** Moves screen-reader focus to the new page's title. */
export const focusTitle = () => document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })

export const link = (hash: string) => ({
  href: hash,
  onClick: (e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    e.preventDefault()
    go(hash)
  },
})
