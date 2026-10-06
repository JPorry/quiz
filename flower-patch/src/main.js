import { TIERS, TUTORIAL, puzzle, today, dayOf, dateOf } from './puzzles.js'
import { assignFlowers, bedComplete, buildBoard, conflicts, isSolved, MAX_SEED } from './logic.js'
import { GardenScene } from './scene.js'
import { GardenAudio } from './audio.js'
import { Tutorial } from './tutorial.js'
import { t, LANGUAGES, language, setLanguage } from './i18n.js'
import { PIPS, NUM } from './flowers.js'
import './style.css'

// Flower Patch is a daily puzzle: every day brings an easy, a medium and a hard
// garden to plant. The home screen shows today's three and a calendar keeps every
// earlier day, so missed ones can be played any time. Progress is kept per garden.
const STORAGE_KEY = 'flower-patch.v2'
const tierName = (tier) => t(`pool.${tier}`)
// dates and months start with a capital, as headings (Spanish writes them in lower case)
const capital = (text) => text.charAt(0).toLocaleUpperCase(language()) + text.slice(1)
const longDate = (day) => capital(dateOf(day).toLocaleDateString(language(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))

const ICON = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  learn: '<path d="M3 9.5 12 5l9 4.5-9 4.5z"/><path d="M7 11.5v4.5c3 2 7 2 10 0v-4.5M21 9.5v5"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5c4-2 7 2 12 0v8c-5 2-8-2-12 0" fill="currentColor" fill-opacity=".25"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.7 1 2.8 2.2 3.2C11 9 10.8 6 12 3z"/>',
  flower: '<circle cx="12" cy="7" r="3.2"/><circle cx="17" cy="11" r="3.2"/><circle cx="15" cy="16.5" r="3.2"/><circle cx="9" cy="16.5" r="3.2"/><circle cx="7" cy="11" r="3.2"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  trowel: '<path d="M12.5 11.5 20 4"/><path d="M12.8 7.2 5 9.5c-1.6.5-2 2.5-.9 3.7l6.7 6.7c1.2 1.1 3.2.7 3.7-.9l2.3-7.8z"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`
const hex = (n) => '#' + n.toString(16).padStart(6, '0')
const blend = (a, b, k) => {
  const ch = (v, s) => (v >> s) & 255
  const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k) << s
  return m(16) | m(8) | m(0)
}
// A little bag of seeds, drawn like a sticker: a chubby cloth sack in the
// seed's own soft colour with a soft sheen, a scalloped frill gathered at the
// neck with a ribbon bow, a seedling peeking out of the top, and a round
// stitched tag on the front showing the die face.
const bag = (n) => {
  const c = NUM[n], pale = n === 6
  const body = hex(pale ? 0xfffdf8 : blend(c, 0xffffff, 0.3))
  const light = hex(pale ? 0xffffff : blend(c, 0xffffff, 0.72))
  const deep = hex(pale ? 0xeee3cf : blend(c, 0x8a4a6a, 0.14))
  const frill = hex(pale ? 0xffffff : blend(c, 0xffffff, 0.55))
  const line = hex(pale ? 0xb7a585 : blend(c, 0x5a3a3a, 0.5))
  const ribbon = n === 1 ? '#fff0d4' : '#ff8fb8'
  const ribbonLine = n === 1 ? line : '#c9567f'
  const dot = hex(pale ? 0xe0c27a : blend(c, 0x8a4a6a, 0.1))
  return `<svg class="bag" viewBox="0 0 48 60" aria-hidden="true">
    <defs><radialGradient id="bag${n}" cx="36%" cy="34%" r="75%"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${body}"/><stop offset="1" stop-color="${deep}"/></radialGradient></defs>
    <ellipse cx="24" cy="57" rx="15" ry="2.6" fill="#2f5a25" opacity=".16"/>
    <g class="sprout"><path d="M24 16 C24 12 24 10 24 8" stroke="#5fae4b" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M24 9 C20 4 15 6 15.5 9 C16 12 21 11 24 9Z" fill="#86d464" stroke="#3f7a35" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M24 8.5 C27 3 33 4.5 32.6 7.8 C32.2 11 27 10.6 24 8.5Z" fill="#a6e67c" stroke="#3f7a35" stroke-width="1.1" stroke-linejoin="round"/></g>
    <path d="M15 22 C8 28 5 38 6 46 C7 54 15 57 24 57 C33 57 41 54 42 46 C43 38 40 28 33 22 Z" fill="url(#bag${n})" stroke="${line}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M17.5 24 C14 30 12.5 36 12.5 41 M30.5 24 C34 30 35.5 36 35.5 41" stroke="${line}" stroke-opacity=".22" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <ellipse cx="13.6" cy="34" rx="2.4" ry="5" fill="#fff" opacity=".55" transform="rotate(18 13.6 34)"/>
    <circle cx="15.6" cy="27.6" r="1.2" fill="#fff" opacity=".7"/>
    <path class="frill" d="M13.5 22 C10 18.5 12 13.5 16 15.4 C16.4 10.8 21.4 10.4 22 14 C23.4 10 28 10.2 27.6 14.1 C29 10.6 33.8 11.4 32.6 15.6 C36.4 14 38.4 18.6 34.5 22 Z" fill="${frill}" stroke="${line}" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M17 18 C17.5 19.5 18 20.5 19 21.5 M24.6 17 C24.6 18.5 24.6 20 24.6 21.6 M31 18 C30.6 19.5 30 20.5 29.2 21.5" stroke="${line}" stroke-opacity=".28" stroke-width="1" stroke-linecap="round" fill="none"/>
    <path d="M13.8 22.4 Q24 26.4 34.2 22.4" stroke="${ribbonLine}" stroke-width="4.4" stroke-linecap="round" fill="none"/>
    <path d="M13.8 22.4 Q24 26.4 34.2 22.4" stroke="${ribbon}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M24 24.6 C20 20 14.8 21.6 16.6 25.4 C18 28.2 22 26.6 24 24.6Z M24 24.6 C28 20 33.2 21.6 31.4 25.4 C30 28.2 26 26.6 24 24.6Z" fill="${ribbon}" stroke="${ribbonLine}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M22.6 25.6 L20.4 30.4 M25.4 25.6 L27.6 30.4" stroke="${ribbonLine}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M22.6 25.6 L20.4 30.4 M25.4 25.6 L27.6 30.4" stroke="${ribbon}" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="24" cy="24.8" r="2.1" fill="${ribbon}" stroke="${ribbonLine}" stroke-width="1"/>
    <circle cx="24" cy="42" r="10.4" fill="#fffdf7" stroke="${line}" stroke-width="1.2"/>
    <circle cx="24" cy="42" r="8.4" fill="none" stroke="${line}" stroke-opacity=".35" stroke-width=".9" stroke-dasharray="1.6 1.5"/>
    <g transform="translate(24 42) scale(6.6)">${PIPS[n].map(([x, z]) => `<circle cx="${x * 2.2}" cy="${z * 2.2}" r="${n === 1 ? 0.36 : 0.25}" fill="${dot}"/>`).join('')}</g>
  </svg>`
}
// A marker flag, drawn to match the bags: a little pennant in the seed's colour
// on a wooden stake, with its number on it, stuck in a mound of soil.
const flagSvg = (n) => {
  const c = NUM[n], pale = n === 6
  const body = hex(pale ? 0xfffdf8 : blend(c, 0xffffff, 0.2))
  const light = hex(pale ? 0xffffff : blend(c, 0xffffff, 0.6))
  const line = hex(pale ? 0xb7a585 : blend(c, 0x5a3a3a, 0.5))
  return `<svg class="bag marker" viewBox="0 0 48 60" aria-hidden="true">
    <ellipse cx="24" cy="57" rx="15" ry="2.6" fill="#2f5a25" opacity=".16"/>
    <path d="M9 56 C10 50 20 48 24 48 C28 48 38 50 39 56 Z" fill="#a8774f" stroke="#7a5236" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="17" cy="52.5" r="1" fill="#7a5236" opacity=".5"/><circle cx="30" cy="51.5" r="1.1" fill="#7a5236" opacity=".5"/>
    <g class="cloth">
      <path d="M13 9 C20 6 26 11 33 8 C36 7 39 7 41 8 L41 33 C38 32 35 32 32 33 C25 36 19 31 13 33 Z" fill="${body}" stroke="${line}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M15.5 12 C20 10 24 13 29 11" stroke="${light}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".9"/>
      <text x="27.5" y="27.5" text-anchor="middle" font-family="Fredoka, Nunito, ui-rounded, sans-serif" font-weight="700" font-size="17" fill="#3e3a4a">${n}</text>
    </g>
    <path d="M13 6 L13 51" stroke="#8a5a3b" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M13 6 L13 51" stroke="#c89a68" stroke-width="2" stroke-linecap="round"/>
    <circle cx="13" cy="5.5" r="2.8" fill="#fff3dc" stroke="#8a5a3b" stroke-width="1.1"/>
  </svg>`
}
// seeds that hop out of the bag when it is picked
const seeds = (n) => `<span class="seeds" aria-hidden="true">${[0, 1, 2, 3].map((k) => `<i style="--k:${k};background:${hex(blend(NUM[n], 0x8a5a3b, 0.25))}"></i>`).join('')}</span>`

document.querySelector('#app').innerHTML = `
  <div class="app" id="shell" data-screen="home">
    <main class="home" id="home">
      <header class="homehead">
        <div class="brand">
          <h1 class="title" aria-label="${t('title')}">${[...t('title')].map((c, i) => (c === ' ' ? '<span class="gap"></span>' : `<span style="--i:${i}">${c}</span>`)).join('')}</h1>
          <p class="date" id="date"></p>
        </div>
        <button class="round" id="settings-home" aria-label="${t('header.settings')}">${icon('settings')}</button>
      </header>
      <div class="chips">
        <span class="tag-chip streak" id="streak"></span>
        <span class="tag-chip blooms" id="blooms"></span>
      </div>
      <div class="todays" id="todays"></div>
      <footer class="homefoot">
        <p class="hello" id="hello"></p>
        <button class="chip daysbutton" id="open-days">${icon('calendar')}<span>${t('home.earlier')}</span><b class="count" id="catchup" hidden></b></button>
      </footer>
    </main>
    <section class="dayspage" id="dayspage">
      <header class="dayshead">
        <button class="round" id="days-back" aria-label="${t('back.home')}">${icon('back')}</button>
        <div class="titles"><h1>${t('days.title')}</h1><p id="dayssummary"></p></div>
      </header>
      <div class="months" id="months"></div>
      <div class="picker" id="daysheet" hidden>
        <div class="sheet">
          <div class="sheethead"><h2 id="sheetdate"></h2><button class="round" id="sheetclose" aria-label="${t('close')}">${icon('close')}</button></div>
          <div class="cards" id="cards"></div>
        </div>
      </div>
    </section>
    <div class="game" id="game">
      <header>
        <button class="round" id="back" aria-label="${t('back')}">${icon('back')}</button>
        <div class="titles"><h1 id="name"></h1><p id="prog"></p></div>
        <button class="round restart" id="restart" aria-label="${t('restart')}">${icon('restart')}<span class="sure" aria-hidden="true">${t('restart.sure')}</span></button>
        <button class="round" id="settings" aria-label="${t('header.settings')}">${icon('settings')}</button>
      </header>
      <section class="coach" id="coach" aria-live="polite" hidden>
        <p class="coach-title" id="coach-title"></p>
        <p class="coach-text" id="coach-text"></p>
        <div class="coach-foot">
          <p class="coach-instruction" id="coach-instruction"></p>
          <button class="coach-skip" id="coach-skip">${t('coach.skip')}</button>
          <button class="coach-next" id="coach-next"></button>
        </div>
      </section>
      <div class="stage" id="stage"></div>
      <footer>
        <div class="tray" id="tray" role="group" aria-label="${t('tray')}"></div>
        <div class="row">
          <button class="chip" id="undo">${icon('undo')}<span>${t('undo')}</span></button>
          <button class="chip dig" id="dig" data-seed="0" aria-label="${t('dig.label')}" aria-pressed="false">${icon('trowel')}<span>${t('dig')}</span></button>
          <button class="chip markers" id="markers" aria-pressed="false">${icon('flag')}<span>${t('markers')}</span></button>
        </div>
      </footer>
      <section class="win" id="win" hidden>
        <h2>${t('win.title')}</h2>
        <p id="winmeta"></p>
        <div class="row">
          <button class="chip" id="winhome">${t('win.home')}</button>
          <button class="chip go" id="winnext">${t('win.next')}</button>
        </div>
      </section>
    </div>
    <section class="picker" id="settingsheet" hidden>
      <div class="sheet settings" role="dialog" aria-labelledby="settingstitle">
        <div class="sheethead"><h2 id="settingstitle">${t('settings.title')}</h2><button class="round" id="closesettings" aria-label="${t('close')}">${icon('close')}</button></div>
        <div class="setting"><label for="musicvol">${icon('music')}<span>${t('settings.music')}</span></label><input type="range" id="musicvol" min="0" max="100" step="5"><output id="musicval"></output></div>
        <div class="setting"><label for="fxvol">${icon('sound')}<span>${t('settings.effects')}</span></label><input type="range" id="fxvol" min="0" max="100" step="5"><output id="fxval"></output></div>
        <div class="setting"><label for="language">${icon('globe')}<span>${t('settings.language')}</span></label><select id="language">${Object.entries(LANGUAGES).map(([code, { name }]) => `<option value="${code}" lang="${code}"${code === language() ? ' selected' : ''}>${name}</option>`).join('')}</select></div>
        <p class="note">${t('settings.languageNote')}</p>
        <button class="chip replay" id="replay-tutorial">${icon('learn')}<span>${t('settings.replay')}</span></button>
        <button class="chip go" id="settingsdone">${t('settings.done')}</button>
      </div>
    </section>
  </div>`
const $ = (id) => document.getElementById(id)

// done: every garden solved, by id ("<day>-<tier>"); plots: what is planted so
// far in gardens still being worked on, one character a cell.
function loadSaved() {
  const empty = { done: {}, plots: {}, flags: {} }
  try { return { ...empty, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } } catch { return empty }
}
const saved = loadSaved()
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* private windows */ } }

const sounds = new GardenAudio()
const tutorial = new Tutorial()
document.documentElement.lang = language()
const scene = new GardenScene($('stage'))
let current = null // the garden being played
let board, flowers, values, marks, history, won, seed, complete, shown = 0
// marking: the tray holds flags rather than seeds, and tapping a plot sticks a
// flag in it (or pulls it out again) instead of planting
let marking = false
// a plot's flags are a bit each, 1 to 6; saved as one character a plot
const packMarks = (m) => String.fromCharCode(...Array.from(m, (v) => 48 + v))
const hasMarks = (m) => m.some((v) => v)

const buzz = (pattern) => { try { navigator.vibrate?.(pattern) } catch { /* not allowed here */ } }
const biggest = () => Math.max(...board.size)

// each garden's flowers are the same every time it is opened
const flowersFor = (p, b) => assignFlowers(b, p.day * 3 + TIERS.indexOf(p.tier) + 5)

// The tutorial is a garden of its own, always played from scratch.
const isTutorial = () => current?.id === TUTORIAL.id

function start(day, tier, { fresh = false } = {}) {
  current = day === 0 ? { ...TUTORIAL, name: t('tutorial.name') } : puzzle(day, tier)
  if (day === 0) fresh = true
  board = buildBoard(current)
  flowers = flowersFor(current, board)
  values = Int8Array.from(board.givens)
  // pick up where the player left off
  const plot = saved.plots[current.id]
  if (plot?.length === board.cells && !fresh) {
    ;[...plot].forEach((ch, i) => { if (!board.givens[i] && ch !== '.') values[i] = Math.min(MAX_SEED, Number(ch)) })
  }
  marks = new Uint8Array(board.cells)
  const flags = saved.flags?.[current.id]
  if (flags?.length === board.cells && !fresh) [...flags].forEach((ch, i) => { if (!values[i]) marks[i] = (ch.charCodeAt(0) - 48) & 63 })
  history = []
  // a garden already solved opens in bloom, unless it is being played again
  won = !fresh && !plot && Boolean(saved.done[current.id])
  if (won) { values = Int8Array.from(board.solution); marks.fill(0) }
  complete = new Set()
  seed = Math.min(seed ?? 1, biggest())
  marking = false
  $('win').hidden = true
  $('game').dataset.tier = tier
  $('name').textContent = current.name
  tutorial.forget()
  scene.load(board, flowers, [...board.givens.keys()].filter((i) => board.givens[i]), { seed: day * 3 + TIERS.indexOf(tier) })
  drawTray()
  refresh(true)
  if (won) scene.celebrate()
  // the music relaxes into the garden, or brightens for one in bloom
  sounds.setMood(won ? 'bloom' : 'garden')
}

function drawTray() {
  const top = biggest()
  $('tray').dataset.mode = marking ? 'flags' : 'seeds'
  $('tray').setAttribute('aria-label', t(marking ? 'tray.flags' : 'tray'))
  $('tray').innerHTML = Array.from({ length: top }, (_, k) => k + 1).map((n) =>
    `<button class="packet" data-seed="${n}" aria-label="${t(marking ? 'flag' : 'seed', { n })}" aria-pressed="${n === seed}">${marking ? flagSvg(n) : bag(n) + seeds(n)}<span>${n}</span></button>`).join('')
  $('dig').setAttribute('aria-pressed', String(seed === 0))
  $('dig').setAttribute('aria-label', t(marking ? 'dig.flags' : 'dig.label'))
  $('markers').setAttribute('aria-pressed', String(marking))
}

// Swaps the tray between seed bags and marker flags; the number picked stays.
function toggleMarking() {
  marking = !marking
  drawTray()
  $('tray').classList.remove('swap')
  void $('tray').offsetWidth
  $('tray').classList.add('swap')
  sounds.play(marking ? 'open' : 'close')
  buzz(6)
  coach()
}

/* ---------- the tutorial ---------- */
// A card above the garden says what to do: the bag, flag or button to pick
// bounces, the plot to tap glows gold, and the plots that decide it wear cream
// frames. It ends when the player says so, skips it, or the garden blooms.
function coach() {
  if (!current) return
  const card = isTutorial() ? tutorial.card({ board, values, marks, seed, marking, won }) : null
  const was = !$('coach').hidden
  $('coach').hidden = !card
  scene.showGuide(card?.target?.length || card?.because?.length ? card : null)
  for (const b of $('tray').children) b.classList.toggle('coach-pick', card?.pick === Number(b.dataset.seed))
  $('markers').classList.toggle('coach-pick', card?.pick === 'markers')
  if (!card) return
  if (!was) { $('coach').classList.remove('in'); void $('coach').offsetWidth; $('coach').classList.add('in') }
  $('coach').dataset.step = card.step
  $('coach-title').textContent = card.title
  $('coach-text').textContent = card.text
  $('coach-instruction').textContent = card.instruction ?? ''
  $('coach-next').textContent = card.action ?? ''
  $('coach-next').hidden = !card.action
  $('coach-skip').hidden = card.step === 'outro'
}
$('coach-next').onclick = () => { sounds.unlock(); sounds.play(tutorial.step === 'outro' ? 'close' : 'tap'); tutorial.next(); coach() }
// skipping goes straight on to the garden the player picked
$('coach-skip').onclick = () => { sounds.play('close'); tutorial.finish(); leaveTutorial() }

function choose(n) {
  seed = n
  for (const b of [...$('tray').children, $('dig')]) {
    const on = Number(b.dataset.seed) === n
    b.setAttribute('aria-pressed', String(on))
    // the picked bag hops, wiggles and tosses out a few seeds; the others let
    // go of their hop so they settle back down with the rest
    b.classList.remove('hop')
    if (on) { void b.offsetWidth; b.classList.add('hop') }
  }
  coach()
}

// Brings the garden in line with the seeds planted: what grows where, which
// beds are complete, and what the header says.
function refresh(quiet = false, origin = null) {
  const bad = conflicts(board, values)
  const nowComplete = new Set(board.beds.map((_, b) => b).filter((b) => bedComplete(board, values, b, bad)))
  const fresh = [...nowComplete].filter((b) => !complete.has(b))
  complete = nowComplete
  const stage = (i) => (won ? 'bloom' : complete.has(board.bedOf[i]) ? 'bud' : 'sprout')
  scene.setCells([...values].map((value, i) => ({ value, stage: stage(i), wilt: !won && bad.has(i) })), { quiet, origin })
  scene.setBeds(board.beds.map((_, b) => (won ? 1 : complete.has(b) ? 0.75 : 0)), { quiet, origin })
  scene.setFlags(marks, { quiet })
  // the count catches up as each budding bed sends its flower up to it
  if (quiet || complete.size < shown) shown = complete.size
  showProgress()
  $('undo').disabled = !history.length || won
  coach()
  if (!won && current && !isTutorial()) {
    saved.plots[current.id] = [...values].map((v) => v || '.').join('')
    saved.flags ??= {}
    if (hasMarks(marks)) saved.flags[current.id] = packMarks(marks)
    else delete saved.flags[current.id]
    save()
  }
  return { bad, fresh }
}

function showProgress() {
  const pool = isTutorial() ? t('tutorial.label') : `${tierName(current.tier)} · ${dayName(current.day)}`
  $('prog').textContent = t(won ? 'progress.won' : 'progress', { pool, shown, beds: board.beds.length })
}

// A little flower flies from a bed that has just budded up to the count, which
// ticks up with a bounce when it lands.
function flyFlower(i, color) {
  const from = scene.toScreen(i)
  const to = $('prog').getBoundingClientRect()
  const el = document.createElement('div')
  el.className = 'fly'
  el.innerHTML = `<svg viewBox="-10 -10 20 20" aria-hidden="true">${[0, 1, 2, 3, 4].map((k) => `<circle cx="${Math.cos(k * 1.2566 - 1.57) * 4.6}" cy="${Math.sin(k * 1.2566 - 1.57) * 4.6}" r="4.2" fill="${color}"/>`).join('')}<circle r="3.2" fill="#ffd34d"/></svg>`
  document.body.append(el)
  const dx = to.left + 20 - from.x, dy = to.top + to.height / 2 - from.y
  el.style.left = `${from.x - 16}px`
  el.style.top = `${from.y - 16}px`
  const flight = el.animate([
    { transform: 'translate(0, 0) scale(0.4) rotate(0deg)', opacity: 0 },
    { transform: `translate(${dx * 0.15}px, ${dy * 0.15 - 50}px) scale(1.5) rotate(120deg)`, opacity: 1, offset: 0.3 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.7) rotate(360deg)`, opacity: 1 },
  ], { duration: 850, easing: 'cubic-bezier(.5, 0, .3, 1)' })
  // the count ticks up when the flower lands, or soon anyway if the tab was hidden
  let landed = false
  const land = () => {
    if (landed) return
    landed = true
    el.remove()
    shown = Math.min(complete.size, shown + 1)
    showProgress()
    $('prog').classList.remove('pulse')
    void $('prog').offsetWidth
    $('prog').classList.add('pulse')
    sounds.tick(shown)
  }
  flight.onfinish = land
  setTimeout(land, 1200)
}

