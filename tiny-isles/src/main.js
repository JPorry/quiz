import { buildBoard, blockedBy, degrees, solve, status as boardStatus } from './logic.js'
import { TIERS, TIER_NAMES, puzzle, today, dayLabel, dateOf } from './puzzles.js'
import { IslandScene } from './scene.js'
import { Sounds } from './sounds.js'
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
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.8 2.3-5 .2 1.7 1 2.8 2.2 3.2C11 9 10.8 6 12 3z"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

document.querySelector('#app').innerHTML = `
  <div class="app" id="shell" data-screen="home">
    <main class="home" id="home">
      <div class="hero">
        <svg class="logo" viewBox="0 0 64 44" aria-hidden="true">
          <ellipse cx="32" cy="36" rx="28" ry="6" fill="#8fe3e6"/>
          <path d="M9 32c0-9 10-15 23-15s23 6 23 15c0 3-10 5-23 5S9 35 9 32z" fill="#f6dfae" stroke="#5e4a58" stroke-width="2"/>
          <path d="M12 28c2-6 10-10 20-10s18 4 20 10c-6 2-13 3-20 3s-14-1-20-3z" fill="#9edc78"/>
          <rect x="22" y="10" width="7" height="16" rx="2" fill="#b5dcff" stroke="#5e4a58" stroke-width="2"/>
          <rect x="31" y="4" width="8" height="22" rx="2.5" fill="#d8ecff" stroke="#5e4a58" stroke-width="2"/>
          <path d="M41 26v-8l5-3 5 3v8" fill="#fff3e2" stroke="#5e4a58" stroke-width="2" stroke-linejoin="round"/>
          <path d="M40 18.5l6-4.5 6 4.5" fill="none" stroke="#ff8270" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div><h1>Tiny Isles</h1><p id="date"></p></div>
        <button class="round" id="sound" aria-label="Sound">${icon('sound')}</button>
      </div>
      <section class="today">
        <div class="todayhead"><h2>Today’s islands</h2><p class="streak" id="streak"></p></div>
        <div class="cards" id="cards"></div>
      </section>
      <section class="earlier">
        <h2>Earlier days</h2>
        <ol class="days" id="days"></ol>
      </section>
    </main>
    <div class="game" id="game">
      <header>
        <button class="round" id="home-button" aria-label="Back to all puzzles">${icon('back')}</button>
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

const sounds = new Sounds()
const scene = new IslandScene($('stage'))
const touch = new TouchFx($('stage'))
// every plank that lands plinks a little higher than the last
let lastPlank = 0
scene.onPlank = (along) => {
  const now = performance.now()
  if (now - lastPlank < 45) return
  lastPlank = now
  sounds.lay(along)
}
scene.onOpen = (lanes) => sounds.open(lanes)

/* ---------- the home screen ---------- */

let current = null // the puzzle being played
let board, counts, history, won, built, tiers

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

function drawHome() {
  const now = today()
  $('date').textContent = dateOf(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  $('cards').innerHTML = TIERS.map((tier) => {
    const p = puzzle(now, tier)
    const st = state(p.id)
    const label = { done: `${icon('check')} Solved`, started: 'Resume', new: 'Play' }[st]
    return `<button class="card ${st}" data-tier="${tier}" data-day="${now}" aria-label="${TIER_NAMES[tier]}: ${p.name}, ${p.burrows.length} islands${p.fog ? ', with fog' : ''}">
      <span class="tier">${TIER_NAMES[tier]}</span>
      ${miniMap(p)}
      <span class="pname">${p.name}</span>
      <span class="meta"><span>${p.burrows.length} islands</span>${p.fog ? `<span class="fogtag">${icon('cloud')} Fog</span>` : ''}</span>
      <span class="status">${label}</span>
    </button>`
  }).join('')
  const n = streak(now)
  const solvedToday = TIERS.filter((t) => saved.done[`${now}-${t}`]).length
  $('streak').innerHTML = n > 1 ? `${icon('flame')} ${n}-day streak` : `${solvedToday} of 3 solved`
  const rows = []
  for (let day = now - 1; day >= 1; day--) {
    const pills = TIERS.map((tier) => {
      const p = puzzle(day, tier)
      const st = state(p.id)
      return `<button class="pill ${st}" data-tier="${tier}" data-day="${day}" aria-label="${TIER_NAMES[tier]}: ${p.name}${p.fog ? ', with fog' : ''}${st === 'done' ? ', solved' : st === 'started' ? ', started' : ''}">${TIER_NAMES[tier]}${p.fog ? `<i class="fogdot">${icon('cloud')}</i>` : ''}</button>`
    }).join('')
    const all = TIERS.every((t) => saved.done[`${day}-${t}`])
    rows.push(`<li class="${all ? 'complete' : ''}"><span class="when">${dayLabel(day, now)}</span><span class="pills">${pills}</span></li>`)
  }
  $('days').innerHTML = rows.join('') || '<li class="none">Earlier days will gather here.</li>'
}

$('home').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tier]')
  if (!b) return
  sounds.unlock()
  location.hash = `#/${b.dataset.day}/${b.dataset.tier}`
})

