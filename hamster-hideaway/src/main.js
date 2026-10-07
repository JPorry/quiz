import { BEDDING, TUBE, SEED, buildBoard, findHint, solve, status } from './logic.js'
import { TIERS, TIER_NAMES, TUTORIAL, puzzle, today, dayOf, dayLabel, dateOf } from './puzzles.js'
import { HabitatScene } from './scene.js'
import { HamsterAudio } from './audio.js'
import { TouchFx } from './touch.js'
import './style.css'

// Hamster Hideaway is a daily Nurikabe puzzle: every day brings an easy, a
// medium and a hard habitat. Lay play tubes so that every hamster gets a room
// of exactly its number of cells. The home screen shows today's three and every
// earlier day, so missed ones can be played any time. A first game starts with
// a guided habitat of its own. Progress is kept per puzzle.

const STORAGE_KEY = 'hamster-hideaway.v1'

const ICON = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  seed: '<path d="M12 21c-3.6 0-6-4-6-9s2.4-9 6-9 6 4 6 9-2.4 9-6 9z"/><path d="M12 5v14"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.7 1 2.8 2.2 3.2C11 9 10.8 6 12 3z"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  learn: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11"/>',
  rules: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/>',
  hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  tube: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M8 8v8M16 8v8"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

// A round hamster face for buttons and the home screen.
const FACE = (cls = 'face') => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="17" cy="16" r="8" fill="#f5a65b" stroke="#6a4a3a" stroke-width="2.4"/><circle cx="17" cy="16" r="4.2" fill="#f7aeb4"/>
  <circle cx="47" cy="16" r="8" fill="#f5a65b" stroke="#6a4a3a" stroke-width="2.4"/><circle cx="47" cy="16" r="4.2" fill="#f7aeb4"/>
  <ellipse cx="32" cy="36" rx="24" ry="21" fill="#f5a65b" stroke="#6a4a3a" stroke-width="2.6"/>
  <ellipse cx="32" cy="43" rx="15" ry="12" fill="#fff3e2"/>
  <circle cx="23.5" cy="32" r="3.4" fill="#2a1d17"/><circle cx="24.5" cy="30.8" r="1.1" fill="#fff"/>
  <circle cx="40.5" cy="32" r="3.4" fill="#2a1d17"/><circle cx="41.5" cy="30.8" r="1.1" fill="#fff"/>
  <ellipse cx="16" cy="40" rx="4.5" ry="3" fill="#f79a9a" opacity=".85"/><ellipse cx="48" cy="40" rx="4.5" ry="3" fill="#f79a9a" opacity=".85"/>
  <ellipse cx="32" cy="38" rx="2.4" ry="1.7" fill="#e88a8a"/>
  <path d="M28.5 41.5q3.5 3 7 0" stroke="#6a4a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</svg>`
// sunflower seeds drifting down behind the menus
const SEEDS = [...Array(10)].map((_, k) => `<i class="drift" style="--x:${(k * 37 + 7) % 100}%;--d:${(k * 1.9) % 10}s;--t:${14 + (k * 3) % 8}s;--r:${(k * 47) % 360}deg"></i>`).join('')
const tierPips = (tier) => `<i class="pips">${[0, 1, 2].map((k) => `<b class="${k <= TIERS.indexOf(tier) ? 'on' : ''}"></b>`).join('')}</i>`

// how to play: one line a rule, each with a little picture
const RULES = [
  ['room', 'Every number is a hamster. It needs a room of exactly that many cells of bedding, counting its own.'],
  ['apart', 'Hamsters live alone, so two rooms never touch side by side. Tubes run between them.'],
  ['join', 'All the tubes join up into one network, so the hamsters can visit.'],
  ['wide', 'Tubes are one cell wide: no 2×2 block of tube anywhere.'],
  ['tap', 'Tap a cell to lay a tube. Tap again for a sunflower seed, a note that the cell is bedding. Drag to do a whole row.'],
]
const RULE_ART = {
  room: '<rect x="3" y="3" width="34" height="34" rx="7" fill="#fbe7c0"/><rect x="6" y="6" width="28" height="13" rx="5" fill="#ffd7de"/><circle cx="13" cy="12.5" r="6" fill="#fff8ec" stroke="#d69a64" stroke-width="2"/><text x="13" y="16.5" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="11" fill="#4a3428">2</text><rect x="4" y="22" width="32" height="8" rx="4" fill="#8fcdec" stroke="#5aa9d6" stroke-width="1.6"/>',
  apart: '<rect x="3" y="3" width="34" height="34" rx="7" fill="#fbe7c0"/><rect x="6" y="6" width="11" height="28" rx="5" fill="#ffd7de"/><rect x="23" y="6" width="11" height="28" rx="5" fill="#d9ecff"/><rect x="16.5" y="3" width="7" height="34" rx="3.5" fill="#8fcdec" stroke="#5aa9d6" stroke-width="1.6"/>',
  join: '<rect x="3" y="3" width="34" height="34" rx="7" fill="#fbe7c0"/><path d="M9 9h12v12h10v10" fill="none" stroke="#5aa9d6" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 9h12v12h10v10" fill="none" stroke="#a9daf1" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>',
  wide: '<rect x="3" y="3" width="34" height="34" rx="7" fill="#fbe7c0"/><rect x="8" y="8" width="24" height="24" rx="6" fill="#ffc4c4" stroke="#e46a6a" stroke-width="2" stroke-dasharray="4 3"/><path d="M14 14l12 12M26 14 14 26" stroke="#e46a6a" stroke-width="3" stroke-linecap="round"/>',
  tap: '<rect x="3" y="3" width="34" height="34" rx="7" fill="#fbe7c0"/><rect x="6" y="15" width="12" height="10" rx="5" fill="#8fcdec" stroke="#5aa9d6" stroke-width="1.6"/><ellipse cx="28" cy="20" rx="4" ry="6.5" transform="rotate(25 28 20)" fill="#4a3a30"/><path d="M26.5 15.5l3 9" stroke="#f0e3c8" stroke-width="1.4"/>',
}

