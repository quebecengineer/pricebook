import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { back } from '../router'

const DISMISS_PX = 120

interface SheetProps {
  title: string
  /** Called for Done, Esc, backdrop tap and swipe-down; it decides whether to actually leave. */
  onClose: () => void
  trailing: ComponentChildren
  children: ComponentChildren
}

/** HIG modal sheet on the native <dialog>: focus trap, inert background and Esc handling come built in. */
export function Sheet({ title, onClose, trailing, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const dragFrom = useRef<number | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    const d = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    d.showModal()
    return () => {
      mounted.current = false
      d.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const offset = (dy: number) => (dialog.current!.style.transform = dy > 0 ? `translateY(${dy}px)` : '')
  const release = (dy: number) => {
    dragFrom.current = null
    offset(0)
    if (dy > DISMISS_PX) onClose()
  }
  const drag = {
    onPointerDown: (e: PointerEvent) => {
      if ((e.target as Element).closest('button')) return
      dragFrom.current = e.clientY
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: PointerEvent) => dragFrom.current !== null && offset(e.clientY - dragFrom.current),
    onPointerUp: (e: PointerEvent) => dragFrom.current !== null && release(e.clientY - dragFrom.current),
    onPointerCancel: () => release(0),
  }

  return (
    <dialog
      ref={dialog}
      class="sheet"
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClose={() => mounted.current && back()}
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <div class="sheet-head" {...drag}>
        <span class="grabber" aria-hidden="true" />
        <button type="button" class="sheet-btn" onClick={onClose}>
          Done
        </button>
        <h2 id="sheet-title">{title}</h2>
        {trailing}
      </div>
      <div class="sheet-body">{children}</div>
    </dialog>
  )
}