// Every plant that grows up pops with a note, climbing as the wave runs through
// its bed; the last one in a bed rings the bed's chime and sends a flower up.
scene.onSprout = (i, value) => sounds.sprout(value)
scene.onAwake = (i, value) => sounds.awake(value)
scene.onGust = (strength) => sounds.gust(strength)

scene.onPop = (i, stage, rank) => {
  if (stage === 'bloom') {
    const now = performance.now()
    if (now - lastBloom > 70) { lastBloom = now; sounds.bloom(bloomCount++) }
    return
  }
  const bed = board.bedOf[i]
  sounds.budPop(rank)
  buzz(8)
  if (rank === board.beds[bed].length - 1) {
    setTimeout(() => sounds.bed(board.beds[bed].length), 60)
    buzz([0, 15, 40, 25])
    flyFlower(i, '#' + NUM[values[i]].toString(16).padStart(6, '0'))
  }
}
let lastBloom = 0, bloomCount = 0

// Each move is undone in one go: every plot it touched, with its seed and flags
// as they were.
const snapshot = (cells) => cells.map((i) => [i, values[i], marks[i]])

function tap(i) {
  if (marking) mark(i)
  else plant(i)
}

// Sticks the picked flag in a plot, or pulls it out if it's already there. The
// trowel pulls every flag out of a plot.
function mark(i) {
  if (won) return
  if (values[i]) {
    scene.wobble(i)
    sounds.bonk()
    return
  }
  const bit = seed ? 1 << (seed - 1) : 0
  if (seed > board.size[i]) {
    scene.wobble(i)
    sounds.bonk()
    buzz([10, 40, 10])
    return
  }
  const next = seed ? marks[i] ^ bit : 0
  if (next === marks[i]) return
  history.push(snapshot([i]))
  marks[i] = next
  if (next & bit) { sounds.tick(seed); buzz(6) } else { sounds.dig(); buzz(6) }
  refresh(false, i)
}

