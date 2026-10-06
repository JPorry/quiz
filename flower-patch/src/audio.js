// Flower Patch's music and sound effects. The audio files are composed and rendered by
// scripts/compose-audio.py: gentle, happy music on real sampled instruments over a garden of
// birdsong, a breeze, a little brook and the odd bumblebee, and soft sound effects pitched in the
// same key, so they always sit inside the music.
//
// Music streams through two decks that crossfade from track to track; effects are decoded once and
// play instantly. Browsers only allow sound after a tap, so everything waits for one. How loud the
// music and the effects are is set in Settings and remembered.
import { AUDIO } from './audioManifest.js'

// The music for playing, and for a garden in full bloom, and how loud each sits.
const MOODS = {
  garden: { tracks: 'garden', level: 0.7 },
  bloom: { tracks: 'bloom', level: 0.9 },
}
const CROSSFADE = 4
const PREFERENCES = 'flower-patch.audio'
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export class GardenAudio {
  constructor({ storage = globalThis.localStorage } = {}) {
    this.storage = storage
    // How loud each one plays, from 0 (off) to 1.
    this.musicVolume = 0.7
    this.effectsVolume = 0.8
    try {
      const saved = JSON.parse(storage?.getItem(PREFERENCES) ?? 'null')
      if (saved) {
        if (Number.isFinite(saved.music)) this.musicVolume = clamp(saved.music, 0, 1)
        if (Number.isFinite(saved.effects)) this.effectsVolume = clamp(saved.effects, 0, 1)
      }
    } catch { /* Preferences are a nicety. */ }
    this.mood = 'garden'
    this.buffers = new Map()
    this.decks = []
    this.turn = { garden: 0, bloom: 0 }
  }

  save() {
    try { this.storage?.setItem(PREFERENCES, JSON.stringify({ music: this.musicVolume, effects: this.effectsVolume })) } catch { /* Fine without. */ }
  }

  musicGain(mood = this.mood) { return MOODS[mood].level * this.musicVolume }

  // The first tap or key wakes everything up: the mixer, the effects, and the music decks.
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume()
      if (this.musicVolume > 0 && !this.playing) this.startMusic()
      return
    }
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext
    if (!Context) return
    const c = this.context = new Context()
    const compressor = c.createDynamicsCompressor()
    compressor.threshold.value = -10
    compressor.ratio.value = 3
    compressor.connect(c.destination)
    this.musicLevel = c.createGain()
    this.musicLevel.gain.value = this.musicGain()
    this.musicLevel.connect(compressor)
    this.fxLevel = c.createGain()
    this.fxLevel.gain.value = this.effectsVolume
    this.fxLevel.connect(compressor)
    // Two decks, each a streaming audio element, both started inside this tap so that iOS lets
    // them play later on their own.
    this.decks = [0, 1].map(() => {
      const element = new Audio()
      element.preload = 'auto'
      const gain = c.createGain()
      gain.gain.value = 0
      try { c.createMediaElementSource(element).connect(gain) } catch { /* Played without the mixer. */ }
      gain.connect(this.musicLevel)
      return { element, gain, track: null }
    })
    for (const deck of this.decks) {
      deck.element.src = AUDIO.music[MOODS[this.mood].tracks][0]
      deck.element.play()?.then(() => { if (deck !== this.decks[this.live] || !this.musicVolume) deck.element.pause() }, () => {})
    }
    this.loadEffects()
    if (this.musicVolume > 0) this.startMusic()
  }

  // Effects are small, so they're all fetched and decoded up front.
  loadEffects() {
    for (const [name, path] of Object.entries(AUDIO.effects)) {
      fetch(path)
        .then((response) => response.arrayBuffer())
        .then((data) => this.context.decodeAudioData(data))
        .then((buffer) => this.buffers.set(name, buffer), () => {})
    }
  }

  startMusic() {
    if (!this.context || !this.decks.length) return
    this.playing = true
    this.crossfade(this.nextTrack(this.mood))
    clearInterval(this.watch)
    // Near the end of a track, the next one fades in.
    this.watch = setInterval(() => {
      const deck = this.decks[this.live]
      if (!this.musicVolume || !deck || !deck.element.duration) return
      if (deck.element.duration - deck.element.currentTime < CROSSFADE + 0.5) this.crossfade(this.nextTrack(this.mood))
    }, 500)
  }

  nextTrack(mood) {
    const tracks = AUDIO.music[MOODS[mood].tracks] ?? []
    return tracks[this.turn[mood]++ % tracks.length]
  }

  crossfade(track, seconds = CROSSFADE) {
    if (!track) return
    const now = this.context.currentTime
    const next = this.live === 0 ? 1 : 0
    const incoming = this.decks[next], outgoing = this.decks[this.live]
    incoming.track = track
    incoming.element.src = track
    incoming.element.currentTime = 0
    incoming.element.play()?.catch(() => {})
    incoming.gain.gain.cancelScheduledValues(now)
    incoming.gain.gain.setValueAtTime(0, now)
    incoming.gain.gain.linearRampToValueAtTime(1, now + seconds)
    if (outgoing) {
      outgoing.gain.gain.cancelScheduledValues(now)
      outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value, now)
      outgoing.gain.gain.linearRampToValueAtTime(0, now + seconds)
      const element = outgoing.element
      setTimeout(() => { if (outgoing !== this.decks[this.live]) element.pause() }, seconds * 1000 + 200)
    }
    this.live = next
  }

  // 'garden' while playing, 'bloom' when a garden is in full bloom.
  setMood(name) {
    if (!MOODS[name] || name === this.mood) return
    this.mood = name
    if (!this.context) return
    this.musicLevel.gain.setTargetAtTime(this.musicGain(name), this.context.currentTime, 1)
    if (this.musicVolume > 0 && this.playing) this.crossfade(this.nextTrack(name), 3)
  }

  // The Settings sliders. Sliding the music to nothing rests it; sliding up starts it again.
  setMusicVolume(volume) {
    this.musicVolume = clamp(volume, 0, 1)
    this.save()
    if (!this.context) return
    this.musicLevel.gain.setTargetAtTime(this.musicGain(), this.context.currentTime, 0.1)
    if (this.musicVolume > 0 && !this.playing) this.startMusic()
    if (!this.musicVolume && this.playing) {
      clearTimeout(this.resting)
      this.resting = setTimeout(() => {
        if (this.musicVolume) return
        this.playing = false
        clearInterval(this.watch)
        for (const deck of this.decks) deck.element.pause()
      }, 1500)
    }
  }

  setEffectsVolume(volume) {
    this.effectsVolume = clamp(volume, 0, 1)
    this.save()
    if (this.context) this.fxLevel.gain.setTargetAtTime(this.effectsVolume, this.context.currentTime, 0.05)
  }

  // Plays a named effect now (or `at` seconds from now), `volume` times as loud.
  play(name, { at = 0, volume = 1 } = {}) {
    if (!this.effectsVolume || !this.context) return
    if (this.context.state === 'suspended') this.context.resume()
    const buffer = this.buffers.get(name)
    if (!buffer) return
    const source = this.context.createBufferSource()
    source.buffer = buffer
    let out = source
    if (volume !== 1) {
      out = this.context.createGain()
      out.gain.value = volume
      source.connect(out)
    }
    out.connect(this.fxLevel)
    source.start(this.context.currentTime + at)
  }

  // The game's sounds, by moment.
  pick(seed) { this.play(`pick-${clamp(seed, 1, 6)}`) }
  plant(seed) { this.play(`plant-${clamp(seed, 1, 6)}`) }
  sprout() { this.play('sprout') }
  awake(seed) { this.play(`awake-${clamp(seed, 1, 6)}`) }
  dig() { this.play('dig') }
  budPop(rank) { this.play(`bud-${clamp(rank, 0, 5)}`) }
  bed(count) { this.play(`bed-${clamp(count, 1, 6)}`) }
  bloom(k) { this.play(`bloom-${k % 7}`) }
  tick(n) { this.play(`tick-${n % 4}`) }
  droop() { this.play('droop') }
  bonk() { this.play('bonk') }
  boing() { this.play('boing') }
  undo() { this.play('undo') }
  gust(strength) { this.play('gust', { volume: clamp(strength / 0.19, 0.4, 1) }) }
  win() { this.play('win'); this.setMood('bloom') }
}
