// Hamster Hideaway's music and sound effects. The audio files are composed and
// rendered by scripts/compose-audio.py: a gentle music-box and kalimba lullaby
// with a soft room tone, and cute effects (glass clinks, squeaks, chimes)
// pitched in the same key, so they always sit inside the music.
//
// The same easy-going tracks play on every screen, streaming through two decks
// that crossfade from one to the next; effects are decoded once
// and play instantly. Browsers only allow sound after a tap, so everything waits
// for one. Adapted from Tiny Isles' audio.
import { AUDIO } from './audioManifest.js'

// Each screen's music, and how loud it sits: every screen shares the same tracks,
// so moving between them only eases the volume, a touch quieter while puzzling.
const MOODS = {
  title: { tracks: 'habitat', level: 0.7 },
  home: { tracks: 'habitat', level: 0.62 },
  days: { tracks: 'habitat', level: 0.55 },
  play: { tracks: 'habitat', level: 0.5 },
}
const CROSSFADE = 4
const PREFERENCES = 'hamster-hideaway.audio'

export class HamsterAudio {
  constructor({ storage = globalThis.localStorage } = {}) {
    this.storage = storage
    this.music = true
    this.effects = true
    // how loud each one plays, from 0 to 1, set in Settings
    this.musicVolume = 1
    this.effectsVolume = 1
    const level = (value) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1)
    try {
      const saved = JSON.parse(storage?.getItem(PREFERENCES) ?? 'null')
      if (saved) {
        this.music = saved.music !== false
        this.effects = saved.effects !== false
        this.musicVolume = level(saved.musicVolume)
        this.effectsVolume = level(saved.effectsVolume)
      }
    } catch { /* preferences are a nicety */ }
    this.mood = 'title'
    this.buffers = new Map()
    this.decks = []
    this.turn = { habitat: 0 }
    this.live = 0
  }

  save() {
    try { this.storage?.setItem(PREFERENCES, JSON.stringify({ music: this.music, effects: this.effects, musicVolume: this.musicVolume, effectsVolume: this.effectsVolume })) } catch { /* fine without */ }
  }

  musicGain(mood = this.mood) { return this.music ? MOODS[mood].level * this.musicVolume : 0 }

  // The first tap wakes everything up: the mixer, the effects, and the music decks.
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume()
      if (this.music && !this.playing) this.startMusic()
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
    this.fxLevel.gain.value = 0.9 * this.effectsVolume
    this.fxLevel.connect(compressor)
    // Two decks, each a streaming audio element, both started inside this tap so
    // that iOS lets them play later on their own.
    this.decks = [0, 1].map(() => {
      const element = new Audio()
      element.preload = 'auto'
      const gain = c.createGain()
      gain.gain.value = 0
      try { c.createMediaElementSource(element).connect(gain) } catch { /* played without the mixer */ }
      gain.connect(this.musicLevel)
      return { element, gain }
    })
    for (const deck of this.decks) {
      deck.element.src = AUDIO.music[MOODS[this.mood].tracks][0]
      deck.element.play()?.then(() => { if (deck !== this.decks[this.live] || !this.music) deck.element.pause() }, () => {})
    }
    this.loadEffects()
    if (this.music) this.startMusic()
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
      if (!this.music || !deck || !deck.element.duration) return
      if (deck.element.duration - deck.element.currentTime < CROSSFADE + 0.5) this.crossfade(this.nextTrack(this.mood))
    }, 500)
  }

  // Each set of tracks takes turns.
  nextTrack(mood) {
    const name = MOODS[mood].tracks
    const tracks = AUDIO.music[name] ?? []
    return tracks[this.turn[name]++ % tracks.length]
  }

  crossfade(track, seconds = CROSSFADE) {
    if (!track) return
    const now = this.context.currentTime
    const next = this.live === 0 ? 1 : 0
    const incoming = this.decks[next], outgoing = this.decks[this.live]
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

  // Moving between screens drifts the music into that screen's mood.
  setMood(name) {
    if (!MOODS[name] || name === this.mood) return
    const before = MOODS[this.mood]
    this.mood = name
    if (!this.context) return
    this.musicLevel.gain.setTargetAtTime(this.musicGain(name), this.context.currentTime, 1)
    if (this.music && this.playing && MOODS[name].tracks !== before.tracks) this.crossfade(this.nextTrack(name), 3)
  }

  // The music steps back for a moment, so a fanfare can sing over it.
  duck(seconds = 4) {
    if (!this.context || !this.music) return
    const g = this.musicLevel.gain, now = this.context.currentTime
    g.cancelScheduledValues(now)
    g.setTargetAtTime(this.musicGain() * 0.3, now, 0.15)
    g.setTargetAtTime(this.musicGain(), now + seconds, 1.2)
  }

  setMusic(on) {
    this.music = on
    if (on && !this.musicVolume) this.musicVolume = 0.8
    this.save()
    if (!this.context) return
    this.musicLevel.gain.setTargetAtTime(this.musicGain(), this.context.currentTime, 0.5)
    if (on && !this.playing) this.startMusic()
    if (!on) {
      // fade out, then rest the decks
      clearTimeout(this.resting)
      this.resting = setTimeout(() => {
        if (this.music) return
        this.playing = false
        clearInterval(this.watch)
        for (const deck of this.decks) deck.element.pause()
      }, 2500)
    }
  }

  setEffects(on) {
    this.effects = on
    if (on && !this.effectsVolume) this.effectsVolume = 0.8
    this.save()
  }

  // The Settings sliders. Sliding to nothing switches that sound off; sliding up
  // switches it back on.
  setMusicVolume(volume) {
    this.musicVolume = Math.min(1, Math.max(0, volume))
    if ((this.musicVolume > 0) !== this.music) this.setMusic(this.musicVolume > 0)
    else {
      this.save()
      if (this.context) this.musicLevel.gain.setTargetAtTime(this.musicGain(), this.context.currentTime, 0.1)
    }
  }

  setEffectsVolume(volume) {
    this.effectsVolume = Math.min(1, Math.max(0, volume))
    this.effects = this.effectsVolume > 0
    this.save()
    if (this.context) this.fxLevel.gain.setTargetAtTime(0.9 * this.effectsVolume, this.context.currentTime, 0.05)
  }

  // Plays a named effect now, or `at` seconds from now.
  play(name, { at = 0 } = {}) {
    if (!this.effects || !this.context) return
    if (this.context.state === 'suspended') this.context.resume()
    const buffer = this.buffers.get(name)
    if (!buffer) return
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.fxLevel)
    source.start(this.context.currentTime + at)
  }
}
