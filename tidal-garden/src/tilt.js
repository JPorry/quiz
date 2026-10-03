// The garden leans very slightly as the phone tilts, as if the diorama were sitting in it.

const STORAGE_KEY = 'tidal-garden.tilt'
// How far the phone must turn, in degrees, for the board to reach its full lean.
const RANGE = 18
// The most the board leans either way, in radians (8 degrees).
export const MAX_LEAN = 8 * Math.PI / 180
// How quickly the board follows the phone, and how slowly "level" settles to the way it is held.
const FOLLOW = 0.18
const SETTLE = 5

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

// The phone's tilt in the screen's own frame: `side` is the right edge dipping, and `front`
// is the top edge rising toward the player, whichever way the screen is turned.
export function screenTilt(beta, gamma, angle = 0) {
  switch (((angle % 360) + 360) % 360) {
    case 90: return { side: beta, front: -gamma }
    case 180: return { side: -gamma, front: -beta }
    case 270: return { side: -beta, front: gamma }
    default: return { side: gamma, front: beta }
  }
}

// How far the board leans for a tilt away from level, in radians, eased off toward the limits.
export function leanFor(degrees) {
  const t = clamp(degrees / RANGE, -1, 1)
  return Math.sin(t * Math.PI / 2) * MAX_LEAN
}

export class DeviceTilt {
  constructor({ storage = globalThis.localStorage, reducedMotion = false } = {}) {
    this.storage = storage
    this.reducedMotion = reducedMotion
    this.supported = typeof DeviceOrientationEvent !== 'undefined' && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    // iOS asks the player before sharing motion; other browsers share it on secure pages.
    this.needsPermission = this.supported && typeof DeviceOrientationEvent.requestPermission === 'function'
    this.enabled = false
    this.reading = null
    this.level = null
    this.side = 0
    this.front = 0
    this.onReading = (event) => {
      if (event.beta === null || event.gamma === null) return
      const angle = screen.orientation?.angle ?? globalThis.orientation ?? 0
      const reading = screenTilt(event.beta, event.gamma, angle)
      // A big jump (the phone flipped or the screen turned) starts level afresh.
      if (!this.reading || Math.abs(reading.side - this.reading.side) > 45 || Math.abs(reading.front - this.reading.front) > 45) this.level = { ...reading }
      this.reading = reading
    }
  }

  get preference() {
    try { return this.storage?.getItem(STORAGE_KEY) } catch { return null }
  }

  remember(value) {
    try { this.storage?.setItem(STORAGE_KEY, value) } catch { /* Tilting does not depend on storage. */ }
  }

  // Whether to ask on the player's first touch: only where permission is needed and they have not answered yet.
  get shouldAsk() { return this.needsPermission && !this.enabled && this.preference === null }

  // Turns tilting on where allowed without asking; elsewhere waits for a tap.
  restore() {
    if (!this.supported || this.reducedMotion) return false
    if (!this.needsPermission && this.preference !== 'off') return this.listen()
    return false
  }

  // Must run inside a tap on iOS, where it shows the system permission prompt.
  async enable() {
    if (!this.supported) return false
    if (this.needsPermission) {
      try {
        if (await DeviceOrientationEvent.requestPermission() !== 'granted') { this.remember('off'); return false }
      } catch { return false }
    }
    this.remember('on')
    return this.listen()
  }

  disable() {
    this.remember('off')
    this.enabled = false
    removeEventListener('deviceorientation', this.onReading)
    this.reading = null
    this.level = null
  }

  listen() {
    if (!this.enabled) addEventListener('deviceorientation', this.onReading)
    this.enabled = true
    return true
  }

  // The board's lean right now, in radians: it follows the phone smoothly, and "level"
  // slowly settles to however the phone is held, so only movement makes it lean.
  update(dt) {
    let side = 0, front = 0
    if (this.enabled && this.reading && this.level) {
      const settle = 1 - Math.exp(-dt / SETTLE)
      this.level.side += (this.reading.side - this.level.side) * settle
      this.level.front += (this.reading.front - this.level.front) * settle
      side = leanFor(this.reading.side - this.level.side)
      front = leanFor(this.reading.front - this.level.front)
    }
    const follow = 1 - Math.exp(-dt / FOLLOW)
    this.side += (side - this.side) * follow
    this.front += (front - this.front) * follow
    if (Math.abs(this.side) < 1e-5) this.side = 0
    if (Math.abs(this.front) < 1e-5) this.front = 0
    return { side: this.side, front: this.front }
  }
}
