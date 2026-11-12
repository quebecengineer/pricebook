const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const b64url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const fromB64url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
export const random = (bytes: number) => b64url(crypto.getRandomValues(new Uint8Array(bytes)))
export const sha256 = async (text: string) => b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))))

const keys = new Map<string, Promise<CryptoKey>>()
/** SESSION_KEY is high-entropy random text; hashing it yields a 256-bit AES key. */
function keyOf(secret: string) {
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle.digest('SHA-256', encoder.encode(secret)).then((raw) =>
      crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']),
    )
    keys.set(secret, key)
  }
  return key
}

/** Encrypts and authenticates `value` with an expiry, so a cookie can carry it without the browser reading or forging it. */
export async function seal(value: unknown, secret: string, ttlSeconds: number) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plain = encoder.encode(JSON.stringify({ v: value, e: Date.now() + ttlSeconds * 1000 }))
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(secret), plain)
  return `${b64url(iv)}.${b64url(new Uint8Array(sealed))}`
}

/** The sealed value, or undefined when missing, tampered with, sealed with another key or expired. */
export async function unseal<T>(token: string | undefined, secret: string): Promise<T | undefined> {
  if (!token) return undefined
  try {
    const [iv, data] = token.split('.')
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv!) }, await keyOf(secret), fromB64url(data!))
    const { v, e } = JSON.parse(decoder.decode(plain)) as { v: T; e: number }
    return e > Date.now() ? v : undefined
  } catch {
    return undefined
  }
}

/** `__Host-` cookies must be Secure, on Path=/ and without Domain, so no subdomain can set or read them. */
export const cookie = (name: string, value: string, maxAge: number, sameSite: 'Strict' | 'Lax') =>
  `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}`
export const clearCookie = (name: string) => cookie(name, '', 0, 'Lax')

export function readCookie(req: Request, name: string) {
  for (const part of (req.headers.get('Cookie') ?? '').split(/;\s*/)) {
    const at = part.indexOf('=')
    if (part.slice(0, at) === name) return part.slice(at + 1)
  }
  return undefined
}
