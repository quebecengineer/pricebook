import { signal } from '@preact/signals'

export interface Settings {
  currency: string
  lastStore: string
  driveConnected: boolean
  lastSync?: number
}

const KEY = 'pricebook.settings'
const DEFAULTS: Settings = { currency: 'INR', lastStore: '', driveConnected: false }

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
