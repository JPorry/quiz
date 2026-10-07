import test from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES, pickLanguage, setLanguage, t, language } from '../src/i18n.js'
import { EN } from '../src/locales/en.js'
import { gardenName } from '../src/daily.js'

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
  assert.equal(t('days.cell', { n: 2 }), '2 de 3 en equilibrio')
  assert.equal(t('tier.hard'), 'Difícil')
  assert.equal(gardenName(1, 'easy'), gardenName(1, 'easy', 'es'), 'garden names follow the language')
  setLanguage('en', memoryStorage())
  assert.equal(t('days.cell', { n: 2 }), '2 of 3 in balance')
  assert.equal(gardenName(1, 'easy'), gardenName(1, 'easy', 'en'))
  assert.equal(t('no.such.key'), 'no.such.key')
  setLanguage(before, memoryStorage())
})
