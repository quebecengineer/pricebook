import { signal } from '@preact/signals'
import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { rubberBand, settle, Tracker } from './gesture'
import { haptic } from './kit'
import { reducedMotion } from './motion'

const LOCK_PX = 8
const ACTION_PX = 74
const OVERPULL_PX = 40
/** Swiped past this share of the row, releasing runs the last (destructive) action, as in iOS Mail. */
const FULL_FRACTION = 0.6
const COMMIT_FALLBACK_MS = 300

/** Only one row stays open at a time. */
const openRow = signal<string | null>(null)

export interface SwipeAction {
  label: string
  tone: 'accent' | 'danger'
  run: () => unknown
}

interface Gesture {
  x0: number
  y0: number
  start: number
  width: number
  axis?: 'x' | 'y'
  armed: boolean
  tracker: Tracker
}

/**
 * iOS trailing swipe actions for a list row. The actions are shortcuts: each one also exists as a normal button
 * elsewhere, so they are hidden from assistive technology and the keyboard.
 */
export function Swipe({ id, actions, children }: { id: string; actions: SwipeAction[]; children: ComponentChildren }) {
  const cell = useRef<HTMLLIElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const offset = useRef(0)
  const dragged = useRef(false)
  const reveal = ACTION_PX * actions.length
  const open = openRow.value === id

  function slide(x: number, animate: boolean) {
    offset.current = x
    const el = content.current!
    const settling = animate && !reducedMotion()
    el.classList.toggle('settling', settling)
    el.style.transform = x ? `translateX(${x}px)` : ''
    if (x || settling) cell.current!.classList.add('revealed')
    else cell.current!.classList.remove('revealed')
  }

  /** Hides the actions once the row is back at rest, so their colour never fringes the rounded corners. */
  const settled = (e: TransitionEvent) => {
    if (e.target === content.current && !offset.current) cell.current!.classList.remove('revealed')
  }

  function arm(on: boolean) {
    const g = gesture.current
    if (!g || g.armed === on) return
    g.armed = on
    cell.current!.classList.toggle('armed', on)
    if (on) haptic()
  }

  useEffect(() => {
    if (!open && offset.current) slide(0, true)
    if (!open) return
    const closeOutside = (e: PointerEvent) => !cell.current?.contains(e.target as Node) && (openRow.value = null)
    const closeOnScroll = () => (openRow.value = null)
    addEventListener('pointerdown', closeOutside, true)
    addEventListener('scroll', closeOnScroll, { passive: true })
    return () => {
      removeEventListener('pointerdown', closeOutside, true)
      removeEventListener('scroll', closeOnScroll)
    }
  }, [open])

  /** Slides the row out, then runs the action; the list's own transition closes the gap. */
  function commit(action: SwipeAction, width: number) {
    const el = content.current!
    let done = false
    const run = () => {
      if (done) return
      done = true
      openRow.value = null
      void action.run()
    }
    el.addEventListener('transitionend', run, { once: true })
    setTimeout(run, reducedMotion() ? 0 : COMMIT_FALLBACK_MS)
    slide(-width, true)
  }

  function release() {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== 'x') return
    const last = actions[actions.length - 1]
    if (g.armed && last) return commit(last, g.width)
    cell.current!.classList.remove('armed')
    const target = settle(offset.current, g.tracker.velocity(), [0, -reveal])
    slide(target, true)
    if (target) openRow.value = id
    else if (open || openRow.value === id) openRow.value = null
  }

  function tap(action: SwipeAction) {
    openRow.value = null
    void action.run()
  }

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return
      const tracker = new Tracker()
      tracker.add(e.clientX)
      gesture.current = { x0: e.clientX, y0: e.clientY, start: offset.current, width: cell.current!.offsetWidth, armed: false, tracker }
      dragged.current = false
    },
    onPointerMove: (e: PointerEvent) => {
      const g = gesture.current
      if (!g) return
      const dx = e.clientX - g.x0
      if (!g.axis) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(e.clientY - g.y0) < LOCK_PX) return
        g.axis = Math.abs(dx) > Math.abs(e.clientY - g.y0) ? 'x' : 'y'
        if (g.axis === 'y') return void (gesture.current = null)
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
        content.current!.classList.remove('settling')
        dragged.current = true
        openRow.value = id
      }
      g.tracker.add(e.clientX)
      const x = g.start + dx
      const bounded = x > 0 ? rubberBand(x, OVERPULL_PX) : x < -g.width ? -g.width + rubberBand(x + g.width, OVERPULL_PX) : x
      slide(bounded, false)
      arm(-bounded > g.width * FULL_FRACTION)
    },
    onPointerUp: release,
    onPointerCancel: release,
  }

  return (
    <li ref={cell} class="cell swipe">
      <div class="swipe-actions" aria-hidden="true">
        {actions.map((a) => (
          <button key={a.label} type="button" tabIndex={-1} class={`swipe-action ${a.tone}`} onClick={() => tap(a)}>
            {a.label}
          </button>
        ))}
      </div>
      <div
        ref={content}
        class="swipe-content"
        {...handlers}
        onClickCapture={(e) => {
          if (!dragged.current && !open) return
          e.preventDefault()
          e.stopPropagation()
          dragged.current = false
          if (open) openRow.value = null
        }}
        onDragStart={(e) => e.preventDefault()}
        onTransitionEnd={settled}
      >
        {children}
      </div>
    </li>
  )
}
