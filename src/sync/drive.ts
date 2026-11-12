/**
 * Same-origin client for the Worker in `worker/`. Google tokens never reach this code: the Worker keeps them
 * sealed in an HttpOnly cookie and only exposes the one hidden backup file.
 */

export class SignedOut extends Error {
  constructor() {
    super('Sign in to Google Drive again')
  }
}
/** The backend isn't there: an old address, or local development without the Worker. */
export class Unavailable extends Error {
  constructor() {
    super('Google Drive backup is not available here')
  }
}

export interface BackupInfo {
  size: number
  modified: number
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api/${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { ...init.headers, 'X-Pricebook': '1' },
  })
  if (res.status === 401) throw new SignedOut()
  if (!res.headers.get('Content-Type')?.startsWith('application/json')) throw new Unavailable()
  return res
}

async function optional(path: string) {
  const res = await api(path)
  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`)
  return res.json() as Promise<unknown>
}

/** Starts Google sign-in; the Worker sends the browser back to `#/auth/<result>`. */
export const signIn = () => location.assign('/api/auth/login')

export async function account(): Promise<string> {
  return ((await (await api('session')).json()) as { email: string }).email
}

export async function signOut() {
  await api('session', { method: 'DELETE' })
}

export const info = () => optional('backup') as Promise<BackupInfo | undefined>
export const download = () => optional('backup/content')
/** The visible pricebook.json that earlier versions synced, if this Google project created one. */
export const downloadLegacy = () => optional('legacy')

export async function upload(body: string): Promise<BackupInfo> {
  const res = await api('backup', { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`)
  return res.json() as Promise<BackupInfo>
}
