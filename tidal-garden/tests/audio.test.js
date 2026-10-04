import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { GardenAudio, MOODS, effectFile } from '../src/audio.js'
import { AUDIO } from '../src/audioManifest.js'

const file = (path) => new URL(`../public/${path}`, import.meta.url)
const memoryStorage = () => {
  const items = new Map()
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) }
}

test('every mood has music, and every track and effect file is there', () => {
  for (const [name, mood] of Object.entries(MOODS)) assert.ok(AUDIO.music[mood.tracks]?.length, `${name} has music`)
  for (const path of [...Object.values(AUDIO.music).flat(), ...Object.values(AUDIO.effects)]) {
    assert.ok(existsSync(file(path)), `${path} exists`)
    assert.ok(statSync(file(path)).size > 2000, `${path} isn't empty`)
  }
})

test('the garden is the quietest music, so it never distracts', () => {
  assert.ok(Object.values(MOODS).every((mood) => mood.level >= MOODS.play.level))
})

test('every sound the game asks for exists, in every pitched variant', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const asked = new Set([...source.matchAll(/(?:audio\.play|clueSound)\('([\w-]+)'/g)].map((match) => match[1]))
  for (const name of ['place-water', 'place-land', 'place-erase', 'water', 'land', 'erase']) asked.add(name)
  assert.ok(asked.size >= 20)
  for (const name of asked) {
    for (let k = 0; k < 7; k++) {
      const variant = effectFile(name, { level: k, row: k, col: 0 })
      assert.ok(AUDIO.effects[variant], `${variant} is a sound`)
    }
  }
})

test('placements play a little tune across a row, and map stops climb with their number', () => {
  assert.deepEqual([0, 1, 2].map((col) => effectFile('place-water', { row: 0, col })), ['place-water-0', 'place-water-1', 'place-water-2'])
  assert.equal(effectFile('select', { level: 8 }), 'select-1')
  assert.equal(effectFile('tap'), 'tap')
})

test('music and sound effect switches are remembered', () => {
  const storage = memoryStorage()
  const audio = new GardenAudio({ storage })
  assert.equal(audio.music, true)
  assert.equal(audio.effects, true)
  audio.setMusic(false)
  audio.setEffects(false)
  const again = new GardenAudio({ storage })
  assert.equal(again.music, false)
  assert.equal(again.effects, false)
})

test('without a tap yet, nothing tries to make a sound', () => {
  const audio = new GardenAudio({ storage: null })
  assert.doesNotThrow(() => { audio.play('tap'); audio.setMood('play'); audio.setMusic(true) })
  assert.equal(audio.context, undefined)
})

test('the volume sliders are remembered, and sliding to nothing switches a sound off', () => {
  const storage = memoryStorage()
  const audio = new GardenAudio({ storage })
  audio.setMusicVolume(0.4)
  audio.setEffectsVolume(0)
  const again = new GardenAudio({ storage })
  assert.equal(again.musicVolume, 0.4)
  assert.ok(again.music)
  assert.equal(again.effects, false)
  assert.equal(again.musicGain('play'), MOODS.play.level * 0.4)
  again.setEffects(true)
  assert.ok(again.effectsVolume > 0, 'switching back on brings the volume back')
  again.setMusicVolume(0)
  assert.equal(again.music, false)
  assert.equal(again.musicGain(), 0)
})
