// Small, soft sounds made on the fly: wooden plinks and bubbly pops in C major
// pentatonic, so nothing ever clashes.
const NOTE = (semitones) => 523.25 * 2 ** (semitones / 12)
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]

export class Sounds {
  constructor() {
    this.enabled = true
    this.context = null
    this.step = 0
  }

  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume()
      return
    }
    const Context = window.AudioContext ?? window.webkitAudioContext
    if (!Context) return
    this.context = new Context()
    this.master = this.context.createGain()
    this.master.gain.value = 0.32
    this.master.connect(this.context.destination)
  }

  // A marimba-ish plink: a sine with a quick, rounded decay and a faint overtone.
  pluck(frequency, { at = 0, length = 0.5, volume = 0.5, overtone = 4 } = {}) {
    const c = this.context
    const t = c.currentTime + at
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(volume, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0008, t + length)
    gain.connect(this.master)
    for (const [ratio, level] of [[1, 1], [overtone, 0.18]]) {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency * ratio
      g.gain.value = level
      osc.connect(g).connect(gain)
      osc.start(t)
      osc.stop(t + length + 0.05)
    }
  }

  // A rising bubble pop.
  pop(from, to, { at = 0, length = 0.12, volume = 0.35 } = {}) {
    const c = this.context
    const t = c.currentTime + at
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + length)
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.0008, t + length + 0.04)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + length + 0.06)
  }

  play(name, at = 0) {
    if (!this.enabled || !this.context) return
    const p = (i) => NOTE(PENTATONIC[i % PENTATONIC.length] + 12 * Math.floor(i / PENTATONIC.length))
    switch (name) {
      case 'tap':
        this.pop(700, 1100, { at, volume: 0.18, length: 0.07 })
        break
      case 'place':
        this.step = (this.step + 1) % 6
        this.pluck(p(this.step + 1), { at, length: 0.45, volume: 0.45 })
        this.pop(420, 760, { at: at + 0.02, volume: 0.15 })
        break
      case 'double':
        this.pluck(p(this.step + 3), { at, length: 0.4, volume: 0.4 })
        this.pluck(p(this.step + 5), { at: at + 0.07, length: 0.45, volume: 0.35 })
        break
      case 'remove':
        this.pop(600, 300, { at, volume: 0.22, length: 0.14 })
        break
      case 'undo':
        this.pluck(p(4), { at, length: 0.3, volume: 0.3 })
        this.pluck(p(2), { at: at + 0.07, length: 0.35, volume: 0.28 })
        break
      case 'carrots':
        for (let i = 0; i < 3; i++) this.pop(500 + i * 160, 900 + i * 200, { at: at + i * 0.08, volume: 0.14 })
        break
      case 'hint':
        this.pluck(p(7), { at, length: 0.6, volume: 0.25, overtone: 3 })
        this.pluck(p(9), { at: at + 0.12, length: 0.8, volume: 0.22, overtone: 3 })
        break
      case 'bonk':
        this.pluck(180, { at, length: 0.2, volume: 0.4, overtone: 2.7 })
        break
      case 'oops':
        this.pluck(p(2), { at, length: 0.3, volume: 0.22 })
        this.pluck(p(0) * 0.94, { at: at + 0.1, length: 0.4, volume: 0.22 })
        break
      case 'start':
        ;[0, 2, 4, 5].forEach((n, i) => this.pluck(p(n), { at: at + i * 0.07, length: 0.5, volume: 0.32 }))
        break
      case 'win':
        ;[0, 2, 4, 5, 7, 9].forEach((n, i) => this.pluck(p(n), { at: at + i * 0.09, length: 0.9, volume: 0.36 }))
        this.pluck(p(10), { at: at + 0.6, length: 1.6, volume: 0.3, overtone: 3 })
        break
    }
  }
}
