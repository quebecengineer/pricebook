import { useEffect, useState } from 'preact/hooks'
import { movedTo, receiveData, sendData } from '../move'
import { replace } from '../router'
import { absorb, data } from '../state'
import { NavBar } from './Bar'
import { Icon } from './Icon'
import { Empty, Group, Row } from './kit'
import { fail, toast } from './Toast'

/** Old address only: offers to copy everything to the new one. Nothing here is deleted. */
export function MoveGroup() {
  if (!movedTo) return null
  const move = () =>
    void sendData(data.value).then(
      (n) => toast(`Copied ${n} records to the new address`, { tone: 'good' }),
      (e) => fail(e, 'Move failed'),
    )
  return (
    <Group
      header="Pricebook Has Moved"
      footer={
        <>
          Copy your prices to <a href={movedTo} target="_blank" rel="noopener">{new URL(movedTo).host}</a>, then install the app
          from there. Your prices also stay here.
        </>
      }
    >
      <Row title="Move My Prices" tone="accent" onClick={move} />
    </Group>
  )
}

/** New address, opened by the old one at `#/move`: receives, validates and merges its data. */
export function MovePage() {
  const [result, setResult] = useState<number | Error | null>(null)
  useEffect(() => {
    receiveData(async (incoming) => (await absorb(incoming, true)).pulled).then(setResult, (e: Error) => setResult(e))
  }, [])
  const open = <button class="toolbar-action" onClick={() => replace('#/')}><Icon name="chevron-right" /> Open Pricebook</button>
  return (
    <>
      <NavBar title="Move Prices" />
      <main>
        {result === null ? (
          <Empty icon="refresh" title="Receiving Your Prices…" text="Keep both tabs open for a moment." />
        ) : result instanceof Error ? (
          <Empty icon="alert" title="Nothing Was Moved" text={result.message}>{open}</Empty>
        ) : (
          <Empty icon="cloud-check" title="Prices Moved" text={`${result} records copied. Install the app from this address to keep using it offline.`}>{open}</Empty>
        )}
      </main>
    </>
  )
}
