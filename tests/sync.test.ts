import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const drive = vi.hoisted(() => ({ remote: undefined as string | undefined, legacy: undefined as string | undefined, uploads: 0 }))
vi.mock('../src/sync/drive', () => ({
  SignedOut: class extends Error {},
  Unavailable: class extends Error {},
  signIn: () => undefined,
  signOut: async () => undefined,
  account: async () => 'me@example.com',
  info: async () => drive.remote && { size: drive.remote.length, modified: 1 },
  download: async () => (drive.remote === undefined ? undefined : JSON.parse(drive.remote)),
  downloadLegacy: async () => (drive.legacy === undefined ? undefined : JSON.parse(drive.legacy)),
  upload: async (body: string) => {
    drive.remote = body
    drive.uploads++
    return { size: body.length, modified: Date.now() }
  },
}))

const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
})
const net = { onLine: true }
vi.stubGlobal('navigator', net)

const { updateSettings } = await import('../src/settings')
const { data, load, logPrice } = await import('../src/state')
const sync = await import('../src/sync/sync')
const { syncNow, syncStatus, syncError, isDue, probe, backupKey } = sync

const remoteJson = () => JSON.parse(drive.remote!) as Record<string, unknown>
const remoteStores = () => (remoteJson().stores as { name: string }[]).map((s) => s.name)
const snapshot = (stores: { id: string; name: string; updatedAt: number }[]) =>
  JSON.stringify({ app: 'pricebook', version: 1, items: [], stores, prices: [] })

beforeAll(async () => {
  await load()
  await probe()
  updateSettings({ driveConnected: true })
})
beforeEach(() => {
  drive.uploads = 0
  net.onLine = true
})

describe('isDue', () => {
  const day = 86_400_000
  it.each([
    ['change', 0, true],
    ['day', day - 1, false],
    ['day', day, true],
    ['week', 6 * day, false],
    ['month', 30 * day, true],
    ['manual', 365 * day, false],
  ] as const)('%s after %i ms is %s', (every, elapsed, due) => expect(isDue(every, 1000, 1000 + elapsed)).toBe(due))
  it('backs up right away when there has never been a backup, unless manual', () => {
    expect(isDue('week', undefined, 10)).toBe(false)
    expect(isDue('week', undefined, 8 * 86_400_000)).toBe(true)
    expect(isDue('manual', undefined)).toBe(false)
  })
})

describe('backup', () => {
  it('carries over the visible file earlier versions synced, then creates the hidden backup', async () => {
    drive.legacy = snapshot([{ id: 'old', name: 'Old Store', updatedAt: 1 }])
    await logPrice({ item: 'Rice', store: 'Lidl', cents: 250, qty: 1, unit: 'kg' })
    await syncNow()
    expect(syncStatus.value).toBe('idle')
    expect(data.value.stores.map((s) => s.name)).toContain('Old Store')
    expect(remoteStores().sort()).toEqual(['Lidl', 'Old Store'])
  })

  it('pulls newer remote edits and skips the upload when Drive is already ahead', async () => {
    const remote = remoteJson() as { stores: { name: string; updatedAt: number }[] }
    const lidl = remote.stores.find((s) => s.name === 'Lidl')!
    lidl.name = 'Lidl City'
    lidl.updatedAt = Date.now() + 1000
    drive.remote = JSON.stringify(remote)
    await syncNow()
    expect(data.value.stores.map((s) => s.name)).toContain('Lidl City')
    expect(drive.uploads).toBe(0)
  })

  it('refuses a corrupt backup and leaves both sides untouched', async () => {
    const good = drive.remote
    drive.remote = JSON.stringify({ app: 'pricebook', version: 1, items: 'oops', stores: [], prices: [] })
    const before = data.value
    await syncNow()
    expect(syncStatus.value).toBe('error')
    expect(syncError.value).toMatch(/items/)
    expect(data.value).toBe(before)
    expect(drive.uploads).toBe(0)
    drive.remote = good
  })

  it('reports offline without touching Drive', async () => {
    net.onLine = false
    await syncNow()
    expect(syncStatus.value).toBe('offline')
    expect(drive.uploads).toBe(0)
  })
})

describe('encrypted backup', () => {
  it('re-uploads sealed, and later backups still open it', async () => {
    await sync.setPassword('correct horse battery')
    expect(remoteJson().format).toBe('encrypted')
    expect(drive.remote).not.toContain('Lidl')
    await logPrice({ item: 'Milk', store: 'Lidl City', cents: 99, qty: 1, unit: 'L' })
    await syncNow()
    expect(syncStatus.value).toBe('idle')
    expect(remoteJson().format).toBe('encrypted')
  })

  it('locks instead of overwriting when this device lacks the key', async () => {
    const sealed = drive.remote
    backupKey.value = undefined
    await syncNow()
    expect(syncStatus.value).toBe('locked')
    expect(drive.remote).toBe(sealed)
    expect(drive.uploads).toBe(0)
  })

  it('rejects a wrong password and accepts the right one', async () => {
    await expect(sync.unlockBackup('wrong password')).rejects.toThrow(/Wrong password/)
    expect(backupKey.value).toBeUndefined()
    await sync.unlockBackup('correct horse battery')
    await syncNow()
    expect(syncStatus.value).toBe('idle')
  })

  it('turns encryption off by re-uploading plain JSON', async () => {
    await sync.removePassword()
    expect(remoteJson().format).toBeUndefined()
    expect(remoteStores()).toContain('Lidl City')
    expect(backupKey.value).toBeUndefined()
  })
})

describe('restore', () => {
  it('merges the backup in and keeps everything already on this device', async () => {
    const remote = remoteJson() as { stores: { id: string; name: string; updatedAt: number }[] }
    remote.stores.push({ id: 'from-phone', name: 'Phone Store', updatedAt: 5 })
    drive.remote = JSON.stringify(remote)
    const localBefore = data.value.stores.map((s) => s.id)
    await sync.restore()
    const ids = data.value.stores.map((s) => s.id)
    expect(ids).toContain('from-phone')
    for (const id of localBefore) expect(ids).toContain(id)
  })
})
