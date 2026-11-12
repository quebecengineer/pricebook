import { signal } from '@preact/signals'

export type Every = 'change' | 'day' | 'week' | 'month' | 'manual'

export interface Settings {
  currency: string
  lastStore: string
  /** Google Drive backup is on. Kept under its original name so earlier installs carry it over. */
  driveConnected: boolean
  /** Time of the last successful backup. */
  lastSync?: number
  lastBackupBytes?: number
  backupEvery: Every
}

const KEY = 'pricebook.settings'
const DEFAULTS: Settings = { currency: 'INR', lastStore: '', driveConnected: false, backupEvery: 'change' }

function read(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export const settings = signal(read())

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch }
  localStorage.setItem(KEY, JSON.stringify(settings.value))
}
