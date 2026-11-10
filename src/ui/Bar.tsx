import type { ComponentChildren } from 'preact'
import { back } from '../router'
import { connect, syncStatus, syncError, type SyncStatus } from '../sync/sync'
import { fail } from './Toast'

export function Bar({ title, hasBack, children }: { title: string; hasBack?: boolean; children?: ComponentChildren }) {
  return (
    <header class="bar">
      {hasBack && (
        <button class="icon" aria-label="Back" onClick={back}>
          ‹
        </button>
      )}
      <h1>{title}</h1>
      {children}
    </header>
  )
}

const LABEL: Record<SyncStatus, string> = {
  off: '',
  'signed-out': 'Tap to sync',
  offline: 'Offline',
  idle: 'Synced',
  syncing: 'Syncing…',
  error: 'Sync failed',
}

export function SyncChip() {
  const status = syncStatus.value
  if (status === 'off') return null
  return (
    <button
      class={`chip ${status}`}
      disabled={status === 'syncing' || status === 'offline'}
      title={syncError.value || undefined}
      onClick={() => connect().catch((e) => fail(e, 'Sync failed'))}
    >
      {LABEL[status]}
    </button>
  )
}
