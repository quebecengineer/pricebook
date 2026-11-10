import type { Data, Kind } from '../model'
import { remove } from '../state'
import { fail, toast } from './Toast'

/** Deletes with an Undo banner; resolves false if the delete failed. */
export async function removeWithUndo<K extends Kind>(kind: K, r: Data[K][number], what: string) {
  try {
    const undo = await remove(kind, r)
    toast(`${what} deleted`, { action: { label: 'Undo', run: () => void undo().catch(fail) } })
    return true
  } catch (e) {
    fail(e)
    return false
  }
}