function plant(i) {
  if (won) return
  if (board.givens[i]) {
    scene.wobble(i)
    sounds.bonk()
    return
  }
  const before = values[i]
  // tapping a plot with the packet's own seed digs it up again
  const next = seed === 0 || before === seed ? 0 : seed
  if (next === before) return
  if (next > board.size[i]) {
    scene.wobble(i)
    sounds.bonk()
    buzz([10, 40, 10])
    return
  }
  // planting a seed pulls the plot's flags, and that seed's flag from every
  // plot it now rules out: the rest of its bed and the plots around it
  const bit = next ? 1 << (next - 1) : 0
  const cleared = next ? board.peers[i].filter((j) => marks[j] & bit) : []
  history.push(snapshot([i, ...cleared]))
  values[i] = next
  if (next) {
    marks[i] = 0
    for (const j of cleared) marks[j] &= ~bit
  }
  if (next) { sounds.plant(next); buzz(10) } else { sounds.dig(); buzz(8); scene.puff(i) }
  const { bad } = refresh(false, i)
  if (next && bad.has(i)) sounds.droop()
  if (isSolved(board, values)) win()
}


function win() {
  won = true
  bloomCount = 0
  if (isTutorial()) tutorial.finish()
  else saved.done[current.id] = true
  delete saved.plots[current.id]
  if (saved.flags) delete saved.flags[current.id]
  marks.fill(0)
  save()
  refresh()
  scene.celebrate()
  sounds.win()
  setTimeout(() => {
    const kinds = new Set(flowers).size
    if (!current) return
    $('winmeta').textContent = isTutorial() ? t('win.tutorial') : t('win.meta', { beds: board.beds.length, kinds, name: current.name })
    const next = isTutorial() || nextGarden()
    $('winnext').hidden = !next
    $('winnext').textContent = t(isTutorial() ? 'win.play' : 'win.next')
    $('win').hidden = false
  }, 3200)
}

