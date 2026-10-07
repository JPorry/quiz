import { buildBoard, blockedBy, degrees, solve, status as boardStatus } from './logic.js'
import { TIERS, TIER_NAMES, puzzle, today, dayOf, dayLabel, dateOf } from './puzzles.js'
import { IslandScene } from './scene.js'
import { HarborAudio } from './audio.js'
import { TouchFx } from './touch.js'
import './style.css'

// Tiny Isles is a daily puzzle: every day brings an easy, a medium and a hard
// sea of islands to join. The home screen shows today's three and every earlier
// day, so missed ones can be played any time. Progress is kept per puzzle.

const STORAGE_KEY = 'tiny-isles.v3'

const ICON = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.5A3.3 3.3 0 0 0 7 18z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shell: '<path d="M12 20c-4.5 0-8-3.4-8-7.5C4 8 7.6 4 12 4s8 4 8 8.5c0 4.1-3.5 7.5-8 7.5z"/><path d="M12 20V8M8.5 19l1.5-9.5M15.5 19 14 9.5M5.5 16.5 8 11M18.5 16.5 16 11"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.7 1 2.8 2.2 3.2C11 9 10.8 6 12 3z"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  learn: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

// A friendly gull in a sailor's cap keeps you company on the home screen.
const GULL = `<svg class="gull" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="32" fill="#bfeefa"/>
  <path d="M0 46 Q16 40 32 46 T64 46 V64 H0Z" fill="#5cc8d8"/>
  <path d="M0 50 Q16 44 32 50 T64 50" stroke="#fff" stroke-width="2.4" fill="none" opacity=".8"/>
  <ellipse cx="33" cy="44" rx="15" ry="11" fill="#fff" stroke="#2c4a63" stroke-width="2"/>
  <path d="M22 42 C26 36 34 38 37 44 C32 46 26 46 22 42Z" fill="#d7e2ec" stroke="#2c4a63" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="34" cy="27" r="11" fill="#fff" stroke="#2c4a63" stroke-width="2"/>
  <path d="M42 28 L53 31 L42 33Z" fill="#ffb238" stroke="#b26a10" stroke-width="1.4" stroke-linejoin="round"/>
  <circle cx="37" cy="25" r="2.4" fill="#2c4a63"/><circle cx="37.8" cy="24.2" r=".8" fill="#fff"/>
  <ellipse cx="31" cy="30.5" rx="2.6" ry="1.6" fill="#ffb3c2" opacity=".8"/>
  <path d="M24 18 Q34 10 44 18 L43 21 Q34 16 25 21Z" fill="#fff" stroke="#2c4a63" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M25 21 Q34 16 43 21 L42 23 Q34 19 26 23Z" fill="#2f7de1" stroke="#2c4a63" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`
