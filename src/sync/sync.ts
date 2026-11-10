import { effect, signal } from '@preact/signals'
import { empty } from '../model'
import { settings, updateSettings } from '../settings'
import { absorb, data, localEdits } from '../state'
import { download, findFile, hasToken, preloadGis, signIn, signOut, upload } from './drive'
import { parseSnapshot, toSnapshot } from './merge'

export type SyncStatus = 'off' | 'signed-out' | 'offline' | 'idle' | 'syncing' | 'error'

export const syncStatus = signal<SyncStatus>(settings.value.driveConnected ? 'signed-out' : 'off')
export const syncError = signal('')

const DEBOUNCE_MS = 3000
let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | undefined
let again = false

function blocker(): SyncStatus | undefined {
  if (!settings.value.driveConnected) return 'off'
  if (!navigator.onLine) return 'offline'
  if (!hasToken()) return 'signed-out'
}

/** Pull, merge, push. Never throws; the outcome lands in `syncStatus`. */
async function run() {
  syncStatus.value = 'syncing'
  try {
    const id = await findFile()
    const remote = id ? parseSnapshot(await download(id)) : empty()
    const { behind } = await absorb(remote, false)
    if (behind || !id) await upload(JSON.stringify(toSnapshot(data.value)), id)
    updateSettings({ lastSync: Date.now() })
    syncError.value = ''
    syncStatus.value = 'idle'
  } catch (e) {
    console.error(e)
    syncError.value = e instanceof Error ? e.message : String(e)
    syncStatus.value = hasToken() ? 'error' : 'signed-out'
  }
}

/** Runs one sync at a time; a request made mid-sync queues exactly one follow-up. */
export function syncNow(): Promise<void> {
  const blocked = blocker()
  if (blocked) {
    syncStatus.value = blocked
    return Promise.resolve()
  }
  if (running) {
    again = true
    return running
  }
  running = run().finally(() => {
    running = undefined
    if (again) {
      again = false
      void syncNow()
    }
  })
  return running
}

function flush() {
  clearTimeout(timer)
  timer = undefined
  void syncNow()
}

/** User-initiated: signs in if needed (must run inside a tap), then syncs. */
export async function connect() {
  if (!hasToken()) await signIn()
  updateSettings({ driveConnected: true })
  await syncNow()
  if (syncStatus.value === 'error') throw new Error(syncError.value)
}

export function disconnect() {
  signOut()
  updateSettings({ driveConnected: false, lastSync: undefined })
  syncStatus.value = 'off'
}

export function startSync() {
  effect(() => {
    if (!localEdits.value) return
    clearTimeout(timer)
    timer = setTimeout(flush, DEBOUNCE_MS)
  })
  addEventListener('online', flush)
  addEventListener('offline', flush)
  document.addEventListener('visibilitychange', () => document.hidden && timer && flush())
  if (settings.value.driveConnected && navigator.onLine) void preloadGis()
  flush()
}
