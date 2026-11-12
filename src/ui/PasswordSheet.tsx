import { useState } from 'preact/hooks'
import { back } from '../router'
import { backupKey, removePassword, setPassword, syncNow, syncStatus, unlockBackup } from '../sync/sync'
import { Cell, Group, Row, SecretField } from './kit'
import { Sheet } from './Sheet'
import { fail, toast } from './Toast'

const MIN_LENGTH = 8
const WARNING = "If you forget this password, the backup can't be restored. Not even Google or Pricebook can recover it."

/** Unlocks an encrypted backup on this device, or turns encryption on, changes its password, or turns it off. */
export function PasswordSheet() {
  const locked = syncStatus.value === 'locked'
  const encrypted = !!backupKey.value
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [busy, setBusy] = useState(false)

  const problem = locked
    ? ''
    : first.length < MIN_LENGTH
      ? `Use at least ${MIN_LENGTH} characters.`
      : first !== second
        ? "The passwords don't match."
        : ''
  const ready = !busy && first.length > 0 && !problem

  async function act(task: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await task()
      toast(done, { tone: 'good' })
      back()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }
  const submit = (e: Event) => {
    e.preventDefault()
    if (!ready) return
    if (locked) void act(() => unlockBackup(first).then(syncNow), 'Backup unlocked')
    else void act(() => setPassword(first), encrypted ? 'Password changed' : 'Backup encrypted')
  }

  const title = locked ? 'Backup Password' : encrypted ? 'Change Password' : 'Encrypt Backup'
  const action = (
    <button type="submit" form="password-form" class="sheet-btn strong" disabled={!ready}>
      {locked ? 'Unlock' : 'Save'}
    </button>
  )
  return (
    <Sheet title={title} onClose={back} trailing={action}>
      <form id="password-form" onSubmit={submit} noValidate>
        <Group
          footer={locked ? 'Your backup was encrypted on another device. Enter the same password here.' : WARNING}
        >
          <Cell>
            <SecretField label="Password" autoComplete={locked ? 'current-password' : 'new-password'} value={first} onValue={setFirst} autoFocus />
          </Cell>
          {!locked && (
            <Cell>
              <SecretField label="Confirm" autoComplete="new-password" value={second} onValue={setSecond} />
            </Cell>
          )}
        </Group>
        <p class="verdict" aria-live="polite">{second && problem}</p>
      </form>
      {encrypted && !locked && (
        <Group footer="Your backup will be stored unencrypted again.">
          <Row title="Turn Off Encryption" tone="danger" onClick={() => void act(removePassword, 'Encryption turned off')} />
        </Group>
      )}
    </Sheet>
  )
}