document.querySelector('#app').innerHTML = `
  <div class="app" id="shell" data-screen="title">
    <section class="titlepage enter" id="titlepage">
      <img class="titlebg" src="title-habitat.webp" alt="" draggable="false" aria-hidden="true">
      <h1 class="logo"><img src="title-logo.webp" alt="Hamster Hideaway" width="900" height="520" draggable="false"><i class="glint" aria-hidden="true" style="-webkit-mask-image:url(title-logo.webp);mask-image:url(title-logo.webp)"></i></h1>
      <div class="titlespace"></div>
      <p class="tagline">Cosy rooms. Twisty tubes.</p>
      <nav class="titlebuttons">
        <button class="bigplay" id="title-play">${FACE('playface')}<span>Play</span></button>
        <button class="titlebtn" id="title-learn">${icon('learn')}<span>How to play</span></button>
      </nav>
      <button class="round titlegear" id="title-settings" aria-label="Settings">${icon('settings')}</button>
    </section>
    <div class="menubg" aria-hidden="true"><img src="title-habitat.webp" alt="" draggable="false"><span class="wash"></span>${SEEDS}</div>
    <main class="home" id="home">
      <header class="homehead">
        <button class="round" id="home-back" aria-label="Back to the title">${icon('back')}</button>
        <div class="brand"><h1 class="hometitle">Today’s habitats</h1></div>
        <button class="round" id="settings-home" aria-label="Settings">${icon('settings')}</button>
      </header>
      <div class="chips">
        <p class="date"><span id="date"></span></p>
        <span class="tag-chip seeds" id="seeds"></span>
      </div>
      <div class="todays" id="todays"></div>
      <footer class="homefoot">
        <div class="buddy">${FACE('buddyface')}<p class="hello" id="hello"></p></div>
        <button class="chip daysbutton" id="open-days">${icon('calendar')}<span>Earlier days</span><b class="count" id="catchup" hidden></b></button>
      </footer>
    </main>
    <section class="dayspage" id="dayspage">
      <header class="dayshead">
        <button class="round" id="days-back" aria-label="Back to today">${icon('back')}</button>
        <div class="titles"><h1 class="hometitle">Earlier days</h1></div>
      </header>
      <p class="date dayssum"><span id="dayssummary"></span></p>
      <div class="months" id="months"></div>
      <div class="picker" id="daysheet" hidden>
        <div class="sheet">
          <div class="sheethead"><h2 id="sheetdate"></h2><button class="round" id="sheetclose" aria-label="Close">${icon('close')}</button></div>
          <div class="cards" id="cards"></div>
        </div>
      </div>
    </section>
    <div class="game" id="game">
      <header>
        <button class="round" id="home-button" aria-label="Back">${icon('back')}</button>
        <div class="titles"><h1 id="name"></h1><p id="prog"></p></div>
        <button class="round restart" id="restart" aria-label="Restart">${icon('restart')}<span class="sure" aria-hidden="true">Sure?</span></button>
        <button class="round" id="settings" aria-label="Settings">${icon('settings')}</button>
      </header>
      <div class="stage" id="stage">
        <div class="coach" id="coach" hidden>
          <p id="coach-text"></p>
          <div class="row"><button class="chip" id="coach-skip">Skip</button><button class="chip go" id="coach-next">Next</button></div>
        </div>
      </div>
      <footer>
        <p class="say" id="say" aria-live="polite"></p>
        <div class="row">
          <button class="chip" id="undo">${icon('undo')}<span>Undo</span></button>
          <button class="chip" id="hint">${icon('hint')}<span>Hint</span></button>
        </div>
      </footer>
      <section class="win" id="win" hidden>
        <h2>Everyone’s home!</h2>
        <p id="winmeta"></p>
        <div class="row">
          <button class="chip" id="winhome">Home</button>
          <button class="chip go" id="winnext">Next</button>
        </div>
      </section>
    </div>
    <section class="picker" id="settingsheet" hidden>
      <div class="sheet settings" role="dialog" aria-labelledby="settingstitle">
        <div class="sheethead"><h2 id="settingstitle">Settings</h2><button class="round" id="closesettings" aria-label="Close">${icon('close')}</button></div>
        <div class="setting"><label for="musicvol">${icon('music')}<span>Music</span></label><input type="range" id="musicvol" min="0" max="100" step="5"><output id="musicval"></output></div>
        <div class="setting"><label for="fxvol">${icon('sound')}<span>Sounds</span></label><input type="range" id="fxvol" min="0" max="100" step="5"><output id="fxval"></output></div>
        <div class="row stretch">
          <button class="chip replay" id="settings-rules">${icon('rules')}<span>Rules</span></button>
          <button class="chip replay" id="settings-learn">${icon('learn')}<span>Tutorial</span></button>
        </div>
        <button class="chip go" id="settingsdone">Done</button>
      </div>
    </section>
    <section class="picker" id="rulesheet" hidden>
      <div class="sheet rules" role="dialog" aria-labelledby="rulestitle">
        <div class="sheethead"><h2 id="rulestitle">How to play</h2><button class="round" id="closerules" aria-label="Close">${icon('close')}</button></div>
        <ol class="rulelist">${RULES.map(([art, text]) => `<li><svg viewBox="0 0 40 40" aria-hidden="true">${RULE_ART[art]}</svg><span>${text}</span></li>`).join('')}</ol>
        <button class="chip go" id="rulesdone">Got it!</button>
      </div>
    </section>
  </div>`
