import { useEffect, useState } from 'preact/hooks'
import { back } from '../router'
import { peekBackup, restore } from '../sync/sync'
import { formatBytes, formatDateTime } from '../units'
import { Cell, Group, Row, SecretField, nextOnEnter } from './kit'
import { Sheet } from './Sheet'
import { fail, toast } from './Toast'

type Found = Awaited<ReturnType<typeof peekBackup>>

/** WhatsApp's "Backup found" step on a new device: restore merges into this device and deletes nothing. */
export function RestoreSheet() {
  const [found, setFound] = useState<Found | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    peekBackup().then(setFound, (e) => {
      fail(e, 'Could not check Google Drive')
      back()
    })
  }, [])

  const ready = !!found && !busy && (!found.encrypted || password.length > 0)
  async function submit(e: Event) {
    e.preventDefault()
    if (!ready || !found) return
    setBusy(true)
    try {
      const items = await restore(found.encrypted ? password : undefined)
      toast(items === 1 ? 'Restored. 1 item on this device' : `Restored. ${items} items on this device`, { tone: 'good' })
      back()
    } catch (err) {
      fail(err, 'Restore failed')
    } finally {
      setBusy(false)
    }
  }

  const action = (
    <button type="submit" form="restore-form" class="sheet-btn strong" disabled={!ready}>
      Restore
    </button>
  )
  return (
    <Sheet title="Restore Backup" onClose={back} trailing={action}>
      {found === null ? (
        <p class="verdict">Looking in Google Drive…</p>
      ) : !found ? (
        <Group footer="This Google account has no Pricebook backup yet. Your next backup creates one.">
          <Row title="No Backup Found" />
        </Group>
      ) : (
        <>
          <form id="restore-form" onSubmit={submit} onKeyDown={nextOnEnter} noValidate>
            <Group header="Backup Found" footer="Restoring adds the backup's prices to this device. Nothing here is deleted.">
              <Row title="Last Backup" value={formatDateTime(found.modified)} />
              <Row title="Size" value={formatBytes(found.size)} />
              {found.encrypted && (
                <Cell>
                  <SecretField label="Password" autoComplete="current-password" value={password} onValue={setPassword} autoFocus />
                </Cell>
              )}
            </Group>
          </form>
          <Group footer="Skip keeps backup off on this device and leaves your Drive backup untouched.">
            <Row title="Skip" onClick={back} />
          </Group>
        </>
      )}
    </Sheet>
  )
}
