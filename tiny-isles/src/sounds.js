// Small, soft sounds made on the fly, all in one pentatonic key so nothing clashes:
// wooden plinks for planks, bubbly pops, splashes and tiny car toots.
const NOTES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]

export class Sounds {
  constructor() {
    this.enabled = true
    this.ctx = null
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.35
    this.master.connect(this.ctx.destination)
  }

  note(n) {
    return 523.25 * 2 ** (NOTES[Math.max(0, Math.min(NOTES.length - 1, n))] / 12)
  }

  pluck(freq, { at = 0, len = 0.45, vol = 0.45, ot = 4 } = {}) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime + at
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0008, t + len)
    g.connect(this.master)
    for (const [r, l] of [[1, 1], [ot, 0.16]]) {
      const o = this.ctx.createOscillator(), og = this.ctx.createGain()
      o.frequency.value = freq * r
      og.gain.value = l
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + len + 0.05)
    }
  }

  pop(f1, f2, { at = 0, len = 0.1, vol = 0.25 } = {}) {
    if (!this.enabled || !this.ctx) return
    const t = this.ctx.currentTime + at
    const o = this.ctx.createOscillator(), g = this.ctx.createGain()
    o.frequency.setValueAtTime(f1, t)
    o.frequency.exponentialRampToValueAtTime(f2, t + len)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0008, t + len + 0.04)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + len + 0.06)
  }

  // a short burst of filtered noise: a plank knocked into place, or a splash
  noise({ vol = 0.06, freq = 1100, len = 0.05 } = {}) {
    if (!this.enabled || !this.ctx) return
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain()
    s.buffer = buf
    f.type = 'bandpass'
    f.frequency.value = freq * (0.8 + Math.random() * 0.4)
    f.Q.value = 0.8
    g.gain.value = vol
    s.connect(f).connect(g).connect(this.master)
    s.start()
  }

  plank() { this.pluck(this.note(Math.floor(Math.random() * 5) + 2) * 0.5, { len: 0.12, vol: 0.12, ot: 3 }) }
  build(step) {
    this.pluck(this.note(step % 8 + 1))
    this.pluck(this.note(step % 8 + 3), { at: 0.06, vol: 0.25 })
  }
  splash() { this.noise({ vol: 0.12, freq: 700, len: 0.25 }) }
  snap() { this.pluck(this.note(6), { len: 0.18, vol: 0.2 }) }
  press() { this.pop(500, 700, { len: 0.05, vol: 0.12 }) }
  bonk() { this.pluck(170, { len: 0.25, vol: 0.4, ot: 2.7 }) }
  // a city grows a step: a little rising sparkle
  grow(tier) {
    this.pop(700, 1300, { len: 0.08, vol: 0.16 })
    this.pluck(this.note(4 + Math.min(6, tier)), { vol: 0.2, len: 0.35, at: 0.04 })
  }
  undo() {
    this.pluck(this.note(3), { len: 0.25, vol: 0.25 })
    this.pluck(this.note(1), { at: 0.07, len: 0.3, vol: 0.22 })
  }
  win() {
    ;[0, 2, 4, 5, 7, 9].forEach((n, k) => this.pluck(this.note(n), { at: k * 0.09, len: 0.9, vol: 0.32 }))
  }
}
