import { signal } from '@preact/signals'

export const route = signal(location.hash)
addEventListener('popstate', () => (route.value = location.hash))

export function go(hash: string) {
  history.pushState({ inApp: true }, '', hash)
  route.value = hash
}

/** Steps back inside the app; a deep-linked page falls back to the list instead of leaving. */
export function back() {
  if ((history.state as { inApp?: boolean } | null)?.inApp) return history.back()
  history.replaceState(null, '', '#/')
  route.value = '#/'
}

export function parse(hash: string) {
  const [, view = '', arg = ''] = hash.split('/')
  try {
    return { view, arg: decodeURIComponent(arg) }
  } catch {
    return { view, arg: '' }
  }
}

export const link = (hash: string) => ({
  href: hash,
  onClick: (e: MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    e.preventDefault()
    go(hash)
  },
})
