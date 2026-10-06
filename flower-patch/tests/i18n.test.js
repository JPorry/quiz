import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES } from '../src/i18n.js'
import { EN } from '../src/locales/en.js'

const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

test('every language has every string, with the same placeholders', () => {
  for (const [code, { strings }] of Object.entries(LANGUAGES)) {
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(EN).sort(), code)
    for (const key of Object.keys(EN)) assert.deepEqual(holes(strings[key]), holes(EN[key]), `${code} ${key}`)
  }
})

test('the game speaks Spanish', () => {
  assert.equal(LANGUAGES.es.name, 'Español')
})
