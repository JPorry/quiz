// The game's words, in every language it speaks. Each language is a dictionary of named strings
// (src/locales/), where {name} marks a value filled in when the string is used. English is the
// fallback for anything a language hasn't translated yet. The chosen language is remembered; the
// first visit follows the device's own language when the game speaks it.
import { EN } from './locales/en.js'

export const LANGUAGES = {
  en: { name: 'English', strings: EN },
}
const STORAGE_KEY = 'flower-patch.language'

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
