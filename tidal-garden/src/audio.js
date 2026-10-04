// Tidal Garden's music and sound effects, all made in code with the Web Audio API.
//
// The music is generative and never stressful: a slow, warm progression in F major, soft kalimba
// plucks that wander only through the F major pentatonic scale (so no two notes can ever clash),
// and a bed of nature (lapping waves, birdsong now and then, wind chimes, and crickets at dusk).
// Every sound effect is pitched in the same key, so it always sits inside the music.

const midi = (note) => 440 * 2 ** ((note - 69) / 12)

// F major pentatonic, F G A C D, from F4 up two octaves.
export const PENTATONIC = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89]
// A slow, warm progression: Fmaj7, Am7, B♭maj7, Cadd9.
export const PROGRESSION = [
  { bass: 41, pad: [53, 57, 60, 64] },
  { bass: 45, pad: [52, 57, 60, 64] },
  { bass: 46, pad: [50, 53, 57, 62] },
  { bass: 48, pad: [52, 55, 60, 62] },
]
export const CHORD_LENGTH = 9.6

// How each screen sounds: how present the pad, the melody, and the waves are, how many notes the
// melody plays per chord, and which creatures are about.
export const MOODS = {
  title: { pad: 1, melody: 1, waves: 0.7, notes: [3, 5], birds: 0.8, crickets: 0 },
  map: { pad: 1, melody: 1, waves: 0.55, notes: [3, 6], birds: 0.9, crickets: 0 },
  play: { pad: 0.7, melody: 0.65, waves: 0.9, notes: [1, 3], birds: 0.35, crickets: 0 },
  evening: { pad: 1, melody: 0.8, waves: 0.8, notes: [2, 4], birds: 0, crickets: 1 },
}