/* ---------- moving between screens ---------- */

// #/<day>/<tier> plays a puzzle; anything else is home. The phone's back
// gesture goes home from a puzzle.
function route() {
  const m = location.hash.match(/^#\/(\d+)\/(easy|medium|hard)$/)
  const day = m && Number(m[1])
  if (m && day >= 1 && day <= today()) {
    $('shell').dataset.screen = 'game'
    start(day, m[2])
  } else {
    $('shell').dataset.screen = 'home'
    current = null
    drawHome()
  }
}
addEventListener('hashchange', route)
$('home-button').onclick = () => { location.hash = '' }

/* ---------- playing a puzzle ---------- */

function start(day, tier) {
  current = puzzle(day, tier)
  board = buildBoard({ ...current, source: 0 })
  const solved = saved.done[current.id]
  const kept = solved ?? saved.progress[current.id]
  counts = kept && kept.length === board.edges.length ? kept.slice() : board.edges.map(() => 0)
  history = []
  won = Boolean(solved)
  built = 0
  tiers = board.burrows.map(() => 0)
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
  if (!quiet) next.forEach((t, i) => { if (t > tiers[i]) sounds.grow(t) })
  tiers = next
  // a fog island gives nothing away: it only turns happy when the fog lifts on a win
  const happy = (b) => (b.fog ? won : d[b.index] === b.value)
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
      sounds.bonk()
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
  if (next > before) { sounds.build(++built); buzz(12) } else { sounds.splash(); buzz(8) }
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
    sounds.win()
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
  sounds.unlock()
  if (won) return
  const p = scene.toWorld(ev.clientX, ev.clientY)
  if (!p) return
  canvas.setPointerCapture(ev.pointerId)
  const island = scene.islandAt(p)
  drag = { id: ev.pointerId, island, start: p, last: p, cut: new Set(), sx: ev.clientX, sy: ev.clientY, moved: false, edge: null, progress: 0, shown: 0, snapped: false }
  touch.ripple(ev.clientX, ev.clientY, island !== null)
  if (island !== null) { scene.bounce(island); sounds.press() } else touch.startSwipe(ev.clientX, ev.clientY)
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
    sounds.snip()
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
    else if (d.edge !== null && d.shown > 0.05) sounds.undo()
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
    if (selected !== null) { scene.bounce(island); sounds.press() }
    return
  }
  const t = scene.bridgeAt(d.start)
  selected = null
  if (t !== null) apply(t, (counts[t] + 1) % 3)
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', (ev) => { if (drag?.id === ev.pointerId) { drag = null; scene.setPreview(null) } })

// The bridge follows the finger plank by plank, and past halfway it snaps across.
function updateDrag(dt) {
  if (!drag || drag.island === null || drag.edge === null) return
  const n = counts[drag.edge]
  if (n === 2) {
    // a third drag takes the bridge down: no preview, just the snap
    const want = drag.progress > 0.55
    if (want && !drag.snapped) { drag.snapped = true; sounds.snap(); buzz(8) }
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
    sounds.snap()
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
  sounds.undo()
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
  // a solved puzzle stays solved; restarting just clears the board to play again
  delete saved.progress[current.id]
  const solved = saved.done[current.id]
  delete saved.done[current.id]
  start(current.day, current.tier)
  if (solved) saved.done[current.id] = solved
  save()
}
const syncSound = () => { for (const id of ['sound', 'sound2']) $(id).innerHTML = icon(sounds.enabled ? 'sound' : 'mute') }
for (const id of ['sound', 'sound2']) $(id).onclick = () => { sounds.unlock(); sounds.enabled = !sounds.enabled; syncSound() }
syncSound()
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
addEventListener('visibilitychange', () => { if (!document.hidden && !current) drawHome() })
route()
requestAnimationFrame(frame)

// Hooks for the visual tests.
window.__isles = {
  scene, apply, touch,
  start(day, tier) { location.hash = `#/${day}/${tier}`; route() },
  home() { location.hash = ''; route() },
  get counts() { return counts },
  get board() { return board },
  get current() { return current },
  solution() { return solve(board)[0] },
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) { updateDrag(1 / 30); scene.update(1 / 30); touch.update(1 / 30) } scene.render() },
}
