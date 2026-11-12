import { createContext, type ComponentChildren } from 'preact'
import { useContext, useEffect, useRef } from 'preact/hooks'
import { back } from '../router'
import { rubberBand, Tracker } from './gesture'
import { reducedMotion } from './motion'

/** Provided while a closed sheet plays its exit; the sheet calls it once the exit has finished. */
export const SheetExit = createContext<(() => void) | null>(null)

/** Pulled past this share of its height, or flicked down faster than this, the sheet dismisses. */
const DISMISS_FRACTION = 0.35
const FLICK_PX_PER_MS = 0.5
const OVERPULL_PX = 60
const EXIT_FALLBACK_MS = 400

interface SheetProps {
  title: string
  /** Called for Done, Esc, backdrop tap and swipe-down; returning false means it decided to stay. */
  onClose: () => unknown
  trailing: ComponentChildren
  children: ComponentChildren
}

interface Drag {
  from: number
  height: number
  tracker: Tracker
}

/** HIG modal sheet on the native <dialog>: focus trap, inert background and Esc handling come built in. */
export function Sheet({ title, onClose, trailing, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const drag = useRef<Drag | null>(null)
  const mounted = useRef(true)
  const exitDone = useContext(SheetExit)

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

  useEffect(() => {
    if (!exitDone) return
    const d = dialog.current!
    if (reducedMotion()) return exitDone()
    const timer = setTimeout(exitDone, EXIT_FALLBACK_MS)
    const onEnd = (e: AnimationEvent) => {
      if (e.target !== d || e.animationName !== 'sheet-down') return
      clearTimeout(timer)
      exitDone()
    }
    d.addEventListener('animationend', onEnd)
    return () => {
      clearTimeout(timer)
      d.removeEventListener('animationend', onEnd)
    }
  }, [exitDone])

  /** Down follows the finger; up resists like an iOS scroll view overpulled. */
  function place(dy: number, height: number) {
    const d = dialog.current!
    const y = dy >= 0 ? dy : rubberBand(dy, OVERPULL_PX)
    d.style.transform = y ? `translateY(${y}px)` : ''
    d.style.setProperty('--drag', String(Math.max(0, dy) / height))
  }

  function springBack(height: number) {
    dialog.current!.classList.add('settling')
    place(0, height)
  }

  const close = () => !exitDone && onClose()

  function release(dy: number, velocity: number, height: number) {
    drag.current = null
    const dismiss = dy > height * DISMISS_FRACTION || (dy > 0 && velocity > FLICK_PX_PER_MS)
    if (dismiss && close() !== false) return
    springBack(height)
  }

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (exitDone || (e.target as Element).closest('button')) return
      const d = dialog.current!
      d.classList.remove('settling')
      const tracker = new Tracker()
      tracker.add(e.clientY)
      drag.current = { from: e.clientY, height: d.getBoundingClientRect().height, tracker }
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: PointerEvent) => {
      const g = drag.current
      if (!g) return
      g.tracker.add(e.clientY)
      place(e.clientY - g.from, g.height)
    },
    onPointerUp: (e: PointerEvent) => {
      const g = drag.current
      if (g) release(e.clientY - g.from, g.tracker.velocity(), g.height)
    },
    onPointerCancel: () => {
      const g = drag.current
      if (g) release(0, 0, g.height)
    },
  }

  return (
    <dialog
      ref={dialog}
      class={`sheet ${exitDone ? 'closing' : ''}`}
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClose={() => mounted.current && !exitDone && back()}
      onClick={(e) => e.target === dialog.current && close()}
      onTransitionEnd={(e) => e.target === e.currentTarget && e.currentTarget.classList.remove('settling')}
    >
      <div class="sheet-head" {...handlers}>
        <span class="grabber" aria-hidden="true" />
        <button type="button" class="sheet-btn" onClick={close}>
          Done
        </button>
        <h2 id="sheet-title">{title}</h2>
        {trailing}
      </div>
      <div class="sheet-body">{children}</div>
    </dialog>
  )
}
