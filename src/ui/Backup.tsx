import { useEffect } from 'preact/hooks'
import { live } from '../model'
import { movedTo } from '../move'
import { go, replace } from '../router'
import { settings, updateSettings, type Every } from '../settings'
import { data } from '../state'
import { info } from '../sync/drive'
import { account, backupKey, connect, disconnect, probe, syncError, syncNow, syncStatus, type SyncStatus } from '../sync/sync'
import { formatBytes, formatDateTime } from '../units'
import { Group, Row } from './kit'
import { fail, toast } from './Toast'

const EVERY: Record<Every, string> = {
  change: 'Every change',
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  manual: 'Only when I tap Back Up',
}
const STATUS: Partial<Record<SyncStatus, string>> = {
  syncing: 'Backing up…',
  offline: 'Offline',
  error: 'Failed',
  locked: 'Needs password',
  'signed-out': 'Signed out',
}
const ABOUT =
  'Saves your prices to a hidden folder in your Google Drive that only Pricebook can see, so you can restore them on a new phone.'

const backUp = () =>
  syncNow().then(() => {
    if (syncStatus.value === 'idle') toast('Backed up to Google Drive', { tone: 'good' })
    else if (syncStatus.value === 'locked') go('#/password')
    else if (syncError.value) fail(new Error(syncError.value), 'Backup failed')
  })

const turnOn = () => connect().catch((e) => fail(e, 'Backup failed'))

function lastBackup() {
  const { lastSync, lastBackupBytes } = settings.value
  if (!lastSync) return 'Never'
  return lastBackupBytes ? `${formatDateTime(lastSync)} · ${formatBytes(lastBackupBytes)}` : formatDateTime(lastSync)
}

/** WhatsApp's "Chat backup" screen, for prices. */
export function BackupGroup() {
  const status = syncStatus.value
  if (status === 'unavailable') {
    const where = movedTo ? `Open Pricebook at ${new URL(movedTo).host} to back up to Google Drive.` : 'Backup needs the Pricebook server, which this address does not have.'
    return (
      <Group header="Google Drive Backup" footer={where}>
        <Row title="Google Drive" value="Not available" />
      </Group>
    )
  }
  if (!settings.value.driveConnected) {
    return (
      <Group header="Google Drive Backup" footer={ABOUT}>
        <Row title="Back Up to Google Drive" subtitle={account.value || undefined} tone="accent" onClick={() => void turnOn()} />
      </Group>
    )
  }
  if (status === 'signed-out') {
    return (
      <Group header="Google Drive Backup" footer="Google sign-in ended or was removed. Your prices are safe on this device; sign in to keep backing up.">
        <Row title="Reconnect Google Drive" tone="accent" onClick={() => void turnOn()} />
        <Row title="Turn Off Backup" tone="danger" onClick={() => void disconnect()} />
      </Group>
    )
  }
  const footer = status === 'error' || status === 'locked' ? syncError.value : ABOUT
  return (
    <Group header="Google Drive Backup" footer={footer}>
      <Row title="Google Account" value={account.value || '…'} />
      <Row title="Last Backup" value={lastBackup()} />
      {status === 'locked' ? (
        <Row title="Enter Backup Password" tone="accent" href="#/password" />
      ) : (
        <Row title="Back Up" tone="accent" value={STATUS[status]} onClick={() => void backUp()} />
      )}
      <Row
        title="Back Up Every"
        value={
          <select class="row-select" aria-label="Back up every" value={settings.value.backupEvery} onChange={(e) => updateSettings({ backupEvery: e.currentTarget.value as Every })}>
            {Object.entries(EVERY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        }
      />
      <Row title="Encrypted Backup" value={backupKey.value ? 'On' : 'Off'} href="#/password" />
      <Row title="Turn Off Backup" tone="danger" onClick={() => void disconnect().then(() => toast('Backup turned off. Your Drive backup is kept.'))} />
    </Group>
  )
}

const SIGN_IN: Record<string, string> = {
  cancelled: 'Sign-in cancelled',
  denied: 'Pricebook needs access to Google Drive. Try again and leave the Drive box ticked.',
  failed: 'Google sign-in failed. Try again.',
}

/** Where the Worker sends the browser after Google sign-in (`#/auth/<result>`). */
async function finishSignIn(result: string) {
  replace('#/settings')
  if (result !== 'ok') return fail(new Error(SIGN_IN[result] ?? SIGN_IN.failed))
  await probe()
  const fresh = live(data.value.items).length === 0
  if (fresh && (await info().catch(() => undefined))) return go('#/restore')
  await turnOn()
  if (syncStatus.value === 'idle') toast('Backed up to Google Drive', { tone: 'good' })
}

export function AuthReturn({ result }: { result: string }) {
  useEffect(() => void finishSignIn(result).catch(fail), [result])
  return null
}
