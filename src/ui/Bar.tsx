import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { back, go } from '../router'
import { connect, syncError, syncStatus, type SyncStatus } from '../sync/sync'
import { Icon, type IconName } from './Icon'
import { fail } from './Toast'

interface NavProps {
  title: string
  /** Shows a Large Title that collapses into the bar on scroll. */
  large?: boolean
  /** Label of the page the back button returns to. */
  back?: string
  actions?: ComponentChildren
}

export function NavBar({ title, large, back: backLabel, actions }: NavProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [scrolled, setScrolled] = useState(!large)
  useEffect(() => {
    if (!large || !heading.current) return
    const io = new IntersectionObserver(([e]) => setScrolled(!e?.isIntersecting), { rootMargin: '-60px 0px 0px 0px' })
    io.observe(heading.current)
    return () => io.disconnect()
  }, [large])

  return (
    <>
      <header class={`nav ${large ? 'large' : ''} ${scrolled ? 'scrolled' : ''}`}>
        <div class="nav-lead">
          {backLabel && (
            <button class="nav-btn" onClick={back} aria-label={`Back to ${backLabel}`}>
              <Icon name="chevron-left" size={28} />
              {backLabel}
            </button>
          )}
        </div>
        {large ? (
          <span class="nav-title" aria-hidden="true">{title}</span>
        ) : (
          <h1 class="nav-title" tabIndex={-1}>{title}</h1>
        )}
        <div class="nav-trail">{actions}</div>
      </header>
      {large && <h1 ref={heading} class="large-title" tabIndex={-1}>{title}</h1>}
    </>
  )
}

export function IconButton({ icon, label, onClick, class: cls }: { icon: IconName; label: string; onClick: () => void; class?: string }) {
  return (
    <button class={`icon-btn ${cls ?? ''}`} aria-label={label} title={label} onClick={onClick}>
      <Icon name={icon} size={24} />
    </button>
  )
}

export const Toolbar = ({ children }: { children: ComponentChildren }) => <footer class="toolbar">{children}</footer>

const SYNC: Record<Exclude<SyncStatus, 'off' | 'unavailable'>, [IconName, string]> = {
  'signed-out': ['cloud-off', 'Backup paused. Tap to sign in to Google Drive'],
  offline: ['cloud-off', 'Offline. Backup resumes when connected'],
  idle: ['cloud-check', 'Backed up to Google Drive. Tap to back up now'],
  syncing: ['refresh', 'Backing up'],
  locked: ['alert', 'Backup is encrypted. Tap to enter its password'],
  error: ['alert', 'Backup failed. Tap to retry'],
}

function onSyncTap(status: SyncStatus) {
  if (status === 'locked') return go('#/password')
  if (status !== 'syncing' && status !== 'offline') connect().catch((e) => fail(e, 'Backup failed'))
}

export function SyncButton() {
  const status = syncStatus.value
  if (status === 'off' || status === 'unavailable') return null
  const [icon, label] = SYNC[status]
  const detail = status === 'error' && syncError.value ? `${label}: ${syncError.value}` : label
  const alarm = status === 'error' || status === 'signed-out' || status === 'locked'
  return (
    <IconButton
      icon={icon} label={detail} class={`${status === 'syncing' ? 'spin-icon' : ''} ${alarm ? 'danger' : ''}`}
      onClick={() => onSyncTap(status)}
    />
  )
}
