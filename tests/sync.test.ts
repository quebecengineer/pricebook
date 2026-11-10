import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const drive = vi.hoisted(() => ({ file: undefined as string | undefined, uploads: 0 }))
vi.mock('../src/sync/drive', () => ({
  hasToken: () => true,
  preloadGis: async () => undefined,
  signIn: async () => undefined,
  signOut: () => undefined,
  findFile: async () => (drive.file === undefined ? undefined : 'file-1'),
  download: async () => JSON.parse(drive.file!),
  upload: async (content: string) => {
    drive.file = content
    drive.uploads++
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
const { syncNow, syncStatus, syncError } = await import('../src/sync/sync')

const remoteStores = () => JSON.parse(drive.file!).stores as { name: string }[]

beforeAll(async () => {
  await load()
  updateSettings({ driveConnected: true })
})
beforeEach(() => {
  drive.uploads = 0
  net.onLine = true
})

describe('sync', () => {
  it('creates the Drive file from local data on first sync', async () => {
    await logPrice({ item: 'Rice', store: 'Lidl', cents: 250, qty: 1, unit: 'kg' })
    await syncNow()
    expect(syncStatus.value).toBe('idle')
    expect(remoteStores().map((s) => s.name)).toEqual(['Lidl'])
  })

  it('pulls newer remote edits and skips the upload when Drive is already ahead', async () => {
    const snapshot = JSON.parse(drive.file!)
    snapshot.stores[0].name = 'Lidl City'
    snapshot.stores[0].updatedAt = Date.now() + 1000
    drive.file = JSON.stringify(snapshot)
    await syncNow()
    expect(data.value.stores[0]?.name).toBe('Lidl City')
    expect(drive.uploads).toBe(0)
  })

  it('refuses a corrupt Drive file and leaves both sides untouched', async () => {
    drive.file = JSON.stringify({ app: 'pricebook', version: 1, items: 'oops', stores: [], prices: [] })
    const before = data.value
    await syncNow()
    expect(syncStatus.value).toBe('error')
    expect(syncError.value).toMatch(/items/)
    expect(data.value).toBe(before)
    expect(drive.uploads).toBe(0)
  })

  it('reports offline without touching Drive', async () => {
    net.onLine = false
    await syncNow()
    expect(syncStatus.value).toBe('offline')
    expect(drive.uploads).toBe(0)
  })
})
