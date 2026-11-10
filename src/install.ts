import { signal } from '@preact/signals'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
}

export const installPrompt = signal<InstallPrompt | null>(null)
export const standalone = signal(
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
)
/** Whether the browser promised not to evict our storage. */
export const persisted = signal(false)
export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

export function watchInstall() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt.value = e as InstallPrompt
  })
  addEventListener('appinstalled', () => {
    installPrompt.value = null
    standalone.value = true
  })
  navigator.storage?.persist?.().then((granted) => (persisted.value = granted), () => undefined)
}

export async function promptInstall() {
  await installPrompt.value?.prompt()
  installPrompt.value = null
}
