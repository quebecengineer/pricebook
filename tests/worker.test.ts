import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handle, MAX_BYTES } from '../worker/routes'
import { b64url, readCookie, seal, sha256, unseal } from '../worker/session'

const KEY = 'test-session-key-with-plenty-of-entropy-000'
const env = {
  ASSETS: { fetch: async () => new Response('asset') },
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  SESSION_KEY: KEY,
}
const ORIGIN = 'https://app.test'
const APPDATA = 'https://www.googleapis.com/auth/drive.appdata'

type Call = { url: string; init?: RequestInit }
let calls: Call[]
let google: (url: string, init?: RequestInit) => Response

beforeEach(() => {
  calls = []
  google = () => new Response('{}')
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return google(String(input), init)
  })
})
afterEach(() => vi.unstubAllGlobals())

const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const idToken = (claims: object) => `x.${b64url(new TextEncoder().encode(JSON.stringify(claims)))}.y`
const sessionCookie = async (exp = Date.now() + 3_600_000) =>
  `__Host-pb=${await seal({ rt: 'refresh', email: 'me@example.com', at: 'access', exp }, KEY, 3600)}`

function call(path: string, init: RequestInit & { cookie?: string; trusted?: boolean } = {}) {
  const headers = new Headers(init.headers)
  if (init.trusted !== false) headers.set('X-Pricebook', '1')
  if (init.cookie) headers.set('Cookie', init.cookie)
  if (init.method && init.method !== 'GET' && !headers.has('Origin')) headers.set('Origin', ORIGIN)
  return handle(new Request(ORIGIN + path, { ...init, headers }), env)
}
const setCookies = (res: Response) => res.headers.getSetCookie()

describe('sealed cookies', () => {
  it('round-trips and rejects tampering, other keys and expiry', async () => {
    const token = await seal({ a: 1 }, KEY, 60)
    expect(await unseal(token, KEY)).toEqual({ a: 1 })
    expect(await unseal(`${token.slice(0, -2)}AA`, KEY)).toBeUndefined()
    expect(await unseal(token, 'another-key')).toBeUndefined()
    expect(await unseal(await seal({ a: 1 }, KEY, -1), KEY)).toBeUndefined()
    expect(await unseal('garbage', KEY)).toBeUndefined()
  })
})

describe('routing', () => {
  it('serves the app from static assets', async () => expect(await (await call('/')).text()).toBe('asset'))
  it('reports backup as not set up until the Google secrets exist', async () => {
    const res = await handle(new Request(`${ORIGIN}/api/auth/login`), { ...env, GOOGLE_CLIENT_SECRET: '' })
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).not.toMatch(/json/)
    expect(calls).toHaveLength(0)
  })
})

