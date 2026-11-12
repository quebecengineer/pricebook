import { empty, upsert, type Data } from '../model'
import { isEnvelope, Locked, open, seal, type BackupKey } from './crypto'
import { download, downloadLegacy, upload } from './drive'
import { count, newer, parseSnapshot, toSnapshot } from './merge'

/** `raw` is the stored file, or undefined when the hidden folder holds no backup yet. */
interface Remote {
  data: Data
  raw?: unknown
}

/** One-time carry-over of the visible file earlier versions synced; a missing or damaged one is simply skipped. */
async function legacyData() {
  try {
    const legacy = await downloadLegacy()
    return legacy === undefined ? empty() : parseSnapshot(legacy)
  } catch (e) {
    console.warn('Skipped the old Drive file', e)
    return empty()
  }
}

/** Reads and validates the cloud copy. Anything it can't decrypt or validate throws, so nothing gets overwritten. */
async function fetchRemote(key?: BackupKey): Promise<Remote> {
  const raw = await download()
  if (raw === undefined) return { data: await legacyData() }
  if (!isEnvelope(raw)) return { data: parseSnapshot(raw), raw }
  if (!key) throw new Locked('This backup is encrypted. Enter its password.')
  return { data: parseSnapshot(JSON.parse(await open(raw, key))), raw }
}

/** The cloud copy needs rewriting when it is missing, lacks local records, or is sealed differently than wanted. */
function stale(remote: Remote, merged: Data, write?: BackupKey) {
  if (remote.raw === undefined || count(newer(merged, remote.data)) > 0) return true
  const sealedWith = isEnvelope(remote.raw) ? remote.raw.kdf.salt : undefined
  return sealedWith !== write?.salt
}

async function serialize(data: Data, write?: BackupKey) {
  const json = JSON.stringify(toSnapshot(data))
  return write ? seal(json, write) : json
}

/**
 * Pull, merge, push: saves what the cloud has that `local` lacks, then uploads only if the cloud is behind.
 * The cloud copy decides whether backups are encrypted, so a password removed on one device isn't put back by
 * another; only `rekeyTo` (a new key, or null for none) changes that. Returns the key the backup is now sealed with.
 */
export async function backupOnce(
  local: Data,
  key: BackupKey | undefined,
  save: (incoming: Data) => Promise<unknown>,
  rekeyTo?: BackupKey | null,
) {
  const remote = await fetchRemote(key)
  const follow = remote.raw === undefined || isEnvelope(remote.raw) ? key : undefined
  const write = rekeyTo === undefined ? follow : (rekeyTo ?? undefined)
  const incoming = newer(remote.data, local)
  if (count(incoming)) await save(incoming)
  const merged = upsert(local, incoming)
  const saved = stale(remote, merged, write) ? await upload(await serialize(merged, write)) : undefined
  return { saved, key: write }
}
