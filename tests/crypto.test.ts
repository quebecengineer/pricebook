import { describe, expect, it } from 'vitest'
import { deriveKey, isEnvelope, Locked, open, seal, unlock, type Envelope } from '../src/sync/crypto'

const key = await deriveKey('correct horse battery')
const json = JSON.stringify({ app: 'pricebook', version: 1, items: [], stores: [{ name: 'Lidl' }], prices: [] })
const envelope = async () => JSON.parse(await seal(json, key)) as Envelope

describe('crypto', () => {
  it('round-trips and hides the content', async () => {
    const sealed = await seal(json, key)
    expect(sealed).not.toContain('Lidl')
    expect(isEnvelope(JSON.parse(sealed))).toBe(true)
    expect(await open(JSON.parse(sealed), key)).toBe(json)
  })

  it('uses 600,000 PBKDF2 iterations, a 16-byte salt and a fresh 12-byte IV each time', async () => {
    const [a, b] = [await envelope(), await envelope()]
    expect(a.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000 })
    expect(atob(a.kdf.salt)).toHaveLength(16)
    expect(atob(a.iv)).toHaveLength(12)
    expect(a.iv).not.toBe(b.iv)
  })

  it('unlocks with the password using the salt stored in the backup', async () => {
    const { key: again, json: plain } = await unlock(await envelope(), 'correct horse battery')
    expect(plain).toBe(json)
    expect(again.salt).toBe(key.salt)
  })

  it('rejects a wrong password', async () => {
    await expect(unlock(await envelope(), 'wrong password')).rejects.toBeInstanceOf(Locked)
  })

  it('rejects edited ciphertext', async () => {
    const e = await envelope()
    const bytes = Uint8Array.from(atob(e.data), (c) => c.charCodeAt(0))
    bytes[0]! ^= 1
    await expect(open({ ...e, data: btoa(String.fromCharCode(...bytes)) }, key)).rejects.toBeInstanceOf(Locked)
  })

  it('rejects an edited header, which is bound as associated data', async () => {
    const e = await envelope()
    await expect(open({ ...e, kdf: { ...e.kdf, iterations: 700_000 } }, { ...key, iterations: 700_000 })).rejects.toBeInstanceOf(Locked)
  })

  it('refuses weakened or malformed parameters before deriving anything', async () => {
    const e = await envelope()
    await expect(unlock({ ...e, kdf: { ...e.kdf, iterations: 1000 } }, 'x')).rejects.toThrow(/damaged/)
    await expect(unlock({ ...e, iv: 'AAAA' }, 'x')).rejects.toThrow(/damaged/)
  })

  it('asks for the password again when another device changed it', async () => {
    const other = await deriveKey('a different password')
    await expect(open(JSON.parse(await seal(json, other)), key)).rejects.toThrow(/changed on another device/)
  })
})