describe('sign-in', () => {
  it('redirects to Google with PKCE S256 and a sealed state cookie', async () => {
    const res = await call('/api/auth/login', { trusted: false })
    const location = new URL(res.headers.get('Location')!)
    const pending = await unseal<{ state: string; verifier: string }>(
      readCookie(new Request(ORIGIN, { headers: { Cookie: setCookies(res)[0]!.split(';')[0]! } }), '__Host-pb-oauth'),
      KEY,
    )
    expect(res.status).toBe(302)
    expect(location.origin).toBe('https://accounts.google.com')
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    expect(location.searchParams.get('code_challenge')).toBe(await sha256(pending!.verifier))
    expect(location.searchParams.get('state')).toBe(pending!.state)
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback`)
    expect(location.searchParams.get('scope')).toContain(APPDATA)
    expect(setCookies(res)[0]).toMatch(/^__Host-pb-oauth=.+; Path=\/; Secure; HttpOnly; SameSite=Lax/)
  })

  const pendingCookie = async () => `__Host-pb-oauth=${await seal({ state: 'abc', verifier: 'v'.repeat(43) }, KEY, 600)}`

  it('rejects a callback whose state does not match', async () => {
    const res = await call('/api/auth/callback?state=evil&code=c', { cookie: await pendingCookie(), trusted: false })
    expect(res.headers.get('Location')).toBe(`${ORIGIN}/#/auth/failed`)
    expect(setCookies(res).some((c) => c.startsWith('__Host-pb='))).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('exchanges the code with the verifier and sets a Strict HttpOnly session', async () => {
    google = () =>
      jsonRes({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: `openid ${APPDATA}`, id_token: idToken({ email: 'me@example.com' }) })
    const res = await call('/api/auth/callback?state=abc&code=the-code', { cookie: await pendingCookie(), trusted: false })
    const body = new URLSearchParams(String(calls[0]!.init!.body))
    expect(body.get('code_verifier')).toBe('v'.repeat(43))
    expect(body.get('client_secret')).toBe('client-secret')
    expect(res.headers.get('Location')).toBe(`${ORIGIN}/#/auth/ok`)
    expect(setCookies(res).find((c) => c.startsWith('__Host-pb='))).toMatch(/Secure; HttpOnly; SameSite=Strict/)
  })

  it('revokes and reports when Drive access was not granted', async () => {
    google = (url) => (url.includes('revoke') ? new Response('') : jsonRes({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'openid email' }))
    const res = await call('/api/auth/callback?state=abc&code=c', { cookie: await pendingCookie(), trusted: false })
    expect(res.headers.get('Location')).toBe(`${ORIGIN}/#/auth/denied`)
    expect(calls.some((c) => c.url.includes('revoke'))).toBe(true)
  })
})

describe('API guards', () => {
  it('requires the custom header', async () => expect((await call('/api/session', { trusted: false })).status).toBe(403))
  it('rejects cross-origin writes', async () => {
    const res = await call('/api/backup', { method: 'PUT', body: '{}', headers: { Origin: 'https://evil.test' }, cookie: await sessionCookie() })
    expect(res.status).toBe(403)
  })
  it('rejects cross-site fetch metadata', async () => {
    expect((await call('/api/session', { headers: { 'Sec-Fetch-Site': 'cross-site' }, cookie: await sessionCookie() })).status).toBe(403)
  })
  it('answers 401 without a session', async () => expect((await call('/api/session')).status).toBe(401))
  it('returns the signed-in account', async () => {
    expect(await (await call('/api/session', { cookie: await sessionCookie() })).json()).toEqual({ email: 'me@example.com' })
  })
})

describe('tokens', () => {
  it('refreshes an expiring access token and renews the cookie', async () => {
    google = (url) => (url.includes('oauth2.googleapis.com/token') ? jsonRes({ access_token: 'fresh', expires_in: 3600 }) : jsonRes({ files: [] }))
    const res = await call('/api/backup', { cookie: await sessionCookie(Date.now()) })
    expect(res.status).toBe(404)
    expect(calls[1]!.init!.headers).toMatchObject({ Authorization: 'Bearer fresh' })
    expect(setCookies(res).some((c) => c.startsWith('__Host-pb='))).toBe(true)
  })
  it('signs out when Google revoked the grant', async () => {
    google = () => jsonRes({ error: 'invalid_grant' }, 400)
    const res = await call('/api/backup', { cookie: await sessionCookie(Date.now()) })
    expect(res.status).toBe(401)
    expect(setCookies(res)[0]).toMatch(/^__Host-pb=; .*Max-Age=0/)
  })
  it('revokes at Google on sign-out', async () => {
    const res = await call('/api/session', { method: 'DELETE', cookie: await sessionCookie() })
    expect(calls[0]!.url).toContain('oauth2.googleapis.com/revoke')
    expect(setCookies(res)[0]).toMatch(/Max-Age=0/)
  })
})

describe('backup file', () => {
  it('only ever looks in the hidden app folder', async () => {
    google = () => jsonRes({ files: [{ id: 'f1', size: '42', modifiedTime: '2026-11-12T10:00:00Z' }] })
    const res = await call('/api/backup', { cookie: await sessionCookie() })
    const query = new URL(calls[0]!.url).searchParams
    expect(query.get('spaces')).toBe('appDataFolder')
    expect(query.get('q')).toContain(`'appDataFolder' in parents`)
    expect(await res.json()).toEqual({ id: 'f1', size: 42, modified: Date.parse('2026-11-12T10:00:00Z') })
  })
  it('creates the first backup inside appDataFolder', async () => {
    google = (url) =>
      url.includes('/upload/') ? jsonRes({ id: 'new', size: '30', modifiedTime: '2026-11-12T10:00:00Z' }) : jsonRes({ files: [] })
    const res = await call('/api/backup', { method: 'PUT', body: '{"app":"pricebook"}', cookie: await sessionCookie() })
    expect(res.status).toBe(200)
    expect(String(calls[1]!.init!.body)).toContain('"parents":["appDataFolder"]')
  })
  it('refuses bodies that are not Pricebook backups or are too large', async () => {
    const cookie = await sessionCookie()
    expect((await call('/api/backup', { method: 'PUT', body: '{"app":"other"}', cookie })).status).toBe(400)
    expect((await call('/api/backup', { method: 'PUT', body: 'x'.repeat(MAX_BYTES + 1), cookie })).status).toBe(413)
    expect(calls).toHaveLength(0)
  })
})