const $ = (id) => document.getElementById(id)

// done: the cells of every solved puzzle; progress: the cells marked so far on
// puzzles still being worked on. Both are keyed by puzzle id ("<day>-<tier>"),
// as strings of 0 (bedding), 1 (tube) and 2 (seed).
function loadSaved() {
  const empty = { done: {}, progress: {}, tutorial: false }
  try { return { ...empty, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } } catch { return empty }
}
const saved = loadSaved()
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* private windows */ } }
const unpack = (text, size) => (text && text.length === size ? [...text].map(Number) : null)

const audio = new HamsterAudio()
const scene = new HabitatScene($('stage'))
const touch = new TouchFx($('stage'))
// the coach card sits over the habitat
$('stage').append($('coach'))
scene.onItem = () => audio.play('item')

/* ---------- the home screen ---------- */

let current = null // the puzzle being played
let board, cells, undos, won, solution, settled, coachStep

const state = (id) => (saved.done[id] ? 'done' : /[12]/.test(saved.progress[id] ?? '') ? 'started' : 'new')

// A little map of a habitat: its grid, the tubes laid so far, and its numbers.
function miniMap(p) {
  const marks = saved.done[p.id] ?? saved.progress[p.id] ?? ''
  const s = 10
  const w = p.width * s, h = p.height * s
  let tubes = ''
  for (let i = 0; i < p.width * p.height; i++) {
    if (marks[i] !== '1') continue
    tubes += `<rect x="${(i % p.width) * s + 1.5}" y="${Math.floor(i / p.width) * s + 1.5}" width="${s - 3}" height="${s - 3}" rx="3"/>`
  }
  const rooms = p.rooms.map(([r, c, v]) => `<circle cx="${c * s + s / 2}" cy="${r * s + s / 2}" r="4.2"/><text x="${c * s + s / 2}" y="${r * s + s / 2 + 2.2}">${v}</text>`).join('')
  return `<svg class="map" viewBox="-1 -1 ${w + 2} ${h + 2}" aria-hidden="true"><rect class="floor" x="0" y="0" width="${w}" height="${h}" rx="3"/><g class="tubes">${tubes}</g><g class="rooms">${rooms}</g></svg>`
}

function streak(now) {
  // days in a row, back from today (or yesterday, if today is still to come),
  // with at least one puzzle solved
  const solved = (day) => TIERS.some((t) => saved.done[`${day}-${t}`])
  let day = solved(now) ? now : now - 1
  let n = 0
  while (day >= 1 && solved(day)) { n++; day-- }
  return n
}

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Squeak, night owl' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// A puzzle as a card: its difficulty, a little map, its name, its size, and
// what to do next (a finished one wears a round stamp).
function card(p, i) {
  const st = state(p.id)
  const label = { done: `${icon('check')}<span>Cosy!</span>`, started: `${icon('play')}<span>Resume</span>`, new: `${icon('play')}<span>Play</span>` }[st]
  return `<button class="card ${st}" data-tier="${p.tier}" data-day="${p.day}" style="--i:${i}" aria-label="${TIER_NAMES[p.tier]}: ${p.name}, ${p.rooms.length} hamsters${st === 'done' ? ', finished' : st === 'started' ? ', started' : ''}">
    <span class="planter">${miniMap(p)}</span>
    <span class="tier">${TIER_NAMES[p.tier]}${tierPips(p.tier)}</span>
    <span class="pname">${p.name}</span>
    <span class="meta">${p.width}×${p.height} · ${p.rooms.length} hamsters</span>
    <span class="status">${label}</span>
  </button>`
}

