/**
 * End-to-end encrypted backups: AES-256-GCM with a key derived from your password by PBKDF2-SHA256.
 * The password and key never leave the device, so neither Google nor the Worker can read the backup.
 */

/** OWASP Password Storage Cheat Sheet (2023) minimum for PBKDF2-HMAC-SHA256. */
const ITERATIONS = 600_000
const MAX_ITERATIONS = 10_000_000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface BackupKey {
  key: CryptoKey
  salt: string
  iterations: number
}
export interface Envelope {
  app: 'pricebook'
  format: 'encrypted'
  v: 1
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  iv: string
  data: string
}

/** The backup is encrypted and this device lacks the right key; asking for the password fixes it. */
export class Locked extends Error {}

const random = (bytes: number) => crypto.getRandomValues(new Uint8Array(bytes))
function toB64(bytes: Uint8Array) {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

export async function deriveKey(password: string, salt = toB64(random(16)), iterations = ITERATIONS): Promise<BackupKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return { key, salt, iterations }
}

const header = ({ salt, iterations }: { salt: string; iterations: number }) => ({
  app: 'pricebook' as const,
  format: 'encrypted' as const,
  v: 1 as const,
  kdf: { name: 'PBKDF2' as const, hash: 'SHA-256' as const, iterations, salt },
})
/** Binding the header as associated data means editing the salt or iterations makes decryption fail. */
const aad = (k: { salt: string; iterations: number }) => encoder.encode(JSON.stringify(header(k)))

export async function seal(json: string, k: BackupKey): Promise<string> {
  const iv = random(12)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(k) }, k.key, encoder.encode(json))
  const envelope: Envelope = { ...header(k), iv: toB64(iv), data: toB64(new Uint8Array(data)) }
  return JSON.stringify(envelope)
}

export const isEnvelope = (v: unknown): v is Envelope =>
  typeof v === 'object' && v !== null && (v as Envelope).app === 'pricebook' && (v as Envelope).format === 'encrypted'

/** Rejects envelopes whose parameters we would never write, before spending CPU on them. */
function check({ v, kdf, iv }: Envelope) {
  const sound =
    v === 1 && kdf?.name === 'PBKDF2' && kdf.hash === 'SHA-256' && Number.isInteger(kdf.iterations) &&
    kdf.iterations >= ITERATIONS && kdf.iterations <= MAX_ITERATIONS
  let sizes = false
  try {
    sizes = fromB64(kdf.salt).length === 16 && fromB64(iv).length === 12
  } catch {
    /* not base64 */
  }
  if (!sound || !sizes) throw new Error('The encrypted backup is damaged')
}

export async function open(e: Envelope, k: BackupKey): Promise<string> {
  check(e)
  if (e.kdf.salt !== k.salt || e.kdf.iterations !== k.iterations) {
    throw new Locked('The backup password was changed on another device. Enter it again.')
  }
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(e.iv), additionalData: aad(e.kdf) }, k.key, fromB64(e.data))
    return decoder.decode(plain)
  } catch {
    throw new Locked('Wrong password, or the backup was altered')
  }
}

/** Derives the key from the backup's own salt and proves it by decrypting. */
export async function unlock(e: Envelope, password: string) {
  check(e)
  const key = await deriveKey(password, e.kdf.salt, e.kdf.iterations)
  return { key, json: await open(e, key) }
}
