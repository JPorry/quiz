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
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

document.querySelector('#app').innerHTML = `
  <div class="app" id="shell" data-screen="home">
    <main class="home" id="home">
      <div class="clouds" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="homehead">
        <div class="brand">
          <h1 class="title" aria-label="Tiny Isles">${[...'Tiny Isles'].map((c, i) => (c === ' ' ? '<span class="gap"></span>' : `<span style="--i:${i}">${c}</span>`)).join('')}</h1>
          <p class="date" id="date"></p>
        </div>
        <button class="round" id="sound" aria-label="Sound">${icon('sound')}</button>
      </header>
      <div class="chips">
        <span class="tag-chip streak" id="streak"></span>
        <span class="tag-chip shells" id="shells"></span>
      </div>
      <div class="homestage" id="homestage"><div class="labels" id="labels"></div></div>
      <footer class="homefoot">
        <p class="hello" id="hello"></p>
        <button class="chip daysbutton" id="open-days">${icon('calendar')}<span>Earlier days</span><b class="count" id="catchup" hidden></b></button>
      </footer>
    </main>
    <section class="dayspage" id="dayspage">
      <header class="dayshead">
        <button class="round" id="days-back" aria-label="Back home">${icon('back')}</button>
        <div class="titles"><h1>Earlier days</h1><p id="dayssummary"></p></div>
      </header>
      <div class="months" id="months"></div>
      <div class="daysheet" id="daysheet" hidden>
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
        <button class="round" id="sound2" aria-label="Sound">${icon('sound')}</button>
      </header>
      <div class="stage" id="stage"></div>
      <footer>
        <p class="say" id="say" aria-live="polite"></p>
        <div class="row">
          <button class="chip" id="undo">${icon('undo')}<span>Undo</span></button>
          <button class="chip" id="restart">${icon('restart')}<span>Restart</span></button>
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
    <div class="soundmenu" id="soundmenu" hidden>
      <button class="toggle" id="toggle-music" aria-pressed="true">${icon('music')}<span>Music</span><i></i></button>
      <button class="toggle" id="toggle-fx" aria-pressed="true">${icon('sound')}<span>Sounds</span><i></i></button>
    </div>
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

// Today's three islands sit on the home screen's sea in a little staircase,
// easy at the front up to hard at the back. Each city shows how its puzzle is
// going: a cottage when untouched, a town once started, a skyline when solved.
const HOME = { width: 3, height: 3, burrows: [[2, 0, 3], [1, 1, 5], [0, 2, 7]] }
const HOME_TIER = { new: 0, started: 3, done: 8 }

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function drawHome() {
  const now = today()
  $('date').textContent = dateOf(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const states = TIERS.map((tier) => state(`${now}-${tier}`))
  scene.mount($('homestage'))
  scene.load(buildBoard(HOME), { seed: now, badges: false, headroom: 1.6 })
  scene.setIslands(TIERS.map((tier, i) => ({ tier: HOME_TIER[states[i]], have: 0, done: states[i] === 'done', over: false })))
  scene.setBridges([])
  $('labels').innerHTML = TIERS.map((tier, i) => {
    const p = puzzle(now, tier)
    const st = states[i]
    const action = { done: `${icon('check')} Solved`, started: `${icon('play')} Resume`, new: `${icon('play')} Play` }[st]
    return `<button class="label ${st}" data-tier="${tier}" data-day="${now}" style="--i:${i}" aria-label="${TIER_NAMES[tier]}: ${p.name}, ${p.burrows.length} islands${p.fog ? ', with fog' : ''}, ${st === 'done' ? 'solved' : st === 'started' ? 'started' : 'not started'}">
      <span class="ltier">${TIER_NAMES[tier]}${p.fog ? ` ${icon('cloud')}` : ''}</span>
      <span class="lname">${p.name}</span>
      <span class="lgo">${action}</span>
    </button>`
  }).join('')
  placeLabels()
  const solvedToday = states.filter((s) => s === 'done').length
  const n = streak(now)
  $('streak').innerHTML = `${icon('flame')} ${n} day${n === 1 ? '' : 's'}`
  $('streak').hidden = n < 1
  $('shells').innerHTML = TIERS.map((t, i) => `<i class="${t} ${states[i]}">${icon('shell')}</i>`).join('') + `<span>${solvedToday}/3 today</span>`
  $('hello').textContent = `${greeting()}! ${[
    'Three new islands rose from the sea today. Tap one to start building.',
    'One down, two to go. The others are waiting for bridges.',
    'Two joined up! One last island to go today.',
    'All of today’s islands are joined. New ones arrive tomorrow!',
  ][solvedToday]}`
  let missed = 0
  for (let day = 1; day < now; day++) missed += TIERS.filter((t) => !saved.done[`${day}-${t}`]).length
  $('catchup').hidden = !missed
  $('catchup').textContent = missed > 99 ? '99+' : missed
}

// the labels float above their islands
function placeLabels() {
  const box = $('homestage').getBoundingClientRect()
  document.querySelectorAll('.label').forEach((el, i) => {
    const is = scene.islands?.[i]
    if (!is) return
    const p = is.group.position.clone()
    p.y = 0.75 + is.r * 0.6
    const { x, y } = scene.toScreen(p)
    el.style.left = `${x - box.left}px`
    el.style.top = `${y - box.top}px`
  })
}

/* ---------- earlier days: a calendar, month by month ---------- */

function drawDays() {
  const now = today()
  const months = []
  for (let day = now; day >= 1; day--) {
    const date = dateOf(day)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    if (!months.length || months.at(-1).key !== key) months.push({ key, date, days: [] })
  }
  let solved = 0
  for (let day = 1; day <= now; day++) solved += TIERS.filter((t) => saved.done[`${day}-${t}`]).length
  $('dayssummary').textContent = `${solved} of ${now * 3} puzzles solved`
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
      cells.push(`<button class="cell${all ? ' complete' : ''}${day === now ? ' today' : ''}" data-day="${day}" aria-label="${dayLabel(day, now)}: ${sts.filter((x) => x === 'done').length} of 3 solved"><b>${d}</b><span class="dots">${TIERS.map((t, i) => `<i class="${t} ${sts[i]}"></i>`).join('')}</span></button>`)
    }
    return `<section class="month"><h2>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
      <div class="week">${weekdays.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal">${cells.join('')}</div></section>`
  }).join('')
}