function drawHome() {
  const now = today()
  $('date').textContent = dateOf(now).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const states = TIERS.map((tier) => state(`${now}-${tier}`))
  $('todays').innerHTML = TIERS.map((tier, i) => card(puzzle(now, tier), i)).join('')
  const solvedToday = states.filter((x) => x === 'done').length
  const n = streak(now)
  $('seeds').innerHTML = `${n > 1 ? `<span class="flame">${icon('flame')}<b>${n}</b></span>` : ''}${TIERS.map((t, i) => `<i class="${t} ${states[i]}">${icon('seed')}</i>`).join('')}<span class="count">${solvedToday}/3</span>`
  $('hello').textContent = `${greeting()}! ${[
    'Three new habitats today, full of hamsters looking for a room.',
    'One habitat sorted, two to go. The hamsters are waiting!',
    'Two habitats done! One last bunch of hamsters needs rooms.',
    'Every hamster is tucked in for today. New ones arrive tomorrow!',
  ][solvedToday]}`
  let missed = 0
  for (let day = 1; day < now; day++) missed += TIERS.filter((t) => !saved.done[`${day}-${t}`]).length
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
  for (let day = 1; day <= now; day++) solved += TIERS.filter((t) => saved.done[`${day}-${t}`]).length
  $('dayssummary').textContent = `${solved} of ${now * 3} habitats finished`
  const weekdays = [...Array(7)].map((_, k) => new Date(Date.UTC(2024, 0, 1 + k)).toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' }))
  $('months').innerHTML = months.map(({ date }) => {
    const y = date.getUTCFullYear(), m = date.getUTCMonth()
    const first = new Date(Date.UTC(y, m, 1))
    const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const blanks = (first.getUTCDay() + 6) % 7 // weeks start on Monday
    const out = [...Array(blanks)].map(() => '<span class="cell blank"></span>')
    for (let d = 1; d <= length; d++) {
      const day = dayOf(new Date(y, m, d))
      if (day < 1 || day > now) { out.push(`<span class="cell off">${d}</span>`); continue }
      const sts = TIERS.map((t) => state(`${day}-${t}`))
      const all = sts.every((x) => x === 'done')
      out.push(`<button class="cell${all ? ' complete' : ''}${day === now ? ' today' : ''}" data-day="${day}" aria-label="${dayLabel(day, now)}: ${sts.filter((x) => x === 'done').length} of 3 finished"><b>${d}</b><span class="dots">${TIERS.map((t, i) => `<i class="${t} ${sts[i]}"></i>`).join('')}</span></button>`)
    }
    return `<section class="month"><h2>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
      <div class="week">${weekdays.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal">${out.join('')}</div></section>`
  }).join('')
}

function openDay(day) {
  $('sheetdate').textContent = day === today() ? 'Today' : dateOf(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  $('cards').innerHTML = TIERS.map((tier, i) => card(puzzle(day, tier), i)).join('')
  $('daysheet').hidden = false
}

const play = (day, tier) => { audio.unlock(); audio.play('tap'); location.hash = `#/${day}/${tier}` }
for (const id of ['todays', 'cards']) {
  $(id).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tier]')
    if (b) play(b.dataset.day, b.dataset.tier)
  })
}
$('months').addEventListener('click', (ev) => {
  const c = ev.target.closest('.cell[data-day]')
  if (c) { audio.unlock(); audio.play('swoosh'); openDay(Number(c.dataset.day)) }
})
$('title-play').onclick = () => { audio.unlock(); audio.play('start'); location.hash = '#/today' }
$('title-learn').onclick = () => { audio.unlock(); audio.play('start'); afterTutorial = '#/today'; location.hash = '#/tutorial' }
$('home-back').onclick = () => { audio.play('back'); location.hash = '' }
$('open-days').onclick = () => { audio.unlock(); audio.play('tap'); location.hash = '#/days' }
$('days-back').onclick = () => { audio.play('back'); location.hash = '#/today' }
$('sheetclose').onclick = () => { audio.play('back'); $('daysheet').hidden = true }

/* ---------- settings and how to play ---------- */