// a little sailboat for the big Play button
const BOAT = `<svg class="boatic" viewBox="0 0 32 32" aria-hidden="true"><path d="M15 4 V22" stroke="#7a4f33" stroke-width="2" stroke-linecap="round"/><path d="M16 5 L27 20 H16Z" fill="#fff" stroke="#2c4a63" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 8 L6 20 H14Z" fill="#ff7a5c" stroke="#2c4a63" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 23 H28 L25 28 H7Z" fill="#2f7de1" stroke="#2c4a63" stroke-width="1.6" stroke-linejoin="round"/></svg>`
// bubbles rising behind the menus
const BUBBLES = [...Array(10)].map((_, k) => `<i class="bubble" style="--x:${(k * 37 + 7) % 100}%;--d:${(k * 1.9) % 10}s;--t:${12 + (k * 3) % 8}s;--s:${6 + (k * 5) % 9}px"></i>`).join('')
const tierPips = (tier) => `<i class="pips">${[0, 1, 2].map((k) => `<b class="${k <= TIERS.indexOf(tier) ? 'on' : ''}"></b>`).join('')}</i>`
// how to play: one line a rule, each with a little picture
const RULES = [
  ['badge', 'Each island shows how many bridges it wants.'],
  ['drag', 'Drag from an island toward a neighbour to build a bridge. Drag again for a two-lane bridge.'],
  ['cross', 'Bridges run straight to the nearest island and never cross.'],
  ['join', 'Join every island into one network.'],
  ['fog', 'Fog hides some numbers. Work them out from their neighbours: the fog lifts when you win.'],
  ['swipe', 'Swipe across a bridge to take it down.'],
]
const RULE_ART = {
  badge: '<circle cx="20" cy="20" r="15" fill="#fffaf2" stroke="#2c4a63" stroke-width="2"/><path d="M20 5 a15 15 0 0 1 13 22" stroke="#4fb8d8" stroke-width="4" fill="none" stroke-linecap="round"/><text x="20" y="26" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="17" fill="#2c4a63">3</text>',
  drag: '<circle cx="8" cy="20" r="6" fill="#9edc78" stroke="#2c4a63" stroke-width="1.6"/><circle cx="32" cy="20" r="6" fill="#9edc78" stroke="#2c4a63" stroke-width="1.6"/><rect x="14" y="17" width="12" height="6" rx="1.5" fill="#e8b98a" stroke="#7a4f33" stroke-width="1.2"/><path d="M22 30 l4 -4" stroke="#ff7a5c" stroke-width="2.4" stroke-linecap="round"/>',
  cross: '<rect x="4" y="18" width="32" height="5" rx="1.5" fill="#e8b98a" stroke="#7a4f33" stroke-width="1.2"/><rect x="17.5" y="4" width="5" height="32" rx="1.5" fill="#e8b98a" stroke="#7a4f33" stroke-width="1.2" opacity=".45"/><path d="M12 8 L28 32 M28 8 L12 32" stroke="#ff5f6d" stroke-width="3" stroke-linecap="round"/>',
  join: '<circle cx="8" cy="8" r="5" fill="#9edc78" stroke="#2c4a63" stroke-width="1.4"/><circle cx="32" cy="8" r="5" fill="#9edc78" stroke="#2c4a63" stroke-width="1.4"/><circle cx="8" cy="32" r="5" fill="#9edc78" stroke="#2c4a63" stroke-width="1.4"/><circle cx="32" cy="32" r="5" fill="#9edc78" stroke="#2c4a63" stroke-width="1.4"/><path d="M13 8 H27 M32 13 V27 M8 13 V27" stroke="#c98d55" stroke-width="3"/>',
  fog: '<circle cx="14" cy="22" r="8" fill="#eef3fb" stroke="#7d8aa6" stroke-width="1.6"/><circle cx="26" cy="20" r="10" fill="#eef3fb" stroke="#7d8aa6" stroke-width="1.6"/><text x="22" y="26" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="14" fill="#7d8aa6">?</text>',
  swipe: '<rect x="4" y="17" width="32" height="6" rx="1.5" fill="#e8b98a" stroke="#7a4f33" stroke-width="1.2"/><path d="M10 34 Q20 18 32 6" stroke="#ff7a5c" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="1 5"/><path d="M28 6 h5 v5" stroke="#ff7a5c" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
}

document.querySelector('#app').innerHTML = `
  <div class="app" id="shell" data-screen="title">
    <section class="titlepage enter" id="titlepage">
      <img class="titlebg" src="title-sea.webp" alt="" draggable="false" aria-hidden="true">
      <h1 class="logo"><img src="title-logo.webp" alt="Tiny Isles" width="900" height="448" draggable="false"><i class="glint" aria-hidden="true" style="-webkit-mask-image:url(title-logo.webp);mask-image:url(title-logo.webp)"></i></h1>
      <div class="titlespace"></div>
      <p class="tagline">Little islands. Lovely bridges.</p>
      <nav class="titlebuttons">
        <button class="bigplay" id="title-play">${BOAT}<span>Play</span></button>
        <button class="titlebtn" id="title-learn">${icon('learn')}<span>How to play</span></button>
      </nav>
      <button class="round titlegear" id="title-settings" aria-label="Settings">${icon('settings')}</button>
    </section>
    <div class="menubg" aria-hidden="true"><img src="title-sea.webp" alt="" draggable="false"><span class="wash"></span>${BUBBLES}</div>
    <main class="home" id="home">
      <header class="homehead">
        <button class="round" id="home-back" aria-label="Back to the title">${icon('back')}</button>
        <div class="brand"><h1 class="hometitle">Today’s islands</h1></div>
        <button class="round" id="settings-home" aria-label="Settings">${icon('settings')}</button>
      </header>
      <div class="chips">
        <p class="date"><span id="date"></span></p>
        <span class="tag-chip shells" id="shells"></span>
      </div>
      <div class="todays" id="todays"></div>
      <footer class="homefoot">
        <div class="buddy">${GULL}<p class="hello" id="hello"></p></div>
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
      <div class="stage" id="stage"></div>
      <footer>
        <p class="say" id="say" aria-live="polite"></p>
        <div class="row">
          <button class="chip" id="undo">${icon('undo')}<span>Undo</span></button>
        </div>
      </footer>
      <section class="win" id="win" hidden>
        <h2>All connected!</h2>
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
        <button class="chip replay" id="settings-learn">${icon('learn')}<span>How to play</span></button>
        <button class="chip go" id="settingsdone">Done</button>
      </div>
    </section>
    <section class="picker" id="rulesheet" hidden>
      <div class="sheet rules" role="dialog" aria-labelledby="rulestitle">
        <div class="sheethead"><h2 id="rulestitle">How to play</h2><button class="round" id="closerules" aria-label="Close">${icon('close')}</button></div>
        <ol class="rulelist">${RULES.map(([art, text]) => `<li><svg viewBox="0 0 40 40" aria-hidden="true">${RULE_ART[art]}</svg><span>${text}</span></li>`).join('')}</ol>
        <button class="chip go" id="rulesdone">Let’s build!</button>
      </div>
    </section>
  </div>`
