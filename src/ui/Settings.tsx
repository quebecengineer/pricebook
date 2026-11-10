import { useEffect } from 'preact/hooks'
import { byName, live } from '../model'
import { settings, updateSettings } from '../settings'
import { absorb, data, rename } from '../state'
import { driveEnabled, preloadGis } from '../sync/drive'
import { parseSnapshot, toSnapshot } from '../sync/merge'
import { connect, disconnect, syncStatus } from '../sync/sync'
import { Bar } from './Bar'
import { NameField } from './NameField'
import { fail, toast } from './Toast'

const CURRENCIES = Intl.supportedValuesOf('currency')
const MAX_IMPORT_BYTES = 10_000_000

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

export function Settings() {
  return (
    <>
      <Bar title="Settings" hasBack />
      <main>
        <section>
          <h2>Currency</h2>
          <select
            aria-label="Currency"
            value={settings.value.currency}
            onChange={(e) => updateSettings({ currency: e.currentTarget.value })}
          >
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </section>
        <DriveSection />
        <section>
          <h2>Backup file</h2>
          <p class="hint">Importing merges: newer edits win and nothing else is overwritten.</p>
          <div class="fields">
            <button onClick={exportFile}>Export</button>
            <label class="button">
              Import
              <input class="sr-only" type="file" accept="application/json,.json" onChange={importFile} />
            </label>
          </div>
        </section>
        <section>
          <h2>Stores</h2>
          <p class="hint">Rename a store to an existing name to merge them.</p>
          {live(data.value.stores).sort(byName).map((s) => (
            <NameField
              key={s.id}
              label={`Rename ${s.name}`}
              value={s.name}
              onSave={async (name) => toast((await rename('stores', s, name)) ? 'Stores merged' : 'Renamed')}
            />
          ))}
        </section>
      </main>
    </>
  )
}

function DriveSection() {
  const { driveConnected, lastSync } = settings.value
  useEffect(() => {
    if (driveEnabled) void preloadGis()
  }, [])
  const sync = () => connect().catch((e) => fail(e, 'Sync failed'))
  return (
    <section>
      <h2>Google Drive sync</h2>
      {!driveEnabled ? (
        <p class="hint">Not configured in this build (missing Google client ID).</p>
      ) : driveConnected ? (
        <>
          <p class="hint">
            Syncing <code>pricebook.json</code> in your Drive. Last synced:{' '}
            {lastSync ? new Date(lastSync).toLocaleString() : 'never'}.
          </p>
          <div class="fields">
            <button onClick={sync} disabled={syncStatus.value === 'syncing'}>
              Sync now
            </button>
            <button onClick={disconnect}>Disconnect</button>
          </div>
        </>
      ) : (
        <>
          <p class="hint">Keeps one file in your Drive so your devices share prices. The app can only see files it created.</p>
          <button class="primary" onClick={sync}>
            Connect Google Drive
          </button>
        </>
      )}
    </section>
  )
}