function showSheet(id) {
  audio.unlock()
  audio.play('swoosh')
  $(id).hidden = false
}
function syncSettings() {
  $('musicvol').value = Math.round(audio.music ? audio.musicVolume * 100 : 0)
  $('fxvol').value = Math.round(audio.effects ? audio.effectsVolume * 100 : 0)
  $('musicval').textContent = `${$('musicvol').value}%`
  $('fxval').textContent = `${$('fxvol').value}%`
}
for (const id of ['title-settings', 'settings-home', 'settings']) $(id).onclick = () => { syncSettings(); showSheet('settingsheet') }
$('musicvol').oninput = () => { audio.setMusicVolume($('musicvol').value / 100); syncSettings() }
$('fxvol').oninput = () => { audio.setEffectsVolume($('fxvol').value / 100); syncSettings() }
$('fxvol').onchange = () => audio.play('tap')
$('settings-rules').onclick = () => { $('settingsheet').hidden = true; showSheet('rulesheet') }
// the tutorial plays again from its welcome; afterwards it comes back here
$('settings-learn').onclick = () => {
  $('settingsheet').hidden = true
  audio.play('start')
  if (location.hash === '#/tutorial') { coachStep = 'welcome'; start(0); return }
  afterTutorial = location.hash || '#/today'
  location.hash = '#/tutorial'
}
for (const [button, sheet] of [['closesettings', 'settingsheet'], ['settingsdone', 'settingsheet'], ['closerules', 'rulesheet'], ['rulesdone', 'rulesheet']]) {
  $(button).onclick = () => { audio.play('back'); $(sheet).hidden = true }
}
for (const sheet of ['settingsheet', 'rulesheet', 'daysheet']) $(sheet).addEventListener('click', (ev) => { if (ev.target === $(sheet)) $(sheet).hidden = true })

/* ---------- moving between screens ---------- */