// A small seeded random source, so a rendered preview can be repeated exactly.
export function random(seed = Date.now()) {
  let state = seed >>> 0
  return () => {
    state = state + 0x6d2b79f5 >>> 0
    let t = state
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// A melody for one chord: a gentle random walk through the pentatonic scale on a half-second grid,
// mostly stepping to a neighbor, now and then leaping a little. Returns [time, note] pairs.
export function melodyFor(rng, [fewest, most], start = 4) {
  const count = fewest + Math.floor(rng() * (most - fewest + 1))
  const slots = [...Array(Math.floor(CHORD_LENGTH / 0.6) - 2).keys()].map((i) => (i + 1) * 0.6)
  const times = []
  while (times.length < count && slots.length) times.push(slots.splice(Math.floor(rng() * slots.length), 1)[0])
  times.sort((a, b) => a - b)
  let step = start
  return times.map((time) => {
    const leap = rng() < 0.75 ? (rng() < 0.5 ? -1 : 1) : (rng() < 0.5 ? -2 : 2)
    step = Math.max(0, Math.min(PENTATONIC.length - 1, step + leap))
    return [time + (rng() - 0.5) * 0.08, PENTATONIC[step]]
  })
}

const PREFERENCES = 'tidal-garden.audio'

export class GardenAudio {
  constructor({ storage = globalThis.localStorage } = {}) {
    this.storage = storage
    this.music = true
    this.effects = true
    try {
      const saved = JSON.parse(storage?.getItem(PREFERENCES) ?? 'null')
      if (saved) { this.music = saved.music !== false; this.effects = saved.effects !== false }
    } catch { /* Preferences are a nicety. */ }
    this.mood = 'title'
    this.rng = random()
  }

  save() {
    try { this.storage?.setItem(PREFERENCES, JSON.stringify({ music: this.music, effects: this.effects })) } catch { /* Fine without. */ }
  }

  // Browsers only let sound start from a tap or a key, so the first one wakes everything up.
  unlock() {
    if (!this.context) {
      const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext
      if (!Context) return
      this.attach(new Context())
    }
    if (this.context.state === 'suspended') this.context.resume()
    if (this.music) this.startMusic()
  }

  // Builds the mixing desk on a context: music and effects each have their own level, both share
  // a soft room reverb, and a gentle compressor keeps any pile-up from ever getting loud.
  attach(context) {
    this.context = context
    const c = context
    const compressor = c.createDynamicsCompressor()
    compressor.threshold.value = -12
    compressor.ratio.value = 3
    compressor.connect(c.destination)
    this.out = c.createGain()
    this.out.gain.value = 2
    this.out.connect(compressor)
    this.reverb = c.createConvolver()
    this.reverb.buffer = this.room(3.4)
    const wet = c.createGain()
    wet.gain.value = 0.55
    this.reverb.connect(wet).connect(this.out)
    this.musicLevel = c.createGain()
    this.musicLevel.gain.value = this.music ? 0.9 : 0
    this.musicLevel.connect(this.out)
    this.fxLevel = c.createGain()
    this.fxLevel.gain.value = 1
    this.fxLevel.connect(this.out)
    const bus = (level, verb) => {
      const gain = c.createGain()
      gain.gain.value = level
      gain.connect(this.musicLevel)
      const send = c.createGain()
      send.gain.value = verb
      gain.connect(send).connect(this.reverb)
      return gain
    }
    const mood = MOODS[this.mood]
    this.padBus = bus(mood.pad, 0.5)
    this.melodyBus = bus(mood.melody, 0.8)
    this.natureBus = bus(1, 0.35)
    this.wavesLevel = c.createGain()
    this.wavesLevel.gain.value = mood.waves
    this.wavesLevel.connect(this.natureBus)
    this.fxSend = c.createGain()
    this.fxSend.gain.value = 0.35
    this.fxSend.connect(this.reverb)
    this.noise = this.noiseBuffer(4)
    this.nextChord = null
    this.chordIndex = 0
  }

  // A stereo room: two channels of noise that fade away over `seconds`.
  room(seconds) {
    const c = this.context
    const length = Math.floor(c.sampleRate * seconds)
    const buffer = c.createBuffer(2, length, c.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) data[i] = (this.rng() * 2 - 1) * (1 - i / length) ** 3.2
    }
    return buffer
  }

  noiseBuffer(seconds) {
    const c = this.context
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate)
    const data = buffer.getChannelData(0)
    // Softly filtered noise: closer to the hush of surf than to hiss.
    let last = 0
    for (let i = 0; i < data.length; i++) { last = last * 0.96 + (this.rng() * 2 - 1) * 0.04; data[i] = last * 6 }
    return buffer
  }

  setMood(name) {
    if (!MOODS[name] || name === this.mood) return
    this.mood = name
    if (!this.context) return
    const mood = MOODS[name], now = this.context.currentTime
    this.padBus.gain.setTargetAtTime(mood.pad, now, 1.5)
    this.melodyBus.gain.setTargetAtTime(mood.melody, now, 1.5)
    this.wavesLevel.gain.setTargetAtTime(mood.waves, now, 2)
  }

  setMusic(on) {
    this.music = on
    this.save()
    if (!this.context) return
    this.musicLevel.gain.setTargetAtTime(on ? 0.9 : 0, this.context.currentTime, 0.6)
    this.hushedAt = on ? null : this.context.currentTime
    if (on) this.startMusic()
  }

  setEffects(on) {
    this.effects = on
    this.save()
  }

  // Starts the waves and the scheduler that lays out the music a couple of seconds ahead.
  startMusic() {
    if (!this.context || this.playing) return
    this.playing = true
    this.startWaves(this.context.currentTime)
    this.nextChord = this.context.currentTime + 0.3
    const tick = () => {
      // Switched off, the music fades for a few seconds before the waves stop, so nothing clicks.
      if (!this.music) {
        if (this.context.currentTime - (this.hushedAt ?? 0) < 4) return
        this.playing = false
        clearInterval(this.timer)
        this.stopWaves()
        return
      }
      this.scheduleUntil(this.context.currentTime + 2.5)
    }
    this.timer = setInterval(tick, 250)
    tick()
  }

  stopWaves() {
    try { this.waves?.stop() } catch { /* Already stopped. */ }
    this.waves = null
  }

  // The sea: looping noise through a low filter whose cutoff and level rise and fall like swells.
  startWaves(at) {
    const c = this.context
    const source = c.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 520
    const swell = c.createGain()
    swell.gain.value = 0.03
    const lfo = (frequency, depth, target) => {
      const osc = c.createOscillator()
      osc.frequency.value = frequency
      const amount = c.createGain()
      amount.gain.value = depth
      osc.connect(amount).connect(target)
      osc.start(at)
      return osc
    }
    lfo(0.071, 260, filter.frequency)
    lfo(0.093, 0.018, swell.gain)
    source.connect(filter).connect(swell).connect(this.wavesLevel)
    source.start(at)
    this.waves = source
  }

  // Lays out every chord (pad, bass, melody, and wildlife) that begins before `until`.
  scheduleUntil(until) {
    while (this.nextChord < until) {
      this.scheduleChord(this.nextChord, PROGRESSION[this.chordIndex % PROGRESSION.length])
      this.nextChord += CHORD_LENGTH
      this.chordIndex++
    }
  }

  scheduleChord(t, chord) {
    const mood = MOODS[this.mood]
    for (const note of chord.pad) this.padVoice(t, midi(note), CHORD_LENGTH + 3)
    this.bass(t, midi(chord.bass), CHORD_LENGTH + 2)
    this.lastStep ??= 4
    for (const [offset, note] of melodyFor(this.rng, mood.notes, this.lastStep)) {
      this.pluck(this.melodyBus, t + offset, midi(note), 0.05)
      this.lastStep = PENTATONIC.indexOf(note)
    }
    // Now and then the breeze stirs a wind chime.
    if (this.rng() < 0.3) {
      const at = t + 2 + this.rng() * 5
      for (let i = 0; i < 4; i++) this.pluck(this.melodyBus, at + i * 0.11 + this.rng() * 0.05, midi(PENTATONIC[6 + Math.floor(this.rng() * 5)] + 12), 0.012, 2.4)
    }
    if (this.rng() < mood.birds) this.bird(t + 1 + this.rng() * (CHORD_LENGTH - 2))
    if (this.rng() < mood.birds * 0.4) this.bird(t + 1 + this.rng() * (CHORD_LENGTH - 2))
    if (mood.crickets) for (let at = t; at < t + CHORD_LENGTH; at += 1.1 + this.rng() * 0.5) this.cricket(at)
  }

  // A soft pad voice: two slightly detuned triangles under a gentle low-pass, swelling in and out.
  padVoice(t, frequency, length) {
    const c = this.context
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 760
    filter.Q.value = 0.4
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.011, t + 3)
    gain.gain.setValueAtTime(0.011, t + length - 4)
    gain.gain.linearRampToValueAtTime(0, t + length)
    filter.connect(gain).connect(this.padBus)
    for (const cents of [-5, 5]) {
      const osc = c.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = frequency
      osc.detune.value = cents
      osc.connect(filter)
      osc.start(t)
      osc.stop(t + length + 0.1)
    }
  }

  bass(t, frequency, length) {
    const c = this.context
    const osc = c.createOscillator()
    osc.frequency.value = frequency
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.035, t + 1.5)
    gain.gain.setValueAtTime(0.035, t + length - 3)
    gain.gain.linearRampToValueAtTime(0, t + length)
    osc.connect(gain).connect(this.padBus)
    osc.start(t)
    osc.stop(t + length + 0.1)
  }

  // A kalimba-like pluck: a round sine with a quiet, quickly fading overtone for the tine's ping.
  pluck(target, t, frequency, level, decay = 1.7) {
    const c = this.context
    for (const [ratio, share, fade] of [[1, 1, decay], [2, 0.22, decay * 0.35], [3.01, 0.08, decay * 0.18]]) {
      const osc = c.createOscillator()
      osc.frequency.value = frequency * ratio
      const gain = c.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(level * share, t + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + fade)
      osc.connect(gain).connect(target)
      osc.start(t)
      osc.stop(t + fade + 0.05)
    }
  }

  // A little bird somewhere off to one side: a few quick rising-and-falling chirps.
  bird(t) {
    const c = this.context
    const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain()
    if (pan.pan) pan.pan.value = this.rng() * 1.4 - 0.7
    pan.connect(this.natureBus)
    const base = 2400 + this.rng() * 1400
    const chirps = 2 + Math.floor(this.rng() * 3)
    for (let i = 0; i < chirps; i++) {
      const at = t + i * (0.11 + this.rng() * 0.05)
      const osc = c.createOscillator()
      osc.frequency.setValueAtTime(base, at)
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, at + 0.035)
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, at + 0.075)
      const gain = c.createGain()
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.012, at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.085)
      osc.connect(gain).connect(pan)
      osc.start(at)
      osc.stop(at + 0.1)
    }
  }

  // Crickets at dusk: three tiny high pulses.
  cricket(t) {
    const c = this.context
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.045
      const osc = c.createOscillator()
      osc.frequency.value = 4300 + this.rng() * 300
      const gain = c.createGain()
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.0035, at + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.03)
      osc.connect(gain).connect(this.natureBus)
      osc.start(at)
      osc.stop(at + 0.04)
    }
  }

  // ---- Sound effects ---------------------------------------------------------------------------

  // A shaped tone into the effects mix: frequency can glide, level swells and fades.
  tone(t, { type = 'sine', from, to = from, glide = 0.08, level = 0.05, attack = 0.006, decay = 0.4, verb = true }) {
    const c = this.context
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + glide)
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(level, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    osc.connect(gain).connect(this.fxLevel)
    if (verb) gain.connect(this.fxSend)
    osc.start(t)
    osc.stop(t + decay + 0.05)
  }

  // A puff of filtered noise: rustles, splashes, and breezes.
  hush(t, { type = 'bandpass', from = 1200, to = from, q = 1, level = 0.04, attack = 0.01, length = 0.25 }) {
    const c = this.context
    const source = c.createBufferSource()
    source.buffer = this.noise
    const filter = c.createBiquadFilter()
    filter.type = type
    filter.Q.value = q
    filter.frequency.setValueAtTime(from, t)
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, t + length)
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(level, t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
    source.connect(filter).connect(gain).connect(this.fxLevel)
    gain.connect(this.fxSend)
    source.start(t, this.rng() * 2)
    source.stop(t + length + 0.05)
  }

  // Plays a named effect now (`at` seconds from now), if effects are on.
  play(name, options = {}) {
    if (!this.effects || !this.context) return
    if (this.context.state === 'suspended') this.context.resume()
    const sound = EFFECTS[name]
    if (sound) sound(this, this.context.currentTime + (options.at ?? 0) + 0.01, options)
  }
}