/* ---------- planting ---------- */
const canvas = scene.renderer.domElement
canvas.style.touchAction = 'none'
let down = null
canvas.addEventListener('pointerdown', (ev) => {
  sounds.unlock()
  down = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }
})
canvas.addEventListener('pointerup', (ev) => {
  if (!down || down.id !== ev.pointerId) return
  const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 14
  down = null
  if (moved) return
  const p = scene.toWorld(ev.clientX, ev.clientY)
  const i = p && scene.cellAt(p)
  if (i !== null && i !== undefined) tap(i)
  else if (scene.poke(ev.clientX, ev.clientY)) sounds.boing()
})
canvas.addEventListener('pointercancel', () => { down = null })

$('tray').onclick = $('dig').onclick = (ev) => {
  const b = ev.target.closest('[data-seed]')
  if (!b) return
  sounds.unlock()
  const n = Number(b.dataset.seed)
  choose(n)
  if (n) sounds.pick(n)
  else sounds.dig()
}
$('markers').onclick = () => { sounds.unlock(); toggleMarking() }

/* ---------- buttons ---------- */
$('winnext').onclick = () => {
  if (isTutorial()) return leaveTutorial()
  const next = nextGarden()
  if (next) location.hash = `#/${next.day}/${next.tier}`
}
$('winhome').onclick = () => { location.hash = '' }
$('back').onclick = () => { location.hash = backTo }
$('undo').onclick = () => {
  if (!history.length || won) return
  const move = history.pop()
  const [i] = move[0]
  const replanted = move.some(([j, value]) => value !== values[j])
  for (const [j, value, flags] of move) { values[j] = value; marks[j] = flags }
  sounds.undo()
  if (replanted) scene.puff(i)
  refresh(false, i)
}
// Restart asks first: the first tap arms it, and it says "Sure?" for a moment.
let armed = null
const disarm = () => { clearTimeout(armed); armed = null; $('restart').classList.remove('armed'); $('restart').setAttribute('aria-label', t('restart')) }
$('restart').onclick = () => {
  sounds.unlock()
  if (!armed) {
    $('restart').classList.add('armed')
    $('restart').setAttribute('aria-label', t('restart.sure'))
    sounds.play('tap')
    armed = setTimeout(disarm, 2400)
    return
  }
  disarm()
  delete saved.plots[current.id]
  if (saved.flags) delete saved.flags[current.id]
  save()
  start(current.day, current.tier, { fresh: true })
}
/* ---------- settings ---------- */
// How loud the music and the sound effects are, and the language. Sliding a sound to nothing
// turns it off; everything is remembered.
function showSettings() {
  for (const [id, out, value] of [['musicvol', 'musicval', sounds.musicVolume], ['fxvol', 'fxval', sounds.effectsVolume]]) {
    const v = Math.round(value * 100)
    $(id).value = v
    $(id).style.setProperty('--fill', `${v}%`)
    $(out).textContent = v ? `${v}%` : '—'
  }
}
function openSettings() {
  sounds.unlock()
  sounds.play('open')
  showSettings()
  $('settingsheet').hidden = false
}
function closeSettings() {
  sounds.play('close')
  $('settingsheet').hidden = true
}
$('settings').onclick = openSettings
$('settings-home').onclick = openSettings
$('closesettings').onclick = closeSettings
$('settingsdone').onclick = closeSettings
$('settingsheet').onclick = (ev) => { if (ev.target === $('settingsheet')) closeSettings() }
// The tutorial plays again from its welcome, in today's easy garden, cleared
// for it (a garden in bloom stays in bloom).
// The tutorial plays again from its welcome, in its own garden; afterwards
// the player is back where they were.
$('replay-tutorial').onclick = () => {
  closeSettings()
  tutorial.restart()
  afterTutorial = location.hash === '#/tutorial' ? afterTutorial : location.hash
  if (location.hash === '#/tutorial') route()
  else location.hash = '#/tutorial'
}
$('musicvol').oninput = (ev) => { sounds.unlock(); sounds.setMusicVolume(ev.target.value / 100); showSettings() }
$('fxvol').oninput = (ev) => { sounds.setEffectsVolume(ev.target.value / 100); showSettings() }
// letting go of the effects slider plays a little tap at the new loudness
$('fxvol').onchange = () => sounds.play('tap')
// a new language reloads the game in it, on the same screen with Settings open
$('language').onchange = (ev) => {
  setLanguage(ev.target.value)
  try { sessionStorage.setItem('flower-patch.reopen-settings', '1') } catch { /* Fine without. */ }
  location.reload()
}
addEventListener('keydown', (ev) => {
  if (!current) return
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z') return void $('undo').click()
  const n = Number(ev.key)
  if (ev.key >= '1' && ev.key <= '6' && n <= biggest()) choose(n)
  else if (ev.key === '0' || ev.key === 'Backspace') choose(0)
  else if (ev.key === 'm' || ev.key === 'f') toggleMarking()
})