function openDay(day) {
  $('sheetdate').textContent = day === today() ? 'Today' : dateOf(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  $('cards').innerHTML = TIERS.map((tier) => {
    const p = puzzle(day, tier)
    const st = state(p.id)
    const label = { done: `${icon('check')} Solved`, started: 'Resume', new: 'Play' }[st]
    return `<button class="card ${st}" data-tier="${tier}" data-day="${day}" aria-label="${TIER_NAMES[tier]}: ${p.name}, ${p.burrows.length} islands${p.fog ? ', with fog' : ''}">
      <span class="tier">${TIER_NAMES[tier]}</span>
      ${miniMap(p)}
      <span class="pname">${p.name}</span>
      <span class="meta"><span>${p.burrows.length} islands</span>${p.fog ? `<span class="fogtag">${icon('cloud')} Fog</span>` : ''}</span>
      <span class="status">${label}</span>
    </button>`
  }).join('')
  $('daysheet').hidden = false
}

const play = (day, tier) => { audio.unlock(); audio.play('tap'); location.hash = `#/${day}/${tier}` }
$('labels').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tier]')
  if (b) play(b.dataset.day, b.dataset.tier)
})
$('cards').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tier]')
  if (b) play(b.dataset.day, b.dataset.tier)
})
$('months').addEventListener('click', (ev) => {
  const c = ev.target.closest('.cell[data-day]')
  if (c) { audio.unlock(); audio.play('swoosh'); openDay(Number(c.dataset.day)) }
})
$('open-days').onclick = () => { audio.unlock(); audio.play('tap'); location.hash = '#/days' }
$('days-back').onclick = () => { audio.play('back'); location.hash = '' }
$('sheetclose').onclick = () => { audio.play('back'); $('daysheet').hidden = true }
$('daysheet').onclick = (ev) => { if (ev.target === $('daysheet')) $('daysheet').hidden = true }

