export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Waits until Preact has flushed the render that a signal change scheduled. */
const rendered = () => new Promise<void>((resolve) => setTimeout(resolve))

/**
 * Lets rows glide to their new places when a tap reorders, filters or removes them (View Transitions with
 * `match-element` names). Typing never comes through here: results must keep up with the keyboard.
 */
export async function animateList(update: () => unknown) {
  if (!document.startViewTransition || reducedMotion()) {
    await update()
    return
  }
  const root = document.documentElement
  root.dataset.vt = 'list'
  const transition = document.startViewTransition(async () => {
    await update()
    await rendered()
  })
  try {
    await transition.finished
  } finally {
    delete root.dataset.vt
  }
}