const $ = (id) => document.getElementById(id)

// done: the bridges of every solved puzzle; progress: the bridges laid so far on
// puzzles still being worked on. Both are keyed by puzzle id ("<day>-<tier>").
function loadSaved() {
  const empty = { done: {}, progress: {} }
  try { return { ...empty, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } } catch { return empty }
}
const saved = loadSaved()
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* private windows */ } }

const audio = new HarborAudio()
const scene = new IslandScene($('stage'))
const touch = new TouchFx($('stage'))
// every plank that lands plinks a little higher than the last
let lastPlank = 0
scene.onPlank = (along) => {
  const now = performance.now()
  if (now - lastPlank < 45) return
  lastPlank = now
  audio.play(`plank-${Math.min(7, Math.floor(along * 8))}`)
}
scene.onOpen = (lanes) => audio.play(`open-${lanes}`)

/* ---------- the home screen ---------- */

let current = null // the puzzle being played
let board, counts, history, won, tiers, happyCount = 0

const state = (id) => (saved.done[id] ? 'done' : saved.progress[id]?.some((n) => n) ? 'started' : 'new')

// A little map of a puzzle: its islands, and its bridges once some are laid.
function miniMap(p) {
  const counts = saved.done[p.id] ?? saved.progress[p.id]
  const s = 10
  const w = p.width * s, h = p.height * s
  const at = (i) => [p.burrows[i][1] * s + s / 2, p.burrows[i][0] * s + s / 2]
  let lines = ''
  if (counts) {
    buildBoard(p).edges.forEach((e) => {
      if (!counts[e.index]) return
      const [x1, y1] = at(e.a), [x2, y2] = at(e.b)
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${counts[e.index] === 2 ? 3.2 : 1.6}"/>`
    })
  }
  const dots = p.burrows.map(([, , , f], i) => {
    const [x, y] = at(i)
    return `<circle cx="${x}" cy="${y}" r="3.3" class="${f ? 'fog' : ''}"/>`
  }).join('')
  return `<svg class="map" viewBox="-2 -2 ${w + 4} ${h + 4}" aria-hidden="true"><g class="bridges">${lines}</g>${dots}</svg>`
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
  return h < 5 ? 'Ahoy, night owl' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// A puzzle as a card: its difficulty, a little map in a sea-blue frame, its name,
// its size, and what to do next (a joined one wears a round stamp).
function card(p, i) {
  const st = state(p.id)
  const status = { done: `${icon('check')}<span>Joined!</span>`, started: `${icon('play')}<span>Resume</span>`, new: `${icon('play')}<span>Play</span>` }[st]
  return `<button class="card ${st}" data-tier="${p.tier}" data-day="${p.day}" style="--i:${i}" aria-label="${TIER_NAMES[p.tier]}: ${p.name}, ${p.burrows.length} islands${p.fog ? ', with fog' : ''}${st === 'done' ? ', joined' : st === 'started' ? ', started' : ''}">
    <span class="planter">${miniMap(p)}</span>
    <span class="tier">${TIER_NAMES[p.tier]}${tierPips(p.tier)}</span>
    <span class="pname">${p.name}</span>
    <span class="meta">${p.width}×${p.height} · ${p.burrows.length} islands${p.fog ? ` · ${icon('cloud')} fog` : ''}</span>
    <span class="status">${status}</span>
  </button>`
}

function drawHome() {
  const now = today()
  $('date').textContent = dateOf(now).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const states = TIERS.map((tier) => state(`${now}-${tier}`))
  $('todays').innerHTML = TIERS.map((tier, i) => card(puzzle(now, tier), i)).join('')
  const solvedToday = states.filter((x) => x === 'done').length
  const n = streak(now)
  $('shells').innerHTML = `${n > 1 ? `<span class="flame">${icon('flame')}<b>${n}</b></span>` : ''}${TIERS.map((t, i) => `<i class="${t} ${states[i]}">${icon('shell')}</i>`).join('')}<span class="count">${solvedToday}/3</span>`
  $('hello').textContent = `${greeting()}! ${[
    'Three new islands rose from the sea today. Shall we build some bridges?',
    'One joined up, two to go. The others are waiting for bridges.',
    'Two joined! One last island town to go today.',
    'All of today’s islands are joined. New ones arrive tomorrow!',
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
  $('dayssummary').textContent = `${solved} of ${now * 3} puzzles joined`
  const weekdays = [...Array(7)].map((_, k) => new Date(Date.UTC(2024, 0, 1 + k)).toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' }))
  $('months').innerHTML = months.map(({ date }) => {
    const y = date.getUTCFullYear(), m = date.getUTCMonth()
    const first = new Date(Date.UTC(y, m, 1))
    const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const blanks = (first.getUTCDay() + 6) % 7 // weeks start on Monday
    const cells = [...Array(blanks)].map(() => '<span class="cell blank"></span>')
    for (let d = 1; d <= length; d++) {
      const day = dayOf(new Date(y, m, d))
      if (day < 1 || day > now) { cells.push(`<span class="cell off">${d}</span>`); continue }
      const sts = TIERS.map((t) => state(`${day}-${t}`))
      const all = sts.every((x) => x === 'done')
      cells.push(`<button class="cell${all ? ' complete' : ''}${day === now ? ' today' : ''}" data-day="${day}" aria-label="${dayLabel(day, now)}: ${sts.filter((x) => x === 'done').length} of 3 joined"><b>${d}</b><span class="dots">${TIERS.map((t, i) => `<i class="${t} ${sts[i]}"></i>`).join('')}</span></button>`)
    }
    return `<section class="month"><h2>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
      <div class="week">${weekdays.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal">${cells.join('')}</div></section>`
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
for (const id of ['title-learn', 'settings-learn']) $(id).onclick = () => { $('settingsheet').hidden = true; showSheet('rulesheet') }
for (const [button, sheet] of [['closesettings', 'settingsheet'], ['settingsdone', 'settingsheet'], ['closerules', 'rulesheet'], ['rulesdone', 'rulesheet']]) {
  $(button).onclick = () => { audio.play('back'); $(sheet).hidden = true }
}
for (const sheet of ['settingsheet', 'rulesheet', 'daysheet']) $(sheet).addEventListener('click', (ev) => { if (ev.target === $(sheet)) $(sheet).hidden = true })

/* ---------- moving between screens ---------- */

// "" is the title, #/today today's puzzles, #/days the calendar, and
// #/<day>/<tier> a puzzle. The phone's back gesture steps back through them.
let backTo = '#/today'
function route() {
  const m = location.hash.match(/^#\/(\d+)\/(easy|medium|hard)$/)
  const day = m && Number(m[1])
  const screen = m && day >= 1 && day <= today() ? 'game' : location.hash === '#/days' ? 'days' : location.hash === '#/today' ? 'home' : 'title'
  const was = $('shell').dataset.screen
  $('shell').dataset.screen = screen
  if (screen === 'game') {
    if (was !== 'game') { backTo = was === 'days' ? '#/days' : '#/today'; audio.play('start', { at: 0.1 }) }
    audio.setMood('play')
    start(day, m[2])
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
$('home-button').onclick = () => { audio.play('back'); location.hash = backTo }

/* ---------- playing a puzzle ---------- */

function start(day, tier) {
  current = puzzle(day, tier)
  board = buildBoard({ ...current, source: 0 })
  const solved = saved.done[current.id]
  const kept = solved ?? saved.progress[current.id]
  counts = kept && kept.length === board.edges.length ? kept.slice() : board.edges.map(() => 0)
  history = []
  won = Boolean(solved)
  tiers = board.burrows.map(() => 0)
  happyCount = 0
  $('win').hidden = true
  $('name').textContent = current.name
  $('game').dataset.tier = tier
  scene.load(board, { seed: day * 3 + TIERS.indexOf(tier) })
  refresh(true)
  const first = !Object.keys(saved.done).length && !Object.keys(saved.progress).length
  if (won) say('Solved! Restart to play it again.')
  else if (first) say('Drag from an island toward a neighbour to build a bridge. The number is how many bridges it wants.')
  else if (current.fog && !saved.seenFog) {
    saved.seenFog = true
    save()
    say('Fog hides some islands’ numbers. Work them out from their neighbours: the fog lifts when everything joins up.')
  } else if (counts.some((n) => n)) say('Welcome back. Your bridges are just as you left them.')
  else say(current.fog ? 'Fog hides some numbers. Every island still wants exactly its number of bridges.' : 'Every island wants its number of bridges, and all of them must join up.')
}

const say = (text) => { $('say').textContent = text }

function refresh(quiet = false) {
  const d = degrees(board, counts)
  const st = boardStatus(board, counts)
  const next = board.burrows.map((b) => Math.min(8, d[b.index]))
  // a city growing sparkles, higher for bigger cities (only the biggest jump plays)
  const grew = next.reduce((top, t, i) => (t > tiers[i] ? Math.max(top, t) : top), 0)
  if (!quiet && grew) audio.play(`grow-${grew}`, { at: 0.12 })
  tiers = next
  // a fog island gives nothing away: it only turns happy when the fog lifts on a win
  const happy = (b) => (b.fog ? won : d[b.index] === b.value)
  // each island that gets exactly its number dings, a step higher each time
  const happyNow = board.burrows.filter((b) => !b.fog && happy(b)).length
  if (!quiet && !won && happyNow > happyCount) audio.play(`happy-${Math.min(6, happyNow - 1)}`, { at: 0.2 })
  happyCount = happyNow
  scene.setIslands(board.burrows.map((b) => ({ tier: next[b.index], have: d[b.index], done: happy(b), over: !b.fog && d[b.index] > b.value, fog: b.fog && !won })))
  scene.setBridges(counts)
  const known = board.burrows.filter((b) => !b.fog)
  const fogNote = known.length < board.burrows.length && !won ? ` · ${board.burrows.length - known.length} in fog` : ''
  const counted = won ? board.burrows : known
  $('prog').textContent = `${dayLabel(current.day)} · ${TIER_NAMES[current.tier]} · ${counted.filter(happy).length}/${counted.length} happy${fogNote}`
  $('undo').disabled = !history.length || won
  return st
}

function apply(edge, next) {
  const before = counts[edge]
  if (before === next || won) return false
  if (!before && next) {
    const blocker = blockedBy(board, counts, edge)
    if (blocker !== undefined) {
      audio.play('bonk')
      buzz([10, 40, 10])
      scene.shakeBridge(blocker)
      say("Bridges can't cross. Take the other one down first.")
      return false
    }
  }
  history.push([edge, before])
  counts[edge] = next
  keep()
  const e = board.edges[edge]
  scene.bounce(e.a)
  scene.bounce(e.b)
  if (next > before) buzz(12)
  else { audio.play('splash'); buzz(8) }
  const st = refresh()
  const d = st.degree
  if ([e.a, e.b].some((i) => !board.burrows[i].fog && d[i] > board.burrows[i].value)) say('That island has more bridges than its number. Swipe across a bridge to take it down.')
  else if (st.closed.length) say('Some islands are closed off from the rest. Every island must join up.')
  else if (next === 2 && before === 1) say('A two-lane bridge: twice the traffic!')
  else {
    const left = board.burrows.filter((b) => !b.fog && d[b.index] !== b.value).length
    say(left ? `${left} ${left === 1 ? 'island still wants' : 'islands still want'} bridges.` : 'Every number is met. Now join every island, fog and all.')
  }
  if (st.complete) win()
  return true
}

// remember the bridges laid so far, so a puzzle can be picked up later
function keep() {
  if (counts.some((n) => n)) saved.progress[current.id] = counts.slice()
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
  saved.done[current.id] = counts.slice()
  delete saved.progress[current.id]
  save()
  refresh(true)
  say('Every island is connected. Look at those cities!')
  const shown = current.id
  setTimeout(() => {
    if (current?.id !== shown) return
    audio.play('win')
    audio.duck(5)
    scene.celebrate()
    setTimeout(() => {
      if (current?.id !== shown) return
      const next = nextPuzzle()
      $('winmeta').textContent = `${board.burrows.length} islands and ${counts.reduce((a, b) => a + b, 0)} bridges in ${current.name}.${current.fog ? ' The fog has lifted!' : ''}`
      $('winnext').hidden = !next
      if (next) {
        $('winnext').textContent = next.day === current.day ? `Next: ${TIER_NAMES[next.tier]}` : `Today’s ${TIER_NAMES[next.tier]}`
        $('winnext').onclick = () => { location.hash = `#/${next.day}/${next.tier}` }
      }
      $('win').hidden = false
    }, 2200)
  }, 600)
}

const buzz = (pattern) => { try { navigator.vibrate?.(pattern) } catch { /* not allowed here */ } }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/* ---------- building bridges: drag from an island toward a neighbour ---------- */
let drag = null
let selected = null
const canvas = scene.renderer.domElement
canvas.style.touchAction = 'none'

canvas.addEventListener('pointerdown', (ev) => {
  audio.unlock()
  const p = scene.toWorld(ev.clientX, ev.clientY)
  if (!p) return
  if (!current) {
    // on the home screen, tapping one of today's islands opens its puzzle
    const island = scene.islandAt(p)
    if (island !== null) { scene.bounce(island); audio.play('press'); setTimeout(() => play(today(), TIERS[island]), 180) }
    else audio.play(`drip-${Math.floor(Math.random() * 4)}`)
    return
  }
  if (won) return
  canvas.setPointerCapture(ev.pointerId)
  const island = scene.islandAt(p)
  drag = { id: ev.pointerId, island, start: p, last: p, cut: new Set(), sx: ev.clientX, sy: ev.clientY, moved: false, edge: null, progress: 0, shown: 0, snapped: false }
  touch.ripple(ev.clientX, ev.clientY, island !== null)
  if (island !== null) { scene.bounce(island); audio.play('press') } else touch.startSwipe(ev.clientX, ev.clientY)
})

canvas.addEventListener('pointermove', (ev) => {
  if (!drag || drag.id !== ev.pointerId) return
  const p = scene.toWorld(ev.clientX, ev.clientY)
  if (!p) return
  if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 9) drag.moved = true
  if (drag.island === null) {
    touch.extend(ev.clientX, ev.clientY)
    if (drag.moved) cutAcross(drag.last, p, ev)
    drag.last = p
    return
  }
  if (!drag.moved) return
  const o = scene.pos(drag.island)
  const dx = p.x - o.x, dz = p.z - o.z
  const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : dz > 0 ? 'down' : 'up'
  const edge = board.neighbors[drag.island][dir] ?? null
  if (edge !== drag.edge) { drag.edge = edge; drag.shown = 0; drag.snapped = false }
  if (edge === null) { drag.progress = 0; return }
  const [a, b] = scene.ends(edge, drag.island)
  const total = a.distanceTo(b)
  const along = (dir === 'left' || dir === 'right' ? Math.abs(p.x - a.x) * Math.sign((p.x - a.x) * (b.x - a.x)) : Math.abs(p.z - a.z) * Math.sign((p.z - a.z) * (b.z - a.z)))
  drag.progress = clamp(along / total, 0, 1)
})

// A swipe that starts out on the water takes down every bridge it passes over,
// single or double, each as its own step to undo.
const side = (p, a, b) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
const crosses = (p1, p2, q1, q2) => side(p1, q1, q2) * side(p2, q1, q2) < 0 && side(q1, p1, p2) * side(q2, p1, p2) < 0
function cutAcross(from, to, ev) {
  for (const e of board.edges) {
    if (!counts[e.index] || drag.cut.has(e.index)) continue
    const [a, b] = scene.ends(e.index)
    if (!crosses(from, to, a, b)) continue
    drag.cut.add(e.index)
    audio.play('snip')
    touch.cut(ev.clientX, ev.clientY)
    scene.droplets(to, 6)
    apply(e.index, 0)
  }
}

function endDrag(ev) {
  if (!drag || drag.id !== ev.pointerId) return
  const d = drag
  drag = null
  if (d.island !== null && d.moved) {
    // a snapped bridge opens right where it was dragged out
    if (d.snapped && d.edge !== null) apply(d.edge, (counts[d.edge] + 1) % 3)
    else if (d.edge !== null && d.shown > 0.05) audio.play('back')
    scene.setPreview(null)
    return
  }
  scene.setPreview(null)
  if (d.moved) return
  const island = scene.islandAt(d.start)
  if (island !== null) {
    // tap an island, then a neighbour, to build between them
    if (selected !== null && selected !== island) {
      const dir = Object.keys(board.neighbors[selected]).find((k) => {
        const e = board.edges[board.neighbors[selected][k]]
        return e.a === island || e.b === island
      })
      const from = selected
      selected = null
      if (dir) return void apply(board.neighbors[from][dir], (counts[board.neighbors[from][dir]] + 1) % 3)
    }
    selected = selected === island ? null : island
    if (selected !== null) { scene.bounce(island); audio.play('press') }
    return
  }
  const t = scene.bridgeAt(d.start)
  selected = null
  if (t !== null) apply(t, (counts[t] + 1) % 3)
  else audio.play(`drip-${Math.floor(Math.random() * 4)}`) // a tap on the open sea
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', (ev) => { if (drag?.id === ev.pointerId) { drag = null; scene.setPreview(null) } })

// The bridge follows the finger plank by plank, and past halfway it snaps across.
function updateDrag(dt) {
  if (!current || !drag || drag.island === null || drag.edge === null) return
  const n = counts[drag.edge]
  if (n === 2) {
    // a third drag takes the bridge down: no preview, just the snap
    const want = drag.progress > 0.55
    if (want && !drag.snapped) { drag.snapped = true; audio.play('snap'); buzz(8) }
    if (!want) drag.snapped = false
    scene.setPreview(null)
    return
  }
  const blocked = !n && blockedBy(board, counts, drag.edge) !== undefined
  const snap = drag.progress > 0.55 && !blocked
  const target = snap ? 1 : Math.min(drag.progress, blocked ? 0.35 : 1)
  drag.shown += (target - drag.shown) * (1 - Math.exp(-dt * (snap ? 20 : 15)))
  if (snap && !drag.snapped) {
    drag.snapped = true
    audio.play('snap')
    buzz(8)
    const e = board.edges[drag.edge]
    scene.bounce(e.a === drag.island ? e.b : e.a)
  } else if (!snap) drag.snapped = false
  scene.setPreview({ edge: drag.edge, from: drag.island, lanes: n + 1, progress: drag.shown, blocked })
}

/* ---------- buttons ---------- */
$('winhome').onclick = () => { location.hash = '#/today' }
$('undo').onclick = () => {
  if (!history.length || won) return
  const [edge, before] = history.pop()
  counts[edge] = before
  keep()
  audio.play('undo')
  refresh()
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
  // the sea is only drawn while a puzzle is open
  if (current && !document.hidden) {
    if (!capture) scene.tune(now - last)
    const dt = Math.min(0.05, (now - last) / 1000)
    updateDrag(dt)
    scene.update(dt)
    scene.render()
    if (touch.busy || touch.drawn) { touch.update(dt); touch.drawn = touch.busy }
  }
  last = now
  requestAnimationFrame(frame)
}
// Turning a phone rebuilds the sea to fit; bridges and cities carry over.
let resizeTimer = 0
let shape = innerHeight / innerWidth
addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const now = innerHeight / innerWidth
    if (Math.abs(now - shape) < 0.25 || !current) return
    shape = now
    scene.load(board, { seed: current.day * 3 + TIERS.indexOf(current.tier) })
    refresh(true)
  }, 300)
})
// a new day may have begun while the home screen sat open
addEventListener('visibilitychange', () => { if (!document.hidden && !current) route() })
route()
requestAnimationFrame(frame)

// Hooks for the visual tests.
window.__isles = {
  scene, apply, touch, audio,
  start(day, tier) { location.hash = `#/${day}/${tier}`; route() },
  home() { location.hash = ''; route() },
  get counts() { return counts },
  get board() { return board },
  get current() { return current },
  solution() { return solve(board)[0] },
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) { updateDrag(1 / 30); scene.update(1 / 30); touch.update(1 / 30) } scene.render() },
}