// "" is the title, #/today today's puzzles, #/days the calendar, #/tutorial the
// guided habitat and #/<day>/<tier> a puzzle. The phone's back gesture steps
// back through them.
let backTo = '#/today'
let afterTutorial = ''
function route() {
  const m = location.hash.match(/^#\/(\d+)\/(easy|medium|hard)$/)
  const day = m && Number(m[1])
  let learning = location.hash === '#/tutorial'
  // a first game starts with the tutorial, then goes on to the puzzle picked
  if (m && day >= 1 && day <= today() && !saved.tutorial) {
    afterTutorial = location.hash
    history.replaceState(null, '', '#/tutorial')
    learning = true
  }
  const screen = learning || (m && day >= 1 && day <= today()) ? 'game' : location.hash === '#/days' ? 'days' : location.hash === '#/today' ? 'home' : 'title'
  const was = $('shell').dataset.screen
  $('shell').dataset.screen = screen
  if (screen === 'game') {
    if (was !== 'game') { backTo = was === 'days' ? '#/days' : '#/today'; audio.play('start', { at: 0.1 }) }
    audio.setMood('play')
    if (learning) { coachStep = 'welcome'; start(0) } else start(day, m[2])
    return
  }
  current = null
  audio.setMood(screen)
  if (screen === 'days') { $('daysheet').hidden = true; drawDays() } else if (screen === 'home') drawHome()
  else {
    // replay the title's entrance each time it is shown
    $('titlepage').classList.remove('enter')
    void $('titlepage').offsetWidth
    $('titlepage').classList.add('enter')
  }
}
addEventListener('hashchange', route)
$('home-button').onclick = () => {
  audio.play('back')
  if (isTutorial()) return leaveTutorial()
  location.hash = backTo
}

/* ---------- playing a puzzle ---------- */

const isTutorial = () => current?.id === TUTORIAL.id
const nameOf = (k) => current.names[k]

function start(day, tier) {
  current = day === 0 ? TUTORIAL : puzzle(day, tier)
  board = buildBoard(current)
  const kept = isTutorial() ? null : unpack(saved.done[current.id] ?? saved.progress[current.id], board.size)
  cells = kept ?? new Array(board.size).fill(BEDDING)
  for (const c of board.clues) cells[c.cell] = BEDDING
  undos = []
  won = Boolean(saved.done[current.id]) && !isTutorial()
  solution = null
  settled = new Set()
  $('win').hidden = true
  $('name').textContent = current.name
  $('game').dataset.tier = current.tier
  scene.load(board, { seed: (current.day * 3 + TIERS.indexOf(current.tier)) % 97 + 1 })
  const st = refresh(true)
  st.rooms.forEach((r, k) => { if (r.done) settled.add(k) })
  scene.setGlow(null)
  if (won) say('All done! Restart to play it again.')
  else if (isTutorial()) say('')
  else if (cells.some((v) => v !== BEDDING)) say('Welcome back. Your tubes are just as you left them.')
  else say(`${current.rooms.length} hamsters need rooms. Tap a cell to lay a tube.`)
  coach()
}

const say = (text) => { $('say').textContent = text }

function refresh(quiet = false) {
  const st = status(board, cells)
  scene.setState(cells, st, { won })
  const happy = st.rooms.filter((r) => r.done).length
  $('prog').textContent = `${isTutorial() ? 'Tutorial' : `${dayLabel(current.day)} · ${TIER_NAMES[current.tier]}`} · ${happy}/${board.clues.length} settled`
  $('undo').disabled = !undos.length || won
  $('hint').disabled = won
  // a hamster whose room has just come right squeaks happily, a note higher each time
  if (!quiet) {
    const fresh = st.rooms.map((r, k) => (r.done && !settled.has(k) ? k : -1)).filter((k) => k >= 0)
    if (fresh.length && !st.complete) audio.play(`room-${Math.min(6, happy - 1)}`, { at: 0.05 })
  }
  settled = new Set(st.rooms.map((r, k) => (r.done ? k : -1)).filter((k) => k >= 0))
  return st
}

// What to tell the player after a change: the most pressing problem first.
function explain(st, changed) {
  if (st.wide.length) return 'Tubes are only one cell wide. Break up that 2×2 block.'
  if (st.crowded.length) {
    const k = st.crowded[0]
    return st.crowded.length > 1 ? `Seeds join ${nameOf(st.crowded[0])}’s room to ${nameOf(st.crowded[1])}’s. Hamsters live alone!` : `${nameOf(k)}’s room has more seeds than its ${board.clues[k].value} cells.`
  }
  if (st.cramped.length) {
    const k = st.cramped[0]
    return `${nameOf(k)}’s room is walled in too small. It needs ${board.clues[k].value} ${board.clues[k].value === 1 ? 'cell' : 'cells'}.`
  }
  if (st.stray.length) return 'A seed is walled in where no hamster can reach it.'
  if (st.split) return 'Some tubes are walled off. All the tubes need to join up.'
  const fresh = st.rooms.findIndex((r, k) => r.done && !settled.has(k))
  if (fresh >= 0 && changed) return `${nameOf(fresh)}’s room is just right!`
  const left = st.rooms.filter((r) => !r.done).length
  return left ? `${left} ${left === 1 ? 'hamster still needs' : 'hamsters still need'} a room.` : 'Every room is right. Now the tubes must all join up, with no bedding left over.'
}

// Paints one cell, remembering what it was for undo.
function mark(i, value, changes) {
  if (board.clueAt[i] !== -1 || cells[i] === value) return false
  changes.push([i, cells[i]])
  cells[i] = value
  return true
}

function afterChange(value) {
  keep()
  const st = status(board, cells)
  // look before refresh() moves `settled` along
  const message = explain(st, true)
  if (st.wide.length) { audio.play('bonk'); buzz([10, 40, 10]) }
  refresh()
  if (!isTutorial() || !coachStep || coachStep === 'done') say(message)
  if (st.complete) win()
  else coach()
  return value
}

// remember the cells marked so far, so a puzzle can be picked up later
function keep() {
  if (isTutorial()) return
  if (cells.some((v) => v !== BEDDING)) saved.progress[current.id] = cells.join('')
  else delete saved.progress[current.id]
  save()
}

// the next puzzle to suggest after a win: the next unsolved one that day, else today's
function nextPuzzle() {
  for (const day of [current.day, today()]) {
    const tier = TIERS.find((t) => !saved.done[`${day}-${t}`])
    if (tier) return { day, tier }
  }
  return null
}

function win() {
  won = true
  scene.setGlow(null)
  if (isTutorial()) {
    saved.tutorial = true
    save()
  } else {
    saved.done[current.id] = cells.join('')
    delete saved.progress[current.id]
    save()
  }
  refresh(true)
  say(isTutorial() ? '' : 'Every hamster has a room of its own!')
  coach()
  const shown = current.id
  setTimeout(() => {
    if (current?.id !== shown) return
    audio.play('win')
    audio.duck(5)
    scene.celebrate()
    if (isTutorial()) return
    setTimeout(() => {
      if (current?.id !== shown) return
      const next = nextPuzzle()
      const tubes = cells.filter((v) => v === TUBE).length
      $('winmeta').textContent = `${board.clues.length} hamsters and ${tubes} tubes in ${current.name}.`
      $('winnext').hidden = !next
      if (next) {
        $('winnext').textContent = next.day === current.day ? `Next: ${TIER_NAMES[next.tier]}` : `Today’s ${TIER_NAMES[next.tier]}`
        $('winnext').onclick = () => { location.hash = `#/${next.day}/${next.tier}` }
      }
      $('win').hidden = false
    }, 2200)
  }, 500)
}

const buzz = (pattern) => { try { navigator.vibrate?.(pattern) } catch { /* not allowed here */ } }

/* ---------- hints ---------- */

const RULE_TEXT = {
  between: () => 'This cell touches two different rooms. Hamsters live alone, so it has to be tube.',
  complete: (k) => `${nameOf(k)}’s room already has its ${board.clues[k].value} ${board.clues[k].value === 1 ? 'cell' : 'cells'}. Wall it in with tube.`,
  pool: () => 'Three tubes already make an L here. A fourth would make a 2×2 block, so this is bedding.',
  unreachable: () => 'No hamster’s room can stretch this far, so this cell is tube.',
  expand: (k) => `${nameOf(k)}’s room can only grow this way, so this cell is bedding.`,
  escape: () => 'These tubes are boxed in. This is their only way out to join the rest.',
  trial: (k, value) => `Suppose this cell were ${value === TUBE ? 'bedding' : 'tube'}: something soon goes wrong. So it’s ${value === TUBE ? 'tube' : 'bedding'}.`,
}
const howTo = (value) => (value === TUBE ? 'Tap it to lay a tube.' : 'Tap it twice to drop a seed.')

// Marks that disagree with the solution, if any.
function mistakes() {
  solution ??= solve(board, { limit: 1 })[0]
  const out = []
  for (let i = 0; i < board.size; i++) {
    if ((cells[i] === TUBE && solution[i] !== TUBE) || (cells[i] === SEED && solution[i] === TUBE)) out.push(i)
  }
  return out
}

function nextHint() {
  const wrong = mistakes()
  if (wrong.length) return { cells: wrong, text: `${wrong.length === 1 ? 'This cell isn’t right' : 'These cells aren’t right'}. Tap to change ${wrong.length === 1 ? 'it' : 'them'}.` }
  const hint = findHint(board, cells, solution)
  if (!hint) return null
  return { cells: [hint.cell], hint, text: `${RULE_TEXT[hint.rule](hint.room, hint.value)} ${howTo(hint.value)}` }
}

$('hint').onclick = () => {
  if (won || !current) return
  audio.unlock()
  const h = nextHint()
  if (!h) return
  audio.play('hint')
  scene.setGlow(h.cells)
  say(h.text)
}

/* ---------- the tutorial: a coach card over the guided habitat ---------- */

// Steps: 'welcome' (a hello), 'play' (hint after hint, each one shown on the
// board), 'outro' (after the win), then 'done'.
function coach() {
  const card = $('coach')
  if (!isTutorial() || !coachStep || coachStep === 'done') { card.hidden = true; scene.setInset(0); return }
  card.hidden = false
  requestAnimationFrame(() => scene.setInset(card.hidden ? 0 : card.offsetHeight + 16))
  $('coach-next').hidden = coachStep === 'play'
  $('coach-skip').hidden = coachStep === 'outro'
  if (coachStep === 'welcome') {
    $('coach-text').textContent = 'Welcome to the habitat! Every number is a hamster. Each one needs a room with exactly that many cells of bedding. You lay play tubes to wall the rooms in.'
    $('coach-next').textContent = 'Show me'
    scene.setGlow(null)
    return
  }
  if (coachStep === 'outro' || won) {
    coachStep = 'outro'
    $('coach-next').hidden = false
    $('coach-next').textContent = 'Let’s play!'
    $('coach-text').textContent = 'Everyone’s home! Remember: rooms never touch, all the tubes join up, and tubes are never 2×2. Have fun!'
    return
  }
  const h = nextHint()
  if (!h) return
  scene.setGlow(h.cells)
  $('coach-text').textContent = h.text
}
$('coach-next').onclick = () => {
  audio.unlock()
  audio.play('tap')
  if (coachStep === 'welcome') { coachStep = 'play'; coach(); return }
  if (coachStep === 'outro') { coachStep = 'done'; leaveTutorial() }
}
$('coach-skip').onclick = () => {
  audio.play('back')
  saved.tutorial = true
  save()
  coachStep = 'done'
  leaveTutorial()
}
function leaveTutorial() {
  const to = afterTutorial || '#/today'
  afterTutorial = ''
  saved.tutorial = true
  save()
  // the tutorial steps out of the history, so Back doesn't return to it
  history.replaceState(null, '', to)
  route()
}

/* ---------- laying tubes: tap to cycle a cell, drag to paint ---------- */

const NEXT = { [BEDDING]: TUBE, [TUBE]: SEED, [SEED]: BEDDING }
let drag = null
const canvas = scene.renderer.domElement
canvas.style.touchAction = 'none'

canvas.addEventListener('pointerdown', (ev) => {
  audio.unlock()
  if (!current) return
  const i = scene.cellAt(ev.clientX, ev.clientY)
  touch.ripple(ev.clientX, ev.clientY, i >= 0 && board.clueAt[i] !== -1)
  if (i < 0) return
  if (board.clueAt[i] !== -1) {
    // a tap on a hamster: it hops and squeaks, and says what it needs
    const k = board.clueAt[i]
    scene.poke(k)
    audio.play(`squeak-${Math.floor(Math.random() * 4)}`)
    if (!isTutorial()) say(`${nameOf(k)} needs a room of ${board.clues[k].value}.`)
    return
  }
  if (won || (isTutorial() && coachStep !== 'play')) return
  canvas.setPointerCapture(ev.pointerId)
  const value = NEXT[cells[i]]
  drag = { id: ev.pointerId, value, changes: [], last: [ev.clientX, ev.clientY], seen: new Set([i]) }
  mark(i, value, drag.changes)
  feel(value, 0)
  scene.setGlow(null)
  afterChange(value)
})

// plays the sound for a cell changing; tubes clink a little higher along a drag
function feel(value, n) {
  if (value === TUBE) audio.play(`tube-${Math.min(7, n)}`)
  else if (value === SEED) audio.play('seed')
  else audio.play('clear')
  buzz(value === TUBE ? 10 : 6)
}

canvas.addEventListener('pointermove', (ev) => {
  if (!drag || drag.id !== ev.pointerId) return
  // walk from the last point to this one, so a quick swipe doesn't skip cells
  const [x0, y0] = drag.last
  const steps = Math.max(1, Math.ceil(Math.hypot(ev.clientX - x0, ev.clientY - y0) / 8))
  let changed = false
  for (let s = 1; s <= steps; s++) {
    const x = x0 + (ev.clientX - x0) * s / steps, y = y0 + (ev.clientY - y0) * s / steps
    const i = scene.cellAt(x, y)
    if (i < 0 || drag.seen.has(i)) continue
    drag.seen.add(i)
    if (mark(i, drag.value, drag.changes)) { changed = true; feel(drag.value, drag.changes.length - 1) }
  }
  drag.last = [ev.clientX, ev.clientY]
  if (changed) afterChange(drag.value)
})

function endDrag(ev) {
  if (!drag || drag.id !== ev.pointerId) return
  if (drag.changes.length) undos.push(drag.changes)
  drag = null
  $('undo').disabled = !undos.length || won
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', endDrag)

/* ---------- buttons ---------- */
$('winhome').onclick = () => { location.hash = '#/today' }
$('undo').onclick = () => {
  if (!undos.length || won) return
  const changes = undos.pop()
  for (let k = changes.length - 1; k >= 0; k--) cells[changes[k][0]] = changes[k][1]
  audio.play('undo')
  scene.setGlow(null)
  afterChange(null)
}
// Restart asks once: the first tap shows "Sure?", a second within a moment clears the board.
let armed = 0
$('restart').onclick = () => {
  if (!armed) {
    $('restart').classList.add('armed')
    armed = setTimeout(() => { armed = 0; $('restart').classList.remove('armed') }, 2200)
    audio.play('tap')
    return
  }
  clearTimeout(armed)
  armed = 0
  $('restart').classList.remove('armed')
  audio.play('restart')
  if (isTutorial()) { coachStep = 'welcome'; start(0); return }
  // a solved puzzle stays solved; restarting just clears the board to play again
  delete saved.progress[current.id]
  const solved = saved.done[current.id]
  delete saved.done[current.id]
  start(current.day, current.tier)
  if (solved) saved.done[current.id] = solved
  save()
}
addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z' && current) $('undo').click() })

/* ---------- loop ---------- */
let last = performance.now()
// test captures run slowly in software rendering, so they keep their resolution
const capture = new URLSearchParams(location.search).has('capture')
function frame(now) {
  // the habitat is only drawn while a puzzle is open
  if (current && !document.hidden) {
    if (!capture) scene.tune(now - last)
    const dt = Math.min(0.05, (now - last) / 1000)
    scene.update(dt)
    scene.render()
    if (touch.busy || touch.drawn) { touch.update(dt); touch.drawn = touch.busy }
  }
  last = now
  requestAnimationFrame(frame)
}
// turning a phone reframes the habitat
addEventListener('resize', () => scene.resize())
// a new day may have begun while the home screen sat open
addEventListener('visibilitychange', () => { if (!document.hidden && !current) route() })
route()
requestAnimationFrame(frame)

// Hooks for the visual checks.
window.__hamsters = {
  scene, audio, touch,
  start(day, tier) { saved.tutorial = true; location.hash = `#/${day}/${tier}`; route() },
  tutorial() { location.hash = '#/tutorial'; route() },
  home() { location.hash = '#/today'; route() },
  get cells() { return cells },
  get board() { return board },
  get current() { return current },
  // marks the solution, leaving out the last `leave` tube cells
  solve(leave = 0) {
    const s = solve(board, { limit: 1 })[0]
    let skip = leave
    for (let i = board.size - 1; i >= 0; i--) {
      if (s[i] === TUBE && skip > 0) { skip--; continue }
      if (board.clueAt[i] === -1) cells[i] = s[i] === TUBE ? TUBE : BEDDING
    }
    afterChange(TUBE)
  },
  set(list) { for (const [i, v] of list) cells[i] = v; afterChange(TUBE) },
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) { scene.update(1 / 30); touch.update(1 / 30) } scene.render() },
}
