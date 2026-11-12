import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { loadAll, loadKey, save } from './db'
import { BACKGROUND_TAG } from './sync/background'
import { backupOnce } from './sync/backup'

interface ExtendableEvent extends Event {
  waitUntil(work: Promise<unknown>): void
}
interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string
}
declare const self: {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[]
  skipWaiting(): Promise<void>
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void
  addEventListener(type: 'periodicsync', listener: (e: PeriodicSyncEvent) => void): void
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
/** The API, including the Google sign-in redirects, must reach the network instead of the cached app shell. */
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

self.addEventListener('message', (e) => {
  if ((e.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting()
})

/** Chromium installed apps only: back up while the app is closed. Failures wait for the next run or app launch. */
async function backUp() {
  const [local, key] = await Promise.all([loadAll(), loadKey()])
  await backupOnce(local, key, save)
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === BACKGROUND_TAG) e.waitUntil(backUp().catch(console.error))
})
