import {
  GoogleError, authUrl, emailOf, exchange, findBackup, findLegacy, grantsDrive, read, refresh, revoke, write,
  type Env,
} from './google'
import { clearCookie, cookie, random, readCookie, seal, sha256, unseal } from './session'

const SESSION = '__Host-pb'
const OAUTH = '__Host-pb-oauth'
const SESSION_TTL = 180 * 86_400
const OAUTH_TTL = 600
export const MAX_BYTES = 10_000_000

interface Session {
  /** Refresh token: never leaves this Worker except sealed inside the HttpOnly cookie. */
  rt: string
  email: string
  at: string
  exp: number
}
interface Pending {
  state: string
  verifier: string
}

const json = (body: unknown, status = 200, setCookie?: string) => {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  if (setCookie) headers.append('Set-Cookie', setCookie)
  return new Response(JSON.stringify(body), { status, headers })
}

/** Back into the app at `#/auth/<result>`, which tells it how sign-in went. */
function toApp(url: URL, result: string, ...cookies: string[]) {
  const headers = new Headers({ Location: `${url.origin}/#/auth/${result}`, 'Cache-Control': 'no-store' })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(null, { status: 302, headers })
}

const redirectOf = (url: URL) => `${url.origin}/api/auth/callback`
const sessionCookie = async (env: Env, s: Session) => cookie(SESSION, await seal(s, env.SESSION_KEY, SESSION_TTL), SESSION_TTL, 'Strict')

async function login(env: Env, url: URL) {
  const pending: Pending = { state: random(16), verifier: random(32) }
  const headers = new Headers({
    Location: authUrl(env, redirectOf(url), pending.state, await sha256(pending.verifier)),
    'Cache-Control': 'no-store',
  })
  headers.append('Set-Cookie', cookie(OAUTH, await seal(pending, env.SESSION_KEY, OAUTH_TTL), OAUTH_TTL, 'Lax'))
  return new Response(null, { status: 302, headers })
}

async function callback(req: Request, env: Env, url: URL) {
  const pending = await unseal<Pending>(readCookie(req, OAUTH), env.SESSION_KEY)
  const used = clearCookie(OAUTH)
  if (!pending || url.searchParams.get('state') !== pending.state) return toApp(url, 'failed', used)
  const code = url.searchParams.get('code')
  if (!code) return toApp(url, 'cancelled', used)
  try {
    const t = await exchange(env, code, pending.verifier, redirectOf(url))
    if (!t.refresh_token || !grantsDrive(t)) {
      await revoke(t.access_token)
      return toApp(url, 'denied', used)
    }
    const s: Session = { rt: t.refresh_token, email: emailOf(t.id_token), at: t.access_token, exp: Date.now() + t.expires_in * 1000 }
    return toApp(url, 'ok', used, await sessionCookie(env, s))
  } catch (e) {
    console.error(e)
    return toApp(url, 'failed', used)
  }
}

/**
 * CSRF and cross-site defence on top of SameSite cookies: a custom header (forces a CORS preflight cross-origin),
 * Fetch Metadata, and an exact Origin match on anything that changes state.
 */
function trusted(req: Request, url: URL) {
  if (req.headers.get('X-Pricebook') !== '1') return false
  const site = req.headers.get('Sec-Fetch-Site')
  if (site && site !== 'same-origin') return false
  const origin = req.headers.get('Origin')
  return origin ? origin === url.origin : req.method === 'GET'
}

/** Refreshes the access token a minute before it expires and re-seals the cookie, which also renews its lifetime. */
async function withToken(env: Env, s: Session, use: (accessToken: string) => Promise<Response>) {
  let renewed: string | undefined
  if (s.exp - 60_000 < Date.now()) {
    const t = await refresh(env, s.rt)
    s = { ...s, at: t.access_token, exp: Date.now() + t.expires_in * 1000 }
    renewed = await sessionCookie(env, s)
  }
  const res = await use(s.at)
  if (renewed) res.headers.append('Set-Cookie', renewed)
  return res
}

const isBackup = (text: string) => {
  try {
    const v = JSON.parse(text) as { app?: unknown }
    return typeof v === 'object' && v !== null && v.app === 'pricebook'
  } catch {
    return false
  }
}

async function readBody(req: Request) {
  if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BYTES) return undefined
  const bytes = await req.arrayBuffer()
  return bytes.byteLength > MAX_BYTES ? undefined : new TextDecoder().decode(bytes)
}

const file = (text: string) => new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const missing = () => json({ error: 'not-found' }, 404)

async function drive(req: Request, env: Env, s: Session, path: string) {
  return withToken(env, s, async (at) => {
    if (path === '/api/backup' && req.method === 'GET') {
      const f = await findBackup(at)
      return f ? json(f) : missing()
    }
    if (path === '/api/backup/content' && req.method === 'GET') {
      const f = await findBackup(at)
      return f ? file(await read(at, f.id)) : missing()
    }
    if (path === '/api/backup' && req.method === 'PUT') {
      const body = await readBody(req)
      if (body === undefined) return json({ error: 'too-large' }, 413)
      if (!isBackup(body)) return json({ error: 'not-a-backup' }, 400)
      return json(await write(at, body, (await findBackup(at))?.id))
    }
    if (path === '/api/legacy' && req.method === 'GET') {
      const f = await findLegacy(at)
      return f ? file(await read(at, f.id)) : missing()
    }
    return missing()
  })
}

async function route(req: Request, env: Env, url: URL) {
  const path = url.pathname
  if (path === '/api/auth/login' && req.method === 'GET') return login(env, url)
  if (path === '/api/auth/callback' && req.method === 'GET') return callback(req, env, url)
  if (!trusted(req, url)) return json({ error: 'forbidden' }, 403)
  const s = await unseal<Session>(readCookie(req, SESSION), env.SESSION_KEY)
  if (!s) return json({ error: 'signed-out' }, 401, clearCookie(SESSION))
  if (path === '/api/session' && req.method === 'GET') return json({ email: s.email })
  if (path === '/api/session' && req.method === 'DELETE') {
    await revoke(s.rt).catch(console.error)
    return json({}, 200, clearCookie(SESSION))
  }
  return drive(req, env, s, path)
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_KEY) {
    return new Response('Google Drive backup is not set up', { status: 404 })
  }
  try {
    return await route(req, env, url)
  } catch (e) {
    if (e instanceof GoogleError && e.status === 401) return json({ error: 'signed-out' }, 401, clearCookie(SESSION))
    if (e instanceof GoogleError && e.status === 404) return missing()
    console.error(e)
    return json({ error: 'upstream' }, 502)
  }
}
