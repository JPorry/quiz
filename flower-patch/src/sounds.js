// Small, soft sounds made on the fly, all in one pentatonic key so nothing clashes:
// a soft pop as a seed goes in, a rustle when one is dug up, a chime as a bed
// fills, and a rising run of notes as the garden blooms.
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

  // a seed goes in: a soft pop, a note higher for bigger seeds
  plant(seed) {
    this.noise({ vol: 0.05, freq: 500, len: 0.06 })
    this.pop(380, 620, { len: 0.07, vol: 0.18 })
    this.pluck(this.note(seed + 1), { at: 0.03, len: 0.35, vol: 0.2, ot: 3 })
  }
  // a sprout pushes up out of the soil: a soft, rising pop
  sprout(seed) {
    this.noise({ vol: 0.04, freq: 380, len: 0.08 })
    this.pop(260, 520 + seed * 40, { len: 0.12, vol: 0.16 })
  }
  // a soft gust of wind through the leaves
  gust(strength) {
    if (!this.enabled || !this.ctx) return
    const len = 2.2
    const t = this.ctx.currentTime
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain()
    src.buffer = buf
    f.type = 'bandpass'
    f.Q.value = 0.7
    f.frequency.setValueAtTime(300, t)
    f.frequency.linearRampToValueAtTime(900, t + len * 0.4)
    f.frequency.linearRampToValueAtTime(400, t + len)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.05 + strength * 0.2, t + len * 0.35)
    g.gain.linearRampToValueAtTime(0, t + len)
    src.connect(f).connect(g).connect(this.master)
    src.start(t)
  }
  // a sprout blinks awake: a tiny, bright chirp
  awake(seed) {
    this.pluck(this.note(6 + (seed % 3)), { len: 0.22, vol: 0.12, ot: 2 })
    this.pluck(this.note(8 + (seed % 3)), { at: 0.07, len: 0.3, vol: 0.1, ot: 2 })
  }
  // a seed dug up: a rustle of soil
  dig() {
    this.noise({ vol: 0.09, freq: 420, len: 0.18 })
    this.pop(420, 260, { len: 0.08, vol: 0.12 })
  }
  pick(seed) { this.pluck(this.note(seed + 2), { len: 0.16, vol: 0.14, ot: 2 }) }
  // a bed is complete: a bright little chime that climbs
  bed(count) {
    const top = Math.min(4, count)
    ;[2, 4, 5, 7].map((n) => n + top).forEach((n, k) => this.pluck(this.note(n), { at: k * 0.07, len: 0.6, vol: 0.18 }))
    this.pop(900, 1800, { at: 0.02, len: 0.09, vol: 0.07 })
  }
  // a plant pops into bud: a bubbly pop and a note that climbs along the wave
  budPop(rank) {
    this.pop(420 + rank * 60, 900 + rank * 90, { len: 0.08, vol: 0.16 })
    this.pluck(this.note(3 + rank), { at: 0.02, len: 0.4, vol: 0.2, ot: 3 })
  }
  // a flower bursts open at the finale
  bloom(k) { this.pluck(this.note(4 + (k % 7)), { len: 0.5, vol: 0.12, ot: 3 }) }
  // the count of budding beds ticks up
  tick(n) {
    this.pluck(this.note(7 + Math.min(3, n % 4)), { len: 0.3, vol: 0.16 })
    this.pop(1200, 2000, { at: 0.03, len: 0.05, vol: 0.06 })
  }
  // two seeds clash: a soft low droop
  droop() {
    this.pluck(220, { len: 0.3, vol: 0.28, ot: 2.7 })
    this.pluck(185, { at: 0.09, len: 0.35, vol: 0.22, ot: 2.7 })
  }
  // a critter jumps when tapped
  boing() {
    this.pop(300, 900, { len: 0.18, vol: 0.2 })
    this.pluck(this.note(7), { at: 0.05, len: 0.25, vol: 0.12 })
  }
  bonk() { this.pluck(170, { len: 0.25, vol: 0.4, ot: 2.7 }) }
  undo() {
    this.pluck(this.note(3), { len: 0.25, vol: 0.25 })
    this.pluck(this.note(1), { at: 0.07, len: 0.3, vol: 0.22 })
  }
  // the garden blooms: a long run up the scale with sparkles on top
  win() {
    ;[0, 2, 4, 5, 7, 9, 10].forEach((n, k) => this.pluck(this.note(n), { at: k * 0.11, len: 1.1, vol: 0.3 }))
    for (let k = 0; k < 6; k++) this.pop(1200 + k * 200, 2400, { at: 0.5 + k * 0.18, len: 0.06, vol: 0.05 })
  }
}