/* ---------- the home screen ---------- */

const state = (id) => (saved.done[id] ? 'done' : saved.plots[id]?.match(/[1-9]/) || saved.flags?.[id] ? 'started' : 'new')
const dayName = (day) => (day === today() ? t('day.today') : day === today() - 1 ? t('day.yesterday') : dateOf(day).toLocaleDateString(language(), { day: 'numeric', month: 'short', timeZone: 'UTC' }))

// A little picture of a garden: its beds as soft patches of soil, green once in
// flower, and a dot of colour for every seed planted.
function miniMap(p) {
  const b = buildBoard(p)
  const done = saved.done[p.id]
  const plot = saved.plots[p.id]
  const vals = done ? b.solution : Int8Array.from(b.givens, (v, i) => v || (plot && plot[i] !== '.' ? Number(plot[i]) : 0))
  const bad = conflicts(b, vals)
  const s = 10
  const cells = [...Array(b.cells).keys()].map((i) => {
    const r = Math.floor(i / b.width), c = i % b.width
    const bed = b.bedOf[i]
    const edge = (rr, cc) => rr < 0 || rr >= b.height || cc < 0 || cc >= b.width || b.bedOf[rr * b.width + cc] !== bed
    const inset = (x) => (x ? 1.2 : 0)
    const x = c * s + inset(edge(r, c - 1)), y = r * s + inset(edge(r - 1, c))
    const w = s - inset(edge(r, c - 1)) - inset(edge(r, c + 1)), h = s - inset(edge(r - 1, c)) - inset(edge(r + 1, c))
    const full = done || bedComplete(b, vals, bed, bad)
    const dot = vals[i] ? `<circle cx="${c * s + s / 2}" cy="${r * s + s / 2}" r="${full ? 2.8 : 2}" fill="${hex(NUM[vals[i]])}"/>` : ''
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${full ? 'grown' : 'soil'}"/>${dot}`
  }).join('')
  return `<svg class="map" viewBox="-1 -1 ${b.width * s + 2} ${b.height * s + 2}" aria-hidden="true">${cells}</svg>`
}

