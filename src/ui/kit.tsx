import type { ComponentChildren, Ref } from 'preact'
import { useState } from 'preact/hooks'
import { link } from '../router'
import { Icon, type IconName } from './Icon'
import { fail } from './Toast'

type Kids = ComponentChildren

/** Inset grouped section. Children must be `Cell`s or `Row`s. */
export function Group({ header, footer, class: cls, children }: { header?: Kids; footer?: Kids; class?: string; children: Kids }) {
  return (
    <section class={`group ${cls ?? ''}`}>
      {header && <h2 class="group-header">{header}</h2>}
      <ul class="cells">{children}</ul>
      {footer && <p class="group-footer">{footer}</p>}
    </section>
  )
}

export const Cell = ({ children }: { children: Kids }) => <li class="cell">{children}</li>

interface RowProps {
  title: Kids
  subtitle?: Kids
  value?: Kids
  accent?: boolean
  tone?: 'accent' | 'danger'
  href?: string
  onClick?: () => void
  label?: string
  before?: Kids
  after?: Kids
}

/** A row's contents without its list item, for wrappers such as `Swipe` that supply their own. */
export function RowBody({ title, subtitle, value, accent, tone, href, onClick, label, before, after }: RowProps) {
  const body = (
    <>
      <span class="row-text">
        <span class={`row-title ${tone ?? ''}`}>{title}</span>
        {subtitle && <span class="row-sub">{subtitle}</span>}
      </span>
      {value !== undefined && <span class={`row-value ${accent ? 'accent' : ''}`}>{value}</span>}
      {href && <Icon name="chevron-right" size={18} class="chev" />}
    </>
  )
  return (
    <>
      {before}
      {href ? (
        <a class="row-main" {...link(href)} aria-label={label}>{body}</a>
      ) : onClick ? (
        <button class="row-main" onClick={onClick} aria-label={label}>{body}</button>
      ) : (
        <div class="row-main">{body}</div>
      )}
      {after}
    </>
  )
}

/** Standard table row: navigates with `href`, acts with `onClick`, or just displays. */
export const Row = (props: RowProps) => (
  <li class="cell">
    <RowBody {...props} />
  </li>
)

interface FieldProps {
  label: string
  value: string
  onValue: (value: string) => void
  class?: string
  prefix?: string
  suffix?: string
  decimal?: boolean
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  hideLabel?: boolean
  /** Codes and IDs: no auto-capitalize, autocorrect or spellcheck. */
  raw?: boolean
  inputRef?: Ref<HTMLInputElement>
}

/** iOS form row: label on the left, input filling the rest. */
export function Field({ label, onValue, inputRef, decimal, prefix, suffix, hideLabel, raw, class: cls, ...input }: FieldProps) {
  return (
    <label class={`field ${cls ?? ''}`}>
      <span class={hideLabel ? 'sr-only' : 'field-label'}>{label}</span>
      {prefix && <span class="prefix" aria-hidden="true">{prefix}</span>}
      <input
        {...input} ref={inputRef} maxLength={100} autoComplete="off" autoCapitalize={decimal || raw ? 'off' : 'words'}
        autoCorrect={raw ? 'off' : undefined} spellcheck={!raw}
        inputMode={decimal ? 'decimal' : 'text'} pattern={decimal ? '[0-9]*[.,]?[0-9]*' : undefined}
        enterKeyHint={decimal ? 'done' : 'next'} onInput={(e) => onValue(e.currentTarget.value)}
      />
      {suffix && <span class="suffix" aria-hidden="true">{suffix}</span>}
    </label>
  )
}

interface SecretProps {
  label: string
  value: string
  onValue: (value: string) => void
  /** The hint password managers use to offer a saved password or save a new one. */
  autoComplete: 'current-password' | 'new-password'
  autoFocus?: boolean
}

/** Masked password row. */
export function SecretField({ label, value, onValue, autoComplete, autoFocus }: SecretProps) {
  return (
    <label class="field">
      <span class="field-label">{label}</span>
      <input
        type="password" value={value} autoComplete={autoComplete} autoFocus={autoFocus} maxLength={200}
        autoCapitalize="off" spellcheck={false} onInput={(e) => onValue(e.currentTarget.value)}
      />
    </label>
  )
}

const TYPED = 'input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=hidden]):not(:disabled)'

/**
 * Form `onKeyDown`, like the iOS keyboard's Next key: Enter moves to the next empty field (wrapping round),
 * and only submits once every field has something in it.
 */
export function nextOnEnter(e: KeyboardEvent) {
  const field = e.target
  if (e.key !== 'Enter' || e.isComposing || !(field instanceof HTMLInputElement)) return
  const fields = [...(e.currentTarget as HTMLFormElement).querySelectorAll<HTMLInputElement>(TYPED)]
  const at = fields.indexOf(field)
  const next = [...fields.slice(at + 1), ...fields.slice(0, at)].find((f) => !f.value.trim())
  if (!next) return
  e.preventDefault()
  next.focus()
}

const same = (a = '', b = '') => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/** Quick-pick capsules; the one matching `selected` shows as pressed. */
export function Chips({ label, options, selected, onPick }: { label: string; options: string[]; selected?: string; onPick: (v: string) => void }) {
  if (!options.length) return null
  return (
    <div class="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" class="chip" aria-pressed={same(o, selected)} onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

/** iOS segmented control; one thumb slides between options instead of each option repainting. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value?: T; onChange: (v: T) => void }) {
  const at = value === undefined ? -1 : options.indexOf(value)
  return (
    <fieldset class="segmented" style={{ '--n': options.length, '--i': at }}>
      <legend class="sr-only">{label}</legend>
      {at >= 0 && <span class="thumb" aria-hidden="true" />}
      {options.map((o) => (
        <label key={o}>
          <input type="radio" name={label} value={o} checked={o === value} onChange={() => onChange(o)} />
          <span>{o}</span>
        </label>
      ))}
    </fieldset>
  )
}

/** Inline rename cell; saving is explicit so a stray tap never renames anything. */
export function NameRow({ label, value, hideLabel, raw, onSave }: { label: string; value: string; hideLabel?: boolean; raw?: boolean; onSave: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState(value)
  const submit = (e: Event) => {
    e.preventDefault()
    onSave(name).catch((err) => fail(err))
  }
  return (
    <Cell>
      <form class="inline-form" onSubmit={submit}>
        <Field label={label} value={name} onValue={setName} hideLabel={hideLabel} raw={raw} placeholder={raw ? 'Paste here' : undefined} />
        <button class="nav-btn strong" disabled={!name.trim() || name.trim() === value}>Save</button>
      </form>
    </Cell>
  )
}

/** HIG "content unavailable" view. */
export function Empty({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: Kids }) {
  return (
    <div class="empty">
      <Icon name={icon} size={52} />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  )
}

/** Android haptics; Safari has no Vibration API, so this is a no-op there. */
export const haptic = (kind: 'tap' | 'success' = 'tap') => navigator.vibrate?.(kind === 'success' ? [12, 60, 12] : 10)
