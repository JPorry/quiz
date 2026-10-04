import test from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES, pickLanguage, setLanguage, t, gardenName, chapterName, chapterIntro, language } from '../src/i18n.js'
import { EN } from '../src/locales/en.js'
import { GARDEN_NAMES, CHAPTERS } from '../src/game.js'

const memoryStorage = () => {
  const items = new Map()
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) }
}
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

test('every language translates every string, keeping its placeholders', () => {
  for (const [code, { strings }] of Object.entries(LANGUAGES)) {
    for (const [key, english] of Object.entries(EN)) {
      assert.equal(typeof strings[key], 'string', `${code} has ${key}`)
      assert.deepEqual(placeholders(strings[key]), placeholders(english), `${code} ${key} keeps its placeholders`)
    }
  }
})

test('Spanish names every garden and chapter', () => {
  const { strings } = LANGUAGES.es
  assert.equal(strings.gardens.length, GARDEN_NAMES.length)
  assert.equal(new Set(strings.gardens).size, strings.gardens.length, 'every garden name is its own')
  assert.equal(strings.chapters.length, CHAPTERS.length)
  CHAPTERS.forEach((chapter, i) => { if (chapter.intro) assert.ok(strings.chapters[i].intro, `${chapter.name} has an intro`) })
})

test('the language follows the device the first time, then the player\'s choice', () => {
  assert.equal(pickLanguage(memoryStorage(), ['es-ES', 'en']), 'es')
  assert.equal(pickLanguage(memoryStorage(), ['fr-FR', 'en-GB']), 'en')
  assert.equal(pickLanguage(memoryStorage(), ['fr-FR']), 'en')
  const storage = memoryStorage()
  storage.setItem('tidal-garden.language', 'en')
  assert.equal(pickLanguage(storage, ['es-ES']), 'en')
})

test('strings fill in their values, in the chosen language', () => {
  const before = language()
  setLanguage('es', memoryStorage())
  assert.equal(t('map.garden', { n: 4 }), 'Jardín 4')
  assert.equal(gardenName(0), 'Primera luz')
  assert.equal(chapterName(1), 'Las Aldeas')
  assert.ok(chapterIntro(1).startsWith('Cada letrero'))
  setLanguage('en', memoryStorage())
  assert.equal(t('map.garden', { n: 4 }), 'Garden 4')
  assert.equal(gardenName(0), GARDEN_NAMES[0])
  assert.equal(t('no.such.key'), 'no.such.key')
  setLanguage(before, memoryStorage())
})
