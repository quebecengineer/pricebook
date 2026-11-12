import { fromB64url, random } from './session'

export interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> }
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  SESSION_KEY: string
}

const APPDATA = 'https://www.googleapis.com/auth/drive.appdata'
/** drive.file only lets us read the visible pricebook.json that earlier versions of the app created. */
const SCOPE = `openid email ${APPDATA} https://www.googleapis.com/auth/drive.file`
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const REVOKE = 'https://oauth2.googleapis.com/revoke'
const DRIVE = 'https://www.googleapis.com'
const FILE = 'pricebook.json'
const FIELDS = 'id,size,modifiedTime'
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' }

/** `status` is what the app answers: 401 signs the user out, 404 means no file, anything else is a 502. */
export class GoogleError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export const authUrl = (env: Env, redirect: string, state: string, challenge: string) =>
  `${AUTH}?${new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirect,
    response_type: 'code',
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })}`

export interface Tokens {
  access_token: string
  expires_in: number
  refresh_token?: string
  id_token?: string
  scope?: string
}

async function token(env: Env, params: Record<string, string>): Promise<Tokens> {
  const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params })
  const res = await fetch(TOKEN, { method: 'POST', headers: FORM, body })
  const out = (await res.json()) as Tokens & { error?: string }
  if (!res.ok) throw new GoogleError(out.error === 'invalid_grant' ? 401 : 502, `Token endpoint: ${out.error ?? res.status}`)
  return out
}

export const exchange = (env: Env, code: string, verifier: string, redirect: string) =>
  token(env, { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirect })
export const refresh = (env: Env, refreshToken: string) => token(env, { grant_type: 'refresh_token', refresh_token: refreshToken })
export const revoke = (tokenValue: string) => fetch(REVOKE, { method: 'POST', headers: FORM, body: new URLSearchParams({ token: tokenValue }) })
export const grantsDrive = (t: Tokens) => !!t.scope?.split(' ').includes(APPDATA)

/** The ID token comes straight from Google's token endpoint over TLS, so its signature needn't be checked (OIDC Core 3.1.3.7). */
export function emailOf(idToken?: string): string {
  const payload = idToken?.split('.')[1]
  if (!payload) return ''
  const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { email?: string }
  return claims.email ?? ''
}

export interface FileInfo {
  id: string
  size: number
  modified: number
}

async function drive(accessToken: string, path: string, init: RequestInit = {}) {
  const res = await fetch(DRIVE + path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new GoogleError(res.status === 401 ? 401 : res.status === 404 ? 404 : 502, `Google Drive: ${res.status}`)
  return res
}

const toInfo = (f: { id: string; size?: string; modifiedTime: string }): FileInfo => ({
  id: f.id,
  size: Number(f.size ?? 0),
  modified: Date.parse(f.modifiedTime),
})

/** Newest pricebook.json: the hidden backup in appDataFolder, or the visible legacy file. */
async function find(accessToken: string, hidden: boolean) {
  const params = new URLSearchParams({
    q: hidden ? `name='${FILE}' and 'appDataFolder' in parents and trashed=false` : `name='${FILE}' and trashed=false`,
    spaces: hidden ? 'appDataFolder' : 'drive',
    orderBy: 'modifiedTime desc',
    pageSize: '1',
    fields: `files(${FIELDS})`,
  })
  const { files } = (await (await drive(accessToken, `/drive/v3/files?${params}`)).json()) as { files: Parameters<typeof toInfo>[0][] }
  return files[0] && toInfo(files[0])
}

export const findBackup = (accessToken: string) => find(accessToken, true)
export const findLegacy = (accessToken: string) => find(accessToken, false)
export const read = async (accessToken: string, id: string) => (await drive(accessToken, `/drive/v3/files/${id}?alt=media`)).text()

/** Replaces the hidden backup, creating it on first use. */
export async function write(accessToken: string, body: string, id?: string): Promise<FileInfo> {
  if (id) {
    const res = await drive(accessToken, `/upload/drive/v3/files/${id}?uploadType=media&fields=${FIELDS}`, {
      method: 'PATCH',
      body,
      headers: { 'Content-Type': 'application/json' },
    })
    return toInfo(await res.json())
  }
  const boundary = `pricebook-${random(12)}`
  const part = (content: string) => `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n`
  const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'], mimeType: 'application/json' })
  const res = await drive(accessToken, `/upload/drive/v3/files?uploadType=multipart&fields=${FIELDS}`, {
    method: 'POST',
    body: `${part(meta)}${part(body)}--${boundary}--`,
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
  })
  return toInfo(await res.json())
}
