// Tidal Garden's music and sound effects. The audio files are composed and rendered by
// scripts/compose-audio.py: calm music on real sampled instruments over a bed of waves, birdsong,
// and crickets, and cute sound effects pitched in the same key.
//
// Music streams through two decks that crossfade between tracks and moods; effects are decoded
// once and play instantly. Browsers only allow sound after a tap, so everything waits for one.
import { AUDIO } from './audioManifest.js'

// Each screen's music, and how loud it sits: the garden is the quietest, so it never distracts.
export const MOODS = {
  title: { tracks: 'title', level: 1 },
  map: { tracks: 'map', level: 0.95 },
  play: { tracks: 'garden', level: 0.62 },
  evening: { tracks: 'evening', level: 0.9 },
}
const CROSSFADE = 4
const PREFERENCES = 'tidal-garden.audio'

// Effects that come in pitched variants, and which variant a given moment plays: a garden's number
// on the map, or where a tile lands, so filling a row plays a little tune.
export function effectFile(name, { level = 0, row = 0, col = 0 } = {}) {
  if (name === 'select') return `select-${level % 7}`
  if (name === 'place-water' || name === 'place-land') return `${name}-${(row + col) % 7}`
  return name
}

export class GardenAudio {
  constructor({ storage = globalThis.localStorage, base = '' } = {}) {
    this.storage = storage
    this.base = base
    this.music = true
    this.effects = true
    // How loud each one plays, from 0 to 1, set in Settings.
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
    } catch { /* Preferences are a nicety. */ }
    this.mood = 'title'
    this.buffers = new Map()
    this.decks = []
    this.turn = { title: 0, map: 0, play: 0, evening: 0 }
  }

  save() {
    try { this.storage?.setItem(PREFERENCES, JSON.stringify({ music: this.music, effects: this.effects, musicVolume: this.musicVolume, effectsVolume: this.effectsVolume })) } catch { /* Fine without. */ }
  }

  // The music's loudness for a mood, with the player's volume and the music switch.
  musicGain(mood = this.mood) { return this.music ? MOODS[mood].level * this.musicVolume : 0 }

  // The first tap or key wakes everything up: the mixer, the effects, and the music decks.
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
      deck.element.src = this.url(AUDIO.music[MOODS[this.mood].tracks][0])
      deck.element.play()?.then(() => { if (deck !== this.decks[this.live] || !this.music) deck.element.pause() }, () => {})
    }
    this.loadEffects()
    if (this.music) this.startMusic()
  }

  url(path) { return `${this.base}${path}` }

  // Effects are small, so they're all fetched and decoded up front.
  loadEffects() {
    for (const [name, path] of Object.entries(AUDIO.effects)) {
      fetch(this.url(path))
        .then((response) => response.arrayBuffer())
        .then((data) => this.context.decodeAudioData(data))
        .then((buffer) => this.buffers.set(name, buffer), () => {})
    }
  }

  // Plays the current mood's music on a deck, fading it in and the other deck out.
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

  // Each mood takes turns through its tracks.
  nextTrack(mood) {
    const tracks = AUDIO.music[MOODS[mood].tracks] ?? []
    const track = tracks[this.turn[mood] % tracks.length]
    this.turn[mood]++
    return track
  }

  crossfade(track, seconds = CROSSFADE) {
    if (!track) return
    const now = this.context.currentTime
    const next = this.live === 0 ? 1 : 0
    const incoming = this.decks[next], outgoing = this.decks[this.live]
    incoming.track = track
    incoming.element.src = this.url(track)
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

  setMusic(on) {
    this.music = on
    if (on && !this.musicVolume) this.musicVolume = 0.8
    this.save()
    if (!this.context) return
    this.musicLevel.gain.setTargetAtTime(this.musicGain(), this.context.currentTime, 0.5)
    if (on && !this.playing) this.startMusic()
    if (!on) {
      // Fade out, then rest the decks.
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
    if (on && !this.effectsVolume) {
      this.effectsVolume = 0.8
      if (this.context) this.fxLevel.gain.setTargetAtTime(0.9 * this.effectsVolume, this.context.currentTime, 0.05)
    }
    this.save()
  }

  // The Settings sliders. Sliding to nothing switches that sound off; sliding up switches it on.
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
  play(name, options = {}) {
    if (!this.effects || !this.context) return
    if (this.context.state === 'suspended') this.context.resume()
    const buffer = this.buffers.get(effectFile(name, options))
    if (!buffer) return
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.fxLevel)
    source.start(this.context.currentTime + (options.at ?? 0))
  }
}
