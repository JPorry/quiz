// The garden leans very slightly as the phone tilts, as if the diorama were sitting in it.

const STORAGE_KEY = 'tidal-garden.tilt'
// How far the phone must turn, in degrees, for the board to reach its full lean.
const RANGE = 30
// The most the board leans either way, in radians (3.5 degrees): a hint of depth, not a sway.
export const MAX_LEAN = 3.5 * Math.PI / 180
// How quickly the board follows the phone, and how slowly "level" settles to the way it is held.
const FOLLOW = 0.3
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
    // On iOS, whether the player has confirmed motion access on this visit.
    this.confirmed = !this.needsPermission
    this.asking = null
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

  // Whether the player's next tap should confirm motion access: iOS needs it on every visit,
  // unless they have turned tilting off. Once granted, iOS confirms quietly without a prompt.
  get shouldAsk() { return this.needsPermission && !this.confirmed && this.preference !== 'off' }

  // Starts listening unless the player turned tilting off. On iOS readings only arrive once
  // permission is confirmed, which may already be the case from an earlier visit.
  restore() {
    if (!this.supported || this.reducedMotion || this.preference === 'off') return false
    return this.listen()
  }

  // Asks for motion access where needed; must run inside a tap on iOS. Resolves to 'granted',
  // 'denied', or 'retry' when the browser would not ask outside a tap.
  confirm() {
    if (!this.needsPermission) return Promise.resolve('granted')
    this.asking ??= (async () => {
      try {
        const answer = await DeviceOrientationEvent.requestPermission()
        if (answer === 'granted') { this.confirmed = true; this.remember('on'); this.listen() } else this.disable()
        return answer === 'granted' ? 'granted' : 'denied'
      } catch {
        return 'retry'
      } finally {
        this.asking = null
      }
    })()
    return this.asking
  }

  // Turns tilting on from the button.
  async enable() {
    if (!this.supported) return false
    if (await this.confirm() !== 'granted') return false
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
