import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GardenAudio, EFFECTS, MOODS, PENTATONIC, PROGRESSION, CHORD_LENGTH, melodyFor, random } from '../src/audio.js'

const memoryStorage = () => {
  const items = new Map()
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) }
}

test('the melody only ever wanders through the pentatonic scale, gently, inside its chord', () => {
  const rng = random(1)
  for (let chord = 0; chord < 400; chord++) {
    const notes = melodyFor(rng, MOODS.map.notes)
    assert.ok(notes.length >= MOODS.map.notes[0] && notes.length <= MOODS.map.notes[1])
    let last = null
    for (const [time, note] of notes) {
      assert.ok(PENTATONIC.includes(note), `${note} is in F major pentatonic`)
      assert.ok(time > 0 && time < CHORD_LENGTH - 0.5, 'notes fall inside their chord')
      if (last !== null) assert.ok(Math.abs(PENTATONIC.indexOf(note) - PENTATONIC.indexOf(last)) <= 2, 'small steps, never big leaps')
      last = note
    }
  }
})

test('every chord in the progression belongs to F major, so the melody never clashes', () => {
  const fMajor = new Set([5, 7, 9, 10, 0, 2, 4])
  for (const chord of PROGRESSION) for (const note of [chord.bass, ...chord.pad]) assert.ok(fMajor.has(note % 12), `${note} is in F major`)
})

test('the game is calmer than the menus, and only the evening has crickets', () => {
  assert.ok(MOODS.play.melody < MOODS.title.melody && MOODS.play.notes[1] < MOODS.map.notes[1])
  assert.deepEqual(Object.entries(MOODS).filter(([, mood]) => mood.crickets).map(([name]) => name), ['evening'])
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

test('every sound the game asks for exists', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const asked = new Set([...source.matchAll(/(?:audio\.play|clueSound)\('([\w-]+)'/g)].map((match) => match[1]))
  for (const name of ['place-water', 'place-land', 'place-erase', 'water', 'land', 'erase']) asked.add(name)
  for (const name of asked) assert.equal(typeof EFFECTS[name], 'function', `${name} is a sound`)
  assert.ok(asked.size >= 20)
})

test('without a tap yet, nothing tries to make a sound', () => {
  const audio = new GardenAudio({ storage: null })
  assert.doesNotThrow(() => { audio.play('tap'); audio.setMood('play'); audio.setMusic(true) })
  assert.equal(audio.context, undefined)
})
