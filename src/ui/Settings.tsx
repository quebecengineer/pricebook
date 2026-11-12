import { backupFile, csvFile, share } from '../export'
import { installPrompt, isIOS, persisted, promptInstall, standalone } from '../install'
import { byName, live } from '../model'
import { settings, updateSettings } from '../settings'
import { absorb, data, rename } from '../state'
import { parseSnapshot } from '../sync/merge'
import { NavBar } from './Bar'
import { BackupGroup } from './Backup'
import { Cell, Group, NameRow, Row } from './kit'
import { MoveGroup } from './Move'
import { fail, toast } from './Toast'

const CURRENCIES = Intl.supportedValuesOf('currency')
const MAX_IMPORT_BYTES = 10_000_000

const shareFile = (file: File) => share(file).catch((e) => fail(e, 'Export failed'))

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
        <MoveGroup />
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
        <BackupGroup />
        <Group
          header="Export"
          footer="Send a backup file or a spreadsheet anywhere: WhatsApp, email, Files. Importing a backup merges: newer edits win and nothing else is overwritten."
        >
          <Row title="Share Backup" subtitle="JSON, can be imported again" tone="accent" onClick={() => void shareFile(backupFile(data.value))} />
          <Row title="Share Spreadsheet" subtitle="CSV for Excel or Google Sheets" tone="accent" onClick={() => void shareFile(csvFile(data.value))} />
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
