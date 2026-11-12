import { effect, signal } from '@preact/signals'
import { deleteKey, loadKey, saveKey } from '../db'
import { live } from '../model'
import { settings, updateSettings, type Every } from '../settings'
import { absorb, data, localEdits } from '../state'
import { scheduleBackground } from './background'
import { backupOnce } from './backup'
import { deriveKey, isEnvelope, Locked, unlock, type BackupKey } from './crypto'
import { account as fetchAccount, download, info, signIn, signOut, SignedOut, Unavailable } from './drive'

export type SyncStatus = 'unavailable' | 'off' | 'signed-out' | 'offline' | 'idle' | 'syncing' | 'locked' | 'error'

export const syncStatus = signal<SyncStatus>('off')
export const syncError = signal('')
/** Email of the signed-in Google account; empty when signed out. */
export const account = signal('')
export const backupKey = signal<BackupKey | undefined>(undefined)

const DEBOUNCE_MS = 3000
const DAY = 86_400_000
const INTERVAL: Record<Every, number> = { change: 0, day: DAY, week: 7 * DAY, month: 30 * DAY, manual: Infinity }
let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | undefined
let again = false

export const isDue = (every: Every, last: number | undefined, now = Date.now()) => now - (last ?? 0) >= INTERVAL[every]

const offStatus = (): SyncStatus => (settings.value.driveConnected ? 'signed-out' : 'off')

function blocker(): SyncStatus | undefined {
  if (syncStatus.value === 'unavailable') return 'unavailable'
  if (!settings.value.driveConnected) return 'off'
  if (!navigator.onLine) return 'offline'
  if (!account.value) return 'signed-out'
}

function settle(e: unknown) {
  console.error(e)
  syncError.value = e instanceof Error ? e.message : String(e)
  if (e instanceof SignedOut) account.value = ''
  syncStatus.value =
    e instanceof SignedOut ? offStatus() : e instanceof Locked ? 'locked' : e instanceof Unavailable ? 'unavailable' : 'error'
}

/** Keeps this device's key in step with how the cloud copy is sealed. */
async function adopt(key: BackupKey | undefined) {
  if (key === backupKey.value) return
  if (key) await saveKey(key)
  else await deleteKey()
  backupKey.value = key
}

async function run(rekeyTo?: BackupKey | null) {
  syncStatus.value = 'syncing'
  try {
    const { saved, key } = await backupOnce(data.value, backupKey.value, (incoming) => absorb(incoming, false), rekeyTo)
    await adopt(key)
    updateSettings({ lastSync: Date.now(), ...(saved && { lastBackupBytes: saved.size }) })
    syncError.value = ''
    syncStatus.value = 'idle'
  } catch (e) {
    settle(e)
  }
}

/** Runs one backup at a time; a request made mid-backup queues exactly one follow-up. */
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

/** Backs up when the schedule says so. */
export const syncIfDue = () => (isDue(settings.value.backupEvery, settings.value.lastSync) ? syncNow() : Promise.resolve())

/** Asks the Worker who is signed in; it also tells whether backup is available at this address at all. */
export async function probe() {
  if (!navigator.onLine) {
    syncStatus.value = settings.value.driveConnected ? 'offline' : 'off'
    return
  }
  try {
    account.value = await fetchAccount()
    syncStatus.value = settings.value.driveConnected ? 'idle' : 'off'
  } catch (e) {
    account.value = ''
    syncStatus.value = e instanceof Unavailable ? 'unavailable' : e instanceof SignedOut ? offStatus() : 'error'
  }
}

/** Turns backup on; signs in first when needed, which leaves the page and returns to `#/auth/ok`. */
export async function connect() {
  if (!account.value) return signIn()
  updateSettings({ driveConnected: true })
  await syncNow()
  if (syncStatus.value === 'error') throw new Error(syncError.value)
}

export async function disconnect() {
  await signOut().catch(console.error)
  await deleteKey()
  backupKey.value = undefined
  account.value = ''
  updateSettings({ driveConnected: false, lastSync: undefined, lastBackupBytes: undefined })
  syncStatus.value = 'off'
}

/** What a new device finds in Drive, for the restore prompt. */
export async function peekBackup() {
  const found = await info()
  return found && { ...found, encrypted: isEnvelope(await download()) }
}

/** Proves the password against the encrypted backup and keeps the key on this device. */
export async function unlockBackup(password: string) {
  const raw = await download()
  if (!isEnvelope(raw)) throw new Error('This backup is not encrypted')
  const { key } = await unlock(raw, password)
  await saveKey(key)
  backupKey.value = key
}

/** Merges the Drive backup into this device and turns backup on; never deletes anything here. */
export async function restore(password?: string) {
  if (password) await unlockBackup(password)
  updateSettings({ driveConnected: true })
  await syncNow()
  if (syncStatus.value !== 'idle') throw new Error(syncError.value || 'Restore failed')
  return live(data.value.items).length
}

/** Re-uploads the backup sealed with a new key, or none. The current key still has to open it first. */
async function rekey(next: BackupKey | null) {
  const blocked = blocker()
  if (blocked) throw new Error(blocked === 'offline' ? 'You are offline' : 'Turn on Google Drive backup first')
  await running
  await run(next)
  if (syncStatus.value !== 'idle') throw new Error(syncError.value)
}

export const setPassword = async (password: string) => rekey(await deriveKey(password))
export const removePassword = () => rekey(null)

function flush() {
  clearTimeout(timer)
  timer = undefined
  void syncNow()
}

export async function startSync() {
  backupKey.value = await loadKey()
  effect(() => {
    if (!localEdits.value || settings.peek().backupEvery !== 'change') return
    clearTimeout(timer)
    timer = setTimeout(flush, DEBOUNCE_MS)
  })
  effect(() => {
    const { driveConnected, backupEvery } = settings.value
    scheduleBackground(driveConnected, INTERVAL[backupEvery]).catch(() => undefined)
  })
  addEventListener('online', () => void probe().then(syncIfDue))
  addEventListener('offline', () => void probe())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return timer && flush()
    void syncIfDue()
  })
  await probe()
  await syncIfDue()
}
