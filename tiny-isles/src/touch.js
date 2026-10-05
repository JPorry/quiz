// Feedback drawn right under the finger, on a flat layer over the sea: a ripple
// where a touch lands, a tapering streak behind a swipe across the water, and a
// little starburst wherever that swipe cuts a bridge.

const TRAIL_LIFE = 0.28
const RIPPLE_LIFE = 0.4
const BURST_LIFE = 0.4
const WHITE = [255, 255, 255]
const CORAL = [255, 130, 112]
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`

export class TouchFx {
  constructor(container) {
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'touchfx'
    container.append(this.canvas)
    this.g = this.canvas.getContext('2d')
    this.trail = []
    this.ripples = []
    this.bursts = []
    this.time = 0
    this.color = WHITE
    new ResizeObserver(() => this.resize()).observe(container)
    this.resize()
  }

  resize() {
    const { width, height } = this.canvas.parentElement.getBoundingClientRect()
    const ratio = Math.min(devicePixelRatio, 2)
    this.canvas.width = Math.round(width * ratio)
    this.canvas.height = Math.round(height * ratio)
    this.g.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  local(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    return [clientX - rect.left, clientY - rect.top]
  }

  // a ring spreading out from where the finger lands; warm on an island
  ripple(clientX, clientY, onIsland) {
    const [x, y] = this.local(clientX, clientY)
    this.ripples.push({ x, y, t: this.time, color: onIsland ? [255, 209, 102] : WHITE })
  }

  // a new swipe across the water starts a fresh streak
  startSwipe(clientX, clientY) {
    this.trail = []
    this.color = WHITE
    this.extend(clientX, clientY)
  }

  extend(clientX, clientY) {
    const [x, y] = this.local(clientX, clientY)
    this.trail.push({ x, y, t: this.time })
  }

  // a bridge cut: a starburst, and the rest of this swipe turns coral
  cut(clientX, clientY) {
    const [x, y] = this.local(clientX, clientY)
    this.bursts.push({ x, y, t: this.time, spin: Math.random() * Math.PI })
    this.color = CORAL
  }

  get busy() {
    return this.trail.length > 0 || this.ripples.length > 0 || this.bursts.length > 0
  }

  update(dt) {
    this.time += dt
    const now = this.time
    this.trail = this.trail.filter((p) => now - p.t < TRAIL_LIFE)
    this.ripples = this.ripples.filter((r) => now - r.t < RIPPLE_LIFE)
    this.bursts = this.bursts.filter((b) => now - b.t < BURST_LIFE)
    const g = this.g
    g.clearRect(0, 0, this.canvas.width, this.canvas.height)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    // the streak thins and fades toward its tail
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1], b = this.trail[i]
      const k = 1 - (now - b.t) / TRAIL_LIFE
      g.strokeStyle = rgba(this.color, 0.85 * k)
      g.lineWidth = 2 + 9 * k
      g.beginPath()
      g.moveTo(a.x, a.y)
      g.lineTo(b.x, b.y)
      g.stroke()
    }
    for (const r of this.ripples) {
      const k = (now - r.t) / RIPPLE_LIFE
      g.strokeStyle = rgba(r.color, 0.9 * (1 - k))
      g.lineWidth = 3.5 * (1 - k) + 1
      g.beginPath()
      g.arc(r.x, r.y, 8 + 26 * (1 - (1 - k) ** 3), 0, Math.PI * 2)
      g.stroke()
    }
    for (const b of this.bursts) {
      const k = (now - b.t) / BURST_LIFE
      const out = 1 - (1 - k) ** 3
      g.strokeStyle = rgba(CORAL, 1 - k)
      g.lineWidth = 3.5 * (1 - k) + 1
      for (let s = 0; s < 8; s++) {
        const a = b.spin + (s / 8) * Math.PI * 2
        const r0 = 6 + 14 * out, r1 = r0 + 9 * (1 - k)
        g.beginPath()
        g.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0)
        g.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1)
        g.stroke()
      }
      g.fillStyle = rgba(WHITE, 0.9 * (1 - k))
      g.beginPath()
      g.arc(b.x, b.y, 5 * (1 - k) + 1, 0, Math.PI * 2)
      g.fill()
    }
  }
}