/* ---------- moving between screens ---------- */

// #/<day>/<tier> plays a puzzle, #/days is the calendar, anything else is home.
// The phone's back gesture steps back through them.
let backTo = ''
function route() {
  const m = location.hash.match(/^#\/(\d+)\/(easy|medium|hard)$/)
  const day = m && Number(m[1])
  const screen = m && day >= 1 && day <= today() ? 'game' : location.hash === '#/days' ? 'days' : 'home'
  const was = $('shell').dataset.screen
  $('shell').dataset.screen = screen
  if (screen === 'game') {
    if (was !== 'game') { backTo = was === 'days' ? '#/days' : ''; audio.play('start', { at: 0.1 }) }
    audio.setMood('play')
    scene.mount($('stage'))
    start(day, m[2])
    return
  }
  current = null
  audio.setMood(screen)
  if (screen === 'days') { $('daysheet').hidden = true; drawDays() } else drawHome()
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
$('winhome').onclick = () => { location.hash = '' }
$('undo').onclick = () => {
  if (!history.length || won) return
  const [edge, before] = history.pop()
  counts[edge] = before
  keep()
  audio.play('undo')
  refresh()
}
let armed = false
$('restart').onclick = () => {
  const label = $('restart').querySelector('span')
  if (!armed) {
    armed = true
    label.textContent = 'Sure?'
    setTimeout(() => { armed = false; label.textContent = 'Restart' }, 2200)
    return
  }
  armed = false
  label.textContent = 'Restart'
  audio.play('restart')
  // a solved puzzle stays solved; restarting just clears the board to play again
  delete saved.progress[current.id]
  const solved = saved.done[current.id]
  delete saved.done[current.id]
  start(current.day, current.tier)
  if (solved) saved.done[current.id] = solved
  save()
}
// The speaker button opens a little menu with the music and the sounds, each its own switch.
function syncSound() {
  for (const id of ['sound', 'sound2']) $(id).innerHTML = icon(audio.music || audio.effects ? 'sound' : 'mute')
  $('toggle-music').setAttribute('aria-pressed', audio.music)
  $('toggle-fx').setAttribute('aria-pressed', audio.effects)
}
for (const id of ['sound', 'sound2']) {
  $(id).onclick = (ev) => {
    ev.stopPropagation()
    audio.unlock()
    const menu = $('soundmenu')
    if (!menu.hidden) { menu.hidden = true; return }
    const r = $(id).getBoundingClientRect()
    menu.style.top = `${r.bottom + 8}px`
    menu.style.right = `${innerWidth - r.right}px`
    menu.hidden = false
    audio.play('tap')
  }
}
$('toggle-music').onclick = () => { audio.setMusic(!audio.music); audio.play('tap'); syncSound() }
$('toggle-fx').onclick = () => { audio.setEffects(!audio.effects); audio.play('tap'); syncSound() }
addEventListener('pointerdown', (ev) => { if (!ev.target.closest('#soundmenu, #sound, #sound2')) $('soundmenu').hidden = true })
syncSound()
addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z' && current) $('undo').click() })

/* ---------- loop ---------- */
let last = performance.now()
// test captures run slowly in software rendering, so they keep their resolution
const capture = new URLSearchParams(location.search).has('capture')
function frame(now) {
  // the sea is drawn on the home screen and while a puzzle is open
  const home = $('shell').dataset.screen === 'home'
  if ((current || home) && !document.hidden) {
    if (!capture) scene.tune(now - last)
    const dt = Math.min(0.05, (now - last) / 1000)
    updateDrag(dt)
    scene.update(dt)
    scene.render()
    if (touch.busy || touch.drawn) { touch.update(dt); touch.drawn = touch.busy }
    if (home) placeLabels()
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
