// The game's words, in every language it speaks. Each language is a dictionary of named strings
// (src/locales/), where {name} marks a value filled in when the string is used. English is the
// fallback for anything a language hasn't translated yet. The chosen language is remembered; the
// first visit follows the device's own language.
import { EN } from './locales/en.js'
import { ES } from './locales/es.js'

export const LANGUAGES = {
  en: { name: 'English', strings: EN },
  es: { name: 'Español', strings: ES },
}
const STORAGE_KEY = 'tidal-garden.language'

// The saved choice, or else the first of the device's languages the game speaks, or else English.
export function pickLanguage(storage = globalThis.localStorage, preferred = globalThis.navigator?.languages ?? []) {
  try {
    const saved = storage?.getItem(STORAGE_KEY)
    if (saved && LANGUAGES[saved]) return saved
  } catch { /* Fine without. */ }
  for (const tag of preferred) {
    const code = String(tag).toLowerCase().split('-')[0]
    if (LANGUAGES[code]) return code
  }
  return 'en'
}

let current = pickLanguage()
export const language = () => current

export function setLanguage(code, storage = globalThis.localStorage) {
  if (!LANGUAGES[code]) return
  current = code
  try { storage?.setItem(STORAGE_KEY, code) } catch { /* Fine without. */ }
}

// A string by its key, with {name} placeholders filled from params.
export function t(key, params = {}) {
  const text = LANGUAGES[current].strings[key] ?? EN[key]
  if (text === undefined) return key
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match))
}

// "water" or "land" for a tile's value, and the same as a piece's name.
export const terrain = (value) => t(value === 0 ? 'terrain.water' : 'terrain.land')
export const pieceName = (value) => t(value === 0 ? 'piece.water' : 'piece.land')
