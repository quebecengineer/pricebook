import { signal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { Icon } from './Icon'

interface Note {
  text: string
  tone?: 'good' | 'bad'
  action?: { label: string; run: () => void }
  sticky?: boolean
}

const note = signal<Note | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

export function toast(text: string, opts: Omit<Note, 'text'> = {}) {
  clearTimeout(timer)
  note.value = { text, ...opts }
  if (!opts.sticky) timer = setTimeout(() => (note.value = null), opts.action ? 8000 : 3500)
}

export function fail(e: unknown, prefix?: string) {
  console.error(e)
  const message = e instanceof Error ? e.message : String(e)
  toast(prefix ? `${prefix}: ${message}` : message, { tone: 'bad' })
}

/** Banner kept open in the top layer and re-stacked per message, so it shows above an open sheet. */
export function Toast() {
  const host = useRef<HTMLDivElement>(null)
  const n = note.value
  useEffect(() => {
    const el = host.current
    if (!el || !('showPopover' in el)) return
    if (el.matches(':popover-open')) el.hidePopover()
    el.showPopover()
  }, [n])
  const run = () => {
    note.value = null
    n?.action?.run()
  }
  return (
    <div ref={host} popover="manual" class="toast-host" role="status" aria-live="polite">
      {n && (
        <div class={`toast ${n.tone ?? ''}`}>
          {n.tone && <Icon name={n.tone === 'good' ? 'trending-down' : 'alert'} size={20} />}
          <span>{n.text}</span>
          {n.action && <button onClick={run}>{n.action.label}</button>}
        </div>
      )}
    </div>
  )
}
