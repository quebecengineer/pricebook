export const BACKGROUND_TAG = 'pricebook-backup'
const DAY = 86_400_000

interface PeriodicSync {
  register(tag: string, options: { minInterval: number }): Promise<void>
  unregister(tag: string): Promise<void>
}

/**
 * Periodic Background Sync (Chromium, installed app, granted by the browser based on engagement): asks for a
 * background backup about as often as the schedule. Elsewhere this does nothing and backups run while the app is open.
 */
export async function scheduleBackground(on: boolean, interval: number) {
  const reg = await navigator.serviceWorker?.ready
  const periodic = (reg as (ServiceWorkerRegistration & { periodicSync?: PeriodicSync }) | undefined)?.periodicSync
  if (!periodic) return
  if (on && Number.isFinite(interval)) await periodic.register(BACKGROUND_TAG, { minInterval: Math.max(interval, DAY) })
  else await periodic.unregister(BACKGROUND_TAG)
}
