/** Apple's UIScrollView rubber band: resistance grows with distance and never passes `limit`. */
export const rubberBand = (offset: number, limit: number, c = 0.55) =>
  Math.sign(offset) * (1 - 1 / ((Math.abs(offset) * c) / limit + 1)) * limit

const WINDOW_MS = 80

/** Release velocity (px/ms) from the pointer samples of the last 80ms, so a pause before lifting reads as still. */
export class Tracker {
  private samples: { at: number; x: number }[] = []

  add(x: number, at = performance.now()) {
    this.samples.push({ at, x })
    while (this.samples.length > 2 && at - this.samples[0]!.at > WINDOW_MS) this.samples.shift()
  }

  velocity(now = performance.now()) {
    const recent = this.samples.filter((s) => now - s.at <= WINDOW_MS)
    const first = recent[0]
    const last = recent[recent.length - 1]
    return first && last && last.at > first.at ? (last.x - first.x) / (last.at - first.at) : 0
  }
}

/** How far momentum would carry a release, decelerating like a flick on iOS. */
const project = (velocity: number, decelerationMs = 200) => velocity * decelerationMs

/** The snap point a released drag is heading for: its position plus projected momentum, nearest snap wins. */
export function settle(offset: number, velocity: number, snaps: readonly number[]) {
  const target = offset + project(velocity)
  return snaps.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best))
}