// days in a row, back from today (or yesterday, if today is still to come),
// with at least one garden solved
function streak(now) {
  const solved = (day) => TIERS.some((tier) => saved.done[`${day}-${tier}`])
  let day = solved(now) ? now : now - 1
  let n = 0
  while (day >= 1 && solved(day)) { n++; day-- }
  return n
}

function greeting() {
  const h = new Date().getHours()
  return t(h < 5 ? 'hello.night' : h < 12 ? 'hello.morning' : h < 18 ? 'hello.afternoon' : 'hello.evening')
}

function card(p, big = false) {
  const st = state(p.id)
  const action = { done: `${icon('check')} ${t('card.done')}`, started: `${icon('play')} ${t('card.resume')}`, new: `${icon('play')} ${t('card.play')}` }[st]
  return `<button class="card ${st}${big ? ' big' : ''}" data-tier="${p.tier}" data-day="${p.day}" style="--i:${TIERS.indexOf(p.tier)}"
    aria-label="${t('card.label', { tier: tierName(p.tier), name: p.name, beds: buildBoard(p).beds.length })}, ${t(`card.${st}.state`)}">
    <span class="tier">${tierName(p.tier)}</span>
    ${miniMap(p)}
    <span class="pname">${p.name}</span>
    <span class="meta">${t('card.meta', { width: p.width, height: p.height, beds: buildBoard(p).beds.length })}</span>
    <span class="status">${action}</span>
  </button>`
}

