import { signal } from '@preact/signals'

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

export function Toast() {
  const n = note.value
  const run = () => {
    note.value = null
    n?.action?.run()
  }
  return (
    <div class="toast-host" role="status" aria-live="polite">
      {n && (
        <div class={`toast ${n.tone ?? ''}`}>
          <span>{n.text}</span>
          {n.action && <button onClick={run}>{n.action.label}</button>}
        </div>
      )}
    </div>
  )
}
