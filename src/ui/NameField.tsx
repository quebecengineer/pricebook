import { useState } from 'preact/hooks'
import { fail } from './Toast'

/** Inline rename form; saving is explicit so a stray tap never renames anything. */
export function NameField({ label, value, onSave }: { label: string; value: string; onSave: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState(value)
  const submit = (e: Event) => {
    e.preventDefault()
    onSave(name).catch((err) => fail(err))
  }
  return (
    <form class="inline" onSubmit={submit}>
      <input aria-label={label} value={name} onInput={(e) => setName(e.currentTarget.value)} required maxLength={100} />
      <button disabled={name.trim() === value}>Save</button>
    </form>
  )
}