function drawHome() {
  const now = today()
  $('date').textContent = longDate(now)
  const states = TIERS.map((tier) => state(`${now}-${tier}`))
  $('todays').innerHTML = TIERS.map((tier) => card(puzzle(now, tier), true)).join('')
  const solved = states.filter((x) => x === 'done').length
  const n = streak(now)
  $('streak').innerHTML = `${icon('flame')} ${t(n === 1 ? 'streak.one' : 'streak', { n })}`
  $('streak').hidden = n < 1
  $('blooms').innerHTML = TIERS.map((tier, i) => `<i class="${tier} ${states[i]}">${icon('flower')}</i>`).join('') + `<span>${t('today.count', { n: solved })}</span>`
  $('hello').textContent = `${greeting()} ${t(`hello.${solved}`)}`
  let missed = 0
  for (let day = 1; day < now; day++) missed += TIERS.filter((tier) => !saved.done[`${day}-${tier}`]).length
  $('catchup').hidden = !missed
  $('catchup').textContent = missed > 99 ? '99+' : missed
}

/* ---------- earlier days: a calendar, month by month ---------- */

function drawDays() {
  const now = today()
  const months = []
  for (let day = now; day >= 1; day--) {
    const date = dateOf(day)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    if (!months.length || months.at(-1).key !== key) months.push({ key, date })
  }
  let solved = 0
  for (let day = 1; day <= now; day++) solved += TIERS.filter((tier) => saved.done[`${day}-${tier}`]).length
  $('dayssummary').textContent = t('days.summary', { solved, total: now * 3 })
  const weekdays = [...Array(7)].map((_, k) => new Date(Date.UTC(2024, 0, 1 + k)).toLocaleDateString(language(), { weekday: 'narrow', timeZone: 'UTC' }))
  $('months').innerHTML = months.map(({ date }) => {
    const y = date.getUTCFullYear(), m = date.getUTCMonth()
    const first = new Date(Date.UTC(y, m, 1))
    const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const blanks = (first.getUTCDay() + 6) % 7 // weeks start on Monday
    const cells = [...Array(blanks)].map(() => '<span class="cell blank"></span>')
    for (let d = 1; d <= length; d++) {
      const day = dayOf(new Date(y, m, d))
      if (day < 1 || day > now) { cells.push(`<span class="cell off">${d}</span>`); continue }
      const sts = TIERS.map((tier) => state(`${day}-${tier}`))
      const all = sts.every((x) => x === 'done')
      cells.push(`<button class="cell${all ? ' complete' : ''}${day === now ? ' today' : ''}" data-day="${day}" aria-label="${dayName(day)}: ${t('days.cell', { n: sts.filter((x) => x === 'done').length })}"><b>${d}</b><span class="dots">${TIERS.map((tier, i) => `<i class="${tier} ${sts[i]}"></i>`).join('')}</span></button>`)
    }
    return `<section class="month"><h2>${capital(first.toLocaleDateString(language(), { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</h2>
      <div class="week">${weekdays.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal">${cells.join('')}</div></section>`
  }).join('')
}

