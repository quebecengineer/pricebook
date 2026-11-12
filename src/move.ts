/**
 * Browsers keep each address's data separate, so moving the app to a new address would leave your prices
 * behind. The old copy opens the new one and hands its data over with postMessage, checking the exact origin on
 * both sides. The new copy validates and merges it; the old copy keeps its data untouched.
 */
import type { Data } from './model'
import { parseSnapshot, toSnapshot } from './sync/merge'

const HOME = import.meta.env.VITE_APP_ORIGIN ?? ''
const LEGACY = import.meta.env.VITE_LEGACY_ORIGIN ?? ''
const TIMEOUT_MS = 120_000

/** This copy runs at the old address and should send people (and their data) to the new one. */
export const movedTo = HOME && location.origin !== HOME ? HOME : ''

type Message = { type: 'ready' } | { type: 'data'; snapshot: unknown } | { type: 'done'; count: number } | { type: 'failed'; error: string }
const isMessage = (v: unknown): v is Message => typeof v === 'object' && v !== null && typeof (v as Message).type === 'string'

/** Old address: opens the new one and sends it everything, resolving with how many records it took in. */
export function sendData(data: Data): Promise<number> {
  const target = window.open(`${movedTo}/#/move`, '_blank')
  if (!target) return Promise.reject(new Error('Allow pop-ups for this site, or use Share Backup and import it there'))
  return new Promise((resolve, reject) => {
    const finish = (outcome: () => void) => {
      removeEventListener('message', onMessage)
      clearTimeout(timer)
      outcome()
    }
    const timer = setTimeout(() => finish(() => reject(new Error('The new address did not answer'))), TIMEOUT_MS)
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== movedTo || e.source !== target || !isMessage(e.data)) return
      const msg = e.data
      if (msg.type === 'ready') target.postMessage({ type: 'data', snapshot: toSnapshot(data) } satisfies Message, movedTo)
      if (msg.type === 'done') finish(() => resolve(msg.count))
      if (msg.type === 'failed') finish(() => reject(new Error(msg.error)))
    }
    addEventListener('message', onMessage)
  })
}

/** New address, at `#/move`: asks the old copy for its data and merges it in with `take`. */
export function receiveData(take: (data: Data) => Promise<number>): Promise<number> {
  const source = window.opener as Window | null
  if (!LEGACY || !source) return Promise.reject(new Error('Open this from Pricebook at its old address'))
  const reply = (msg: Message) => source.postMessage(msg, LEGACY)
  return new Promise((resolve, reject) => {
    async function onMessage(e: MessageEvent) {
      if (e.origin !== LEGACY || e.source !== source || !isMessage(e.data) || e.data.type !== 'data') return
      removeEventListener('message', onMessage)
      try {
        const count = await take(parseSnapshot(e.data.snapshot))
        reply({ type: 'done', count })
        resolve(count)
      } catch (err) {
        reply({ type: 'failed', error: err instanceof Error ? err.message : String(err) })
        reject(err)
      }
    }
    addEventListener('message', onMessage)
    reply({ type: 'ready' })
  })
}