const note = (step) => midi(PENTATONIC[((step % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length])

// Every effect, by name. Each takes the engine, a start time, and any options.
export const EFFECTS = {
  // A soft "bloop" for any button.
  tap: (a, t) => a.tone(t, { from: midi(72), to: midi(79), glide: 0.06, level: 0.045, decay: 0.16 }),
  // A gentler "bloop" back down, for closing and going back.
  back: (a, t) => a.tone(t, { from: midi(79), to: midi(72), glide: 0.07, level: 0.04, decay: 0.16 }),
  // A breeze sweeping across, between screens.
  swoosh: (a, t) => a.hush(t, { from: 500, to: 1800, q: 0.8, level: 0.035, attack: 0.18, length: 0.6 }),
  // Play: a bright little rising run and a sparkle on top.
  start: (a, t) => {
    ;[3, 4, 5, 7].forEach((step, i) => a.pluck(a.fxLevel, t + i * 0.075, note(step), 0.055, 1.2))
    a.pluck(a.fxSend, t + 0.32, note(10), 0.03, 1.6)
  },
  // A garden on the map: a marimba note that climbs with the garden's number.
  select: (a, t, { level = 0 }) => a.pluck(a.fxLevel, t, note(2 + (level % 7)), 0.06, 0.9),
  // A locked garden: two soft wooden knocks.
  locked: (a, t) => { a.tone(t, { type: 'triangle', from: 300, to: 240, level: 0.05, decay: 0.09, verb: false }); a.tone(t + 0.1, { type: 'triangle', from: 280, to: 220, level: 0.04, decay: 0.09, verb: false }) },
  // A card rising into view: two bubbles.
  open: (a, t) => { a.tone(t, { from: 500, to: 900, glide: 0.09, level: 0.035, decay: 0.14 }); a.tone(t + 0.09, { from: 700, to: 1300, glide: 0.09, level: 0.03, decay: 0.16 }) },
  // The marker hopping along the path.
  hop: (a, t) => { a.tone(t, { from: midi(74), to: midi(81), glide: 0.12, level: 0.04, decay: 0.2 }); a.tone(t + 0.45, { from: midi(77), to: midi(84), glide: 0.12, level: 0.04, decay: 0.22 }) },
  // A garden opening on the map: a shower of high pings.
  unlock: (a, t) => [6, 8, 7, 10].forEach((step, i) => a.pluck(a.fxSend, t + i * 0.06, note(step), 0.03, 1.4)),
  // Choosing water: bubbles rising.
  water: (a, t) => [0, 0.06, 0.13].forEach((d, i) => a.tone(t + d, { from: 420 + i * 160, to: 900 + i * 260, glide: 0.07, level: 0.03, decay: 0.1 })),
  // Choosing land: a leafy rustle and a soft wooden knock.
  land: (a, t) => { a.hush(t, { from: 3200, to: 1800, q: 0.7, level: 0.03, length: 0.22 }); a.tone(t + 0.02, { type: 'triangle', from: midi(60), level: 0.04, decay: 0.18 }) },
  // Choosing clear: a little puff of mist.
  erase: (a, t) => a.hush(t, { type: 'highpass', from: 1800, to: 4200, level: 0.03, attack: 0.05, length: 0.35 }),
  // Placing water: a droplet's plip and a tiny splash, pitched by where it lands.
  'place-water': (a, t, { row = 0, col = 0 }) => {
    const pitch = note(3 + ((row + col) % 7))
    a.tone(t, { from: pitch * 2, to: pitch, glide: 0.05, level: 0.05, decay: 0.28 })
    a.hush(t + 0.03, { from: 2600, to: 900, q: 0.9, level: 0.02, length: 0.22 })
  },
  // Placing land: a soft earthy thump with a marimba note on top.
  'place-land': (a, t, { row = 0, col = 0 }) => {
    a.tone(t, { from: 170, to: 95, glide: 0.1, level: 0.06, decay: 0.2, verb: false })
    a.hush(t, { from: 2600, to: 1500, q: 0.6, level: 0.018, length: 0.16 })
    a.pluck(a.fxLevel, t + 0.015, note((row + col) % 7), 0.045, 0.8)
  },
  // Clearing a tile: a soft whisper of air.
  'place-erase': (a, t) => a.hush(t, { from: 1400, to: 600, q: 0.7, level: 0.028, length: 0.25 }),
  // Undo: a little rewind.
  undo: (a, t) => { a.tone(t, { from: midi(81), to: midi(74), glide: 0.08, level: 0.035, decay: 0.14 }); a.tone(t + 0.08, { from: midi(77), to: midi(69), glide: 0.08, level: 0.03, decay: 0.16 }) },
  // A hint: two twinkles.
  hint: (a, t) => { a.pluck(a.fxLevel, t, note(9), 0.035, 1.1); a.pluck(a.fxLevel, t + 0.12, note(10), 0.03, 1.3) },
  // Out of balance: a soft, rounded "bonk", never harsh.
  oops: (a, t) => a.tone(t, { type: 'triangle', from: midi(57), to: midi(53), glide: 0.12, level: 0.05, decay: 0.3 }),
  // Starting a garden over: the tide washing out.
  restart: (a, t) => a.hush(t, { type: 'lowpass', from: 2400, to: 300, level: 0.05, attack: 0.08, length: 0.9 }),
  // A row or column clicking into place: a breeze rushing along it.
  flourish: (a, t, { lines = 1 }) => {
    const length = lines > 1 ? 1.3 : 0.95
    a.hush(t, { from: 380, to: 1500, q: 1.4, level: 0.05, attack: length * 0.3, length })
    a.pluck(a.fxSend, t + 0.2, note(7), 0.02, 1.2)
  },
  // A village coming to life: a warm two-note welcome.
  village: (a, t) => { a.pluck(a.fxLevel, t + 0.1, midi(72), 0.05, 1.1); a.pluck(a.fxLevel, t + 0.26, midi(77), 0.05, 1.3) },
  // A lighthouse lighting: a bright bell-buoy chime.
  lighthouse: (a, t) => [[84, 0.05], [89, 0.2], [93, 0.35]].forEach(([n, d]) => a.pluck(a.fxLevel, t + d, midi(n), 0.035, 1.3)),
  // A ferry's crossing opening: a soft, cheerful toot-toot.
  ferry: (a, t) => [[0.05, 0.22], [0.38, 0.42]].forEach(([d, length]) => {
    for (const n of [65, 69]) a.tone(t + d, { type: 'triangle', from: midi(n) * 0.97, to: midi(n), glide: 0.06, level: 0.03, attack: 0.04, decay: length + 0.12 })
  }),
  // Two shrines joined: a temple bell, round and slow to fade.
  pilgrim: (a, t) => [[1, 0.045, 2.6], [2.76, 0.012, 1.4], [5.4, 0.006, 0.7], [0.5, 0.02, 2.2]].forEach(([ratio, level, decay]) => a.tone(t, { from: midi(65) * ratio, level, attack: 0.01, decay })),
  // A finished garden: a rising arpeggio and a shimmer of chimes.
  win: (a, t) => {
    ;[0, 2, 3, 5, 7, 8].forEach((step, i) => a.pluck(a.fxLevel, t + 0.25 + i * 0.14, note(step), 0.05, 1.8))
    ;[9, 10, 8, 10].forEach((step, i) => a.pluck(a.fxSend, t + 1.2 + i * 0.09, note(step) * 2, 0.012, 2))
  },
}

// Renders a stretch of music (and, optionally, effects) offline, for previews and tests.
export async function renderPreview(OfflineContext, { seconds = 30, mood = 'title', seed = 7, effects = [] } = {}) {
  const context = new OfflineContext(2, Math.ceil(seconds * 44100), 44100)
  const audio = new GardenAudio({ storage: null })
  audio.rng = random(seed)
  audio.mood = mood
  audio.attach(context)
  audio.startWaves(0)
  audio.nextChord = 0.3
  audio.scheduleUntil(seconds)
  for (const [name, at, options] of effects) EFFECTS[name](audio, at, options ?? {})
  return context.startRendering()
}