function openDay(day) {
  $('sheetdate').textContent = day === today() ? t('day.today') : longDate(day)
  $('cards').innerHTML = TIERS.map((tier) => card(puzzle(day, tier))).join('')
  $('daysheet').hidden = false
}

// the next garden still to play: the rest of this day first, then today's, then
// the most recent earlier day with one open
function nextGarden() {
  const open = (day) => TIERS.map((tier) => ({ day, tier })).filter(({ day: d, tier }) => !saved.done[`${d}-${tier}`])
  if (current) {
    const left = open(current.day).filter(({ tier }) => TIERS.indexOf(tier) > TIERS.indexOf(current.tier))
    if (left.length) return left[0]
  }
  for (let day = today(); day >= 1; day--) { const o = open(day); if (o.length) return o[0] }
  return null
}

const play = (day, tier) => { sounds.unlock(); sounds.play('tap'); location.hash = `#/${day}/${tier}` }
for (const id of ['todays', 'cards']) {
  $(id).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tier]')
    if (b) play(b.dataset.day, b.dataset.tier)
  })
}
$('months').addEventListener('click', (ev) => {
  const c = ev.target.closest('.cell[data-day]')
  if (c) { sounds.unlock(); sounds.play('open'); openDay(Number(c.dataset.day)) }
})
$('open-days').onclick = () => { sounds.unlock(); sounds.play('tap'); location.hash = '#/days' }
$('days-back').onclick = () => { location.hash = '' }
$('sheetclose').onclick = () => { sounds.play('close'); $('daysheet').hidden = true }
$('daysheet').onclick = (ev) => { if (ev.target === $('daysheet')) $('daysheet').hidden = true }

/* ---------- moving between screens ---------- */

// #/<day>/<tier> plays a garden, #/days is the calendar, anything else is home.
// The phone's back gesture steps back through them.
let backTo = ''
// where to go once the tutorial is done or skipped: the garden the player picked
let afterTutorial = ''
function leaveTutorial() {
  const to = afterTutorial
  afterTutorial = ''
  // the tutorial steps out of the history, so Back doesn't return to it
  window.history.replaceState(null, '', to || location.pathname + location.search)
  route()
}
function route() {
  const m = location.hash.match(/^#\/(\d+)\/(easy|medium|hard)$/)
  const day = m && Number(m[1])
  const learning = location.hash === '#/tutorial'
  // a first game starts with the tutorial, then goes on to the garden picked
  if (m && day >= 1 && day <= today() && !tutorial.finished) {
    afterTutorial = location.hash
    window.history.replaceState(null, '', '#/tutorial')
    return route()
  }
  const screen = (m && day >= 1 && day <= today()) || learning ? 'game' : location.hash === '#/days' ? 'days' : 'home'
  const was = $('shell').dataset.screen
  $('shell').dataset.screen = screen
  if (screen === 'game') {
    if (was !== 'game') backTo = was === 'days' ? '#/days' : ''
    if (learning) {
      // a tutorial opened afresh (a visit, or Replay) starts from its welcome
      if (tutorial.finished) tutorial.restart()
      start(0, 'easy')
    } else start(day, m[2])
    return
  }
  current = null
  $('win').hidden = true
  sounds.setMood('garden')
  if (screen === 'days') { $('daysheet').hidden = true; drawDays() } else drawHome()
}
addEventListener('hashchange', route)
// a new day may have begun while the home screen sat open
addEventListener('visibilitychange', () => { if (!document.hidden && !current) route() })

/* ---------- no zooming or selecting ---------- */
// The viewport meta and CSS stop most zooming (touch-action turns double-tap
// zoom off); iOS Safari ignores them for pinches, and desktop browsers zoom on
// Ctrl with the wheel or keys, so those are caught here too. A double click, a
// long press's menu and text selection do nothing either.
const stop = (ev) => ev.preventDefault()
for (const name of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'selectstart', 'contextmenu']) document.addEventListener(name, stop, { passive: false })
document.addEventListener('touchmove', (ev) => { if (ev.touches.length > 1) ev.preventDefault() }, { passive: false })
document.addEventListener('wheel', (ev) => { if (ev.ctrlKey) ev.preventDefault() }, { passive: false })
addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ['+', '=', '-', '_', '0'].includes(ev.key)) ev.preventDefault() })

/* ---------- loop ---------- */
let last = performance.now()
// test captures run slowly in software rendering, so they keep their resolution
const capture = new URLSearchParams(location.search).has('capture')
function frame(now) {
  if (!capture) scene.tune(now - last)
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!document.hidden && current) {
    scene.update(dt)
    scene.render()
  }
  requestAnimationFrame(frame)
}
seed = 1
route()
try {
  if (sessionStorage.getItem('flower-patch.reopen-settings')) {
    sessionStorage.removeItem('flower-patch.reopen-settings')
    showSettings()
    $('settingsheet').hidden = false
  }
} catch { /* Fine without. */ }
requestAnimationFrame(frame)

// Hooks for screenshots and checks.
window.__garden = {
  scene, sounds, plant, mark, choose, toggleMarking,
  get marks() { return marks },
  tutorial,
  start(day, tier) { location.hash = `#/${day}/${tier}`; route() },
  home() { location.hash = ''; route() },
  today,
  get board() { return board },
  get values() { return values },
  // plant the whole solution, or all but the last `leave` cells
  solve(leave = 0) {
    const open = [...board.solution.keys()].filter((i) => !board.givens[i] && values[i] !== board.solution[i])
    open.slice(0, open.length - leave).forEach((i) => { choose(board.solution[i]); plant(i) })
  },
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) scene.update(1 / 30); scene.render() },
}
