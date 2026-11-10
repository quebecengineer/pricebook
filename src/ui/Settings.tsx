import { useEffect } from 'preact/hooks'
import { installPrompt, isIOS, persisted, promptInstall, standalone } from '../install'
import { byName, live } from '../model'
import { settings, updateSettings } from '../settings'
import { absorb, data, rename } from '../state'
import { driveEnabled, preloadGis } from '../sync/drive'
import { parseSnapshot, toSnapshot } from '../sync/merge'
import { connect, disconnect, syncStatus, type SyncStatus } from '../sync/sync'
import { NavBar } from './Bar'
import { Cell, Group, NameRow, Row } from './kit'
import { fail, toast } from './Toast'

const CURRENCIES = Intl.supportedValuesOf('currency')
const MAX_IMPORT_BYTES = 10_000_000
const STATUS: Record<SyncStatus, string> = {
  off: 'Off', 'signed-out': 'Paused', offline: 'Offline', idle: 'Up to date', syncing: 'Syncing…', error: 'Failed',
}

function exportFile() {
  const blob = new Blob([JSON.stringify(toSnapshot(data.value))], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pricebook-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

async function importFile(e: Event) {
  const input = e.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('File is too large')
    const { pulled } = await absorb(parseSnapshot(JSON.parse(await file.text())), true)
    toast(`Imported ${pulled} new or updated records`)
  } catch (err) {
    fail(err, 'Import failed')
  }
}

function SyncGroup() {
  const { driveConnected, lastSync } = settings.value
  useEffect(() => {
    if (driveEnabled) void preloadGis()
  }, [])
  const sync = () => connect().catch((e) => fail(e, 'Sync failed'))
  if (!driveEnabled) {
    return (
      <Group header="Sync" footer="This build has no Google client ID, so Drive sync is off. Use Backup to move prices between devices.">
        <Row title="Google Drive" value="Not set up" />
      </Group>
    )
  }
  if (!driveConnected) {
    return (
      <Group header="Sync" footer="Keeps one file, pricebook.json, in your Google Drive so your devices share prices. The app can only see files it created.">
        <Row title="Connect Google Drive" tone="accent" onClick={sync} />
      </Group>
    )
  }
  return (
    <Group header="Sync" footer="Syncs a few seconds after each change and whenever you come back online.">
      <Row title="Google Drive" value={STATUS[syncStatus.value]} />
      <Row title="Last Synced" value={lastSync ? new Date(lastSync).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'} />
      <Row title="Sync Now" tone="accent" onClick={sync} />
      <Row title="Disconnect" tone="danger" onClick={disconnect} />
    </Group>
  )
}

function DeviceGroup() {
  const install = installPrompt.value
  const howTo = isIOS ? 'Tap Share, then Add to Home Screen' : 'Browser menu, then Install app or Add to Home screen'
  return (
    <Group header="This Device" footer="Installing keeps the app one tap away offline and protects its storage from automatic cleanup.">
      {standalone.value ? (
        <Row title="App" value="Installed" />
      ) : install ? (
        <Row title="Install App" tone="accent" onClick={() => void promptInstall()} />
      ) : (
        <Row title="Install App" subtitle={howTo} />
      )}
      <Row title="Offline Storage" value={persisted.value ? 'Protected' : 'Not protected'} />
    </Group>
  )
}

export function Settings() {
  const stores = live(data.value.stores).sort(byName)
  return (
    <>
      <NavBar title="Settings" large back="Pricebook" />
      <main>
        <Group header="General">
          <Row
            title="Currency"
            value={
              <select class="row-select" aria-label="Currency" value={settings.value.currency} onChange={(e) => updateSettings({ currency: e.currentTarget.value })}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            }
          />
        </Group>
        <SyncGroup />
        <Group header="Backup" footer="Importing merges: newer edits win and nothing else is overwritten.">
          <Row title="Export Backup" tone="accent" onClick={exportFile} />
          <Cell>
            <label class="row-main">
              <span class="row-text">
                <span class="row-title accent">Import Backup</span>
              </span>
              <input class="sr-only" type="file" accept="application/json,.json" onChange={importFile} />
            </label>
          </Cell>
        </Group>
        {stores.length > 0 && (
          <Group header="Stores" footer="Rename a store to an existing name to merge them.">
            {stores.map((s) => (
              <NameRow
                key={s.id} label={`Store name: ${s.name}`} hideLabel value={s.name}
                onSave={async (name) => toast((await rename('stores', s, name)) ? 'Stores merged' : 'Renamed')}
              />
            ))}
          </Group>
        )}
        <DeviceGroup />
      </main>
    </>
  )
}
