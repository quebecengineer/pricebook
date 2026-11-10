import { settings } from '../settings'

interface TokenResponse {
  access_token: string
  expires_in: number
  error?: string
}
interface OAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
    error_callback: (e: { type: string }) => void
  }): { requestAccessToken(): void }
  hasGrantedAllScopes(r: TokenResponse, scope: string): boolean
  revoke(token: string, done: () => void): void
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: OAuth2 } }
  }
}

const BUILD_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const API = 'https://www.googleapis.com'
const FILE = 'pricebook.json'
const BOUNDARY = 'pricebook-part'

const clientId = () => settings.value.googleClientId || BUILD_CLIENT_ID
export const driveReady = () => clientId() !== ''
export const isClientId = (id: string) => /^[\w-]+\.apps\.googleusercontent\.com$/.test(id)

/** Kept in memory only; Google issues short-lived tokens to browser apps. */
let token: { value: string; expires: number } | undefined
let gis: Promise<OAuth2> | undefined

function loadGis() {
  return (gis ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => (window.google ? resolve(window.google.accounts.oauth2) : reject(new Error('Google sign-in failed to load')))
    script.onerror = () => {
      gis = undefined
      script.remove()
      reject(new Error('Could not reach Google. Check your connection.'))
    }
    document.head.append(script)
  }))
}

/** Load early so the sign-in popup opens within the user's tap (Safari blocks it otherwise). */
export const preloadGis = () => loadGis().catch(() => undefined)

export const hasToken = () => !!token && token.expires - 60_000 > Date.now()

export async function signIn() {
  if (!driveReady()) throw new Error('Add your Google Client ID in Settings first')
  const oauth2 = await loadGis()
  await new Promise<void>((resolve, reject) => {
    oauth2
      .initTokenClient({
        client_id: clientId(),
        scope: SCOPE,
        callback: (r) => {
          if (r.error) return reject(new Error(r.error))
          if (!oauth2.hasGrantedAllScopes(r, SCOPE)) return reject(new Error('Drive access was not granted'))
          token = { value: r.access_token, expires: Date.now() + r.expires_in * 1000 }
          resolve()
        },
        error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in cancelled' : `Sign-in failed (${e.type})`)),
      })
      .requestAccessToken()
  })
}

export function signOut() {
  if (token) window.google?.accounts.oauth2.revoke(token.value, () => undefined)
  token = undefined
}

async function call(path: string, init: { method?: string; body?: string; type?: string } = {}) {
  if (!token) throw new Error('Not signed in')
  const headers: Record<string, string> = { Authorization: `Bearer ${token.value}` }
  if (init.type) headers['Content-Type'] = init.type
  const res = await fetch(API + path, { method: init.method, body: init.body, headers })
  if (res.status === 401) token = undefined
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`)
  return res
}

/** Newest app-created sync file, if any. */
export async function findFile() {
  const params = new URLSearchParams({
    q: `name='${FILE}' and trashed=false`,
    orderBy: 'modifiedTime desc',
    fields: 'files(id)',
    pageSize: '1',
  })
  const { files } = (await (await call(`/drive/v3/files?${params}`)).json()) as { files: { id: string }[] }
  return files[0]?.id
}

export async function download(id: string): Promise<unknown> {
  return (await call(`/drive/v3/files/${id}?alt=media`)).json()
}

export async function upload(content: string, id?: string) {
  if (id) {
    await call(`/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', body: content, type: 'application/json' })
    return
  }
  const meta = JSON.stringify({ name: FILE, mimeType: 'application/json' })
  const part = (body: string) => `--${BOUNDARY}\r\nContent-Type: application/json\r\n\r\n${body}\r\n`
  await call('/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    body: `${part(meta)}${part(content)}--${BOUNDARY}--`,
    type: `multipart/related; boundary=${BOUNDARY}`,
  })
}
