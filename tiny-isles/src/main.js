import { POOLS } from './levels.js'
import { buildBoard, blockedBy, degrees, status as boardStatus } from './logic.js'
import { IslandScene } from './scene.js'
import { Sounds } from './sounds.js'
import { TouchFx } from './touch.js'
import './style.css'

const STORAGE_KEY = 'tiny-isles.v2'
const POOL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
// every level in play order, easy to hard, each knowing which pool it is in
const LEVELS = Object.entries(POOLS).flatMap(([pool, levels]) => levels.map((level, k) => ({ ...level, pool, number: k + 1, fog: level.burrows.some((b) => b[3]) })))

const ICON = {
  prev: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.5A3.3 3.3 0 0 0 7 18z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

document.querySelector('#app').innerHTML = `
  <div class="app">
    <header>
      <button class="badge" id="num" aria-label="Choose a level">1</button>
      <div class="titles"><h1 id="name"></h1><p id="prog"></p></div>
      <button class="round" id="sound" aria-label="Sound">${icon('sound')}</button>
      <button class="round" id="prev" aria-label="Previous level">${icon('prev')}</button>
      <button class="round" id="next" aria-label="Next level">${icon('next')}</button>
    </header>
    <div class="stage" id="stage"></div>
    <footer>
      <p class="say" id="say" aria-live="polite"></p>
      <div class="row">
        <button class="chip" id="undo">${icon('undo')}<span>Undo</span></button>
        <button class="chip" id="restart">${icon('restart')}<span>Restart</span></button>
      </div>
    </footer>
    <section class="picker" id="picker" hidden>
      <div class="sheet">
        <div class="sheethead"><h2>Choose a puzzle</h2><button class="round" id="closepicker" aria-label="Close">${icon('close')}</button></div>
        <div class="tabs" id="tabs" role="tablist"></div>
        <div class="grid" id="grid"></div>
        <p class="legend">${icon('cloud')} Fog hides some islands' numbers.</p>
      </div>
    </section>
    <section class="win" id="win" hidden>
      <h2>All connected!</h2>
      <p id="winmeta"></p>
      <button class="chip go" id="winnext">Next level</button>
    </section>
  </div>`
const $ = (id) => document.getElementById(id)

function loadSaved() {
  try { return { level: 0, done: [], ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } } catch { return { level: 0, done: [] } }
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
let levelIndex = Math.min(saved.level ?? 0, LEVELS.length - 1)
let board, counts, history, won, built, tiers

function start(index) {
  levelIndex = (index + LEVELS.length) % LEVELS.length
  saved.level = levelIndex
  save()
  board = buildBoard({ ...LEVELS[levelIndex], source: 0 })
  counts = board.edges.map(() => 0)
  history = []
  won = false
  built = 0
  tiers = board.burrows.map(() => 0)
  $('win').hidden = true
  const level = LEVELS[levelIndex]
  $('num').textContent = level.number
  $('num').dataset.pool = level.pool
  $('name').textContent = level.name
  scene.load(board, { seed: 5 + levelIndex * 7 })
  refresh(true)
  if (levelIndex === 0) say('Drag from an island toward a neighbour to build a bridge. The number is how many bridges it wants.')
  else if (level.fog && !saved.seenFog) {
    saved.seenFog = true
    save()
    say('Fog hides some islands’ numbers. Work them out from their neighbours: the fog lifts when everything joins up.')
  } else say(level.fog ? 'Fog hides some numbers. Every island still wants exactly its number of bridges.' : 'Every island wants its number of bridges, and all of them must join up.')
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
  $('prog').textContent = `${POOL_NAMES[LEVELS[levelIndex].pool]} · ${counted.filter(happy).length} of ${counted.length} ${fogNote ? '' : 'islands '}happy${fogNote}`
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

function win() {
  won = true
  refresh(true)
  if (!saved.done.includes(LEVELS[levelIndex].id)) saved.done.push(LEVELS[levelIndex].id)
  save()
  say('Every island is connected. Look at those cities!')
  setTimeout(() => {
    sounds.win()
    scene.celebrate()
    setTimeout(() => {
      const level = LEVELS[levelIndex]
      $('winmeta').textContent = `${board.burrows.length} islands and ${counts.reduce((a, b) => a + b, 0)} bridges in ${level.name}.${level.fog ? ' The fog has lifted!' : ''}`
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
$('prev').onclick = () => { sounds.unlock(); start(levelIndex - 1) }
$('next').onclick = () => { sounds.unlock(); start(levelIndex + 1) }
$('winnext').onclick = () => start(levelIndex + 1)
$('undo').onclick = () => {
  if (!history.length || won) return
  const [edge, before] = history.pop()
  counts[edge] = before
  sounds.undo()
  refresh()
}
/* ---------- choosing a level ---------- */
let pickerPool = 'easy'
function drawPicker() {
  $('tabs').innerHTML = Object.entries(POOL_NAMES).map(([pool, label]) => {
    const levels = LEVELS.filter((l) => l.pool === pool)
    const done = levels.filter((l) => saved.done.includes(l.id)).length
    return `<button role="tab" class="tab" data-pool="${pool}" aria-selected="${pool === pickerPool}">${label}<small>${done}/${levels.length}</small></button>`
  }).join('')
  $('grid').innerHTML = LEVELS.map((l, i) => [l, i]).filter(([l]) => l.pool === pickerPool).map(([l, i]) => {
    const done = saved.done.includes(l.id)
    return `<button class="tile${done ? ' done' : ''}${i === levelIndex ? ' here' : ''}" data-index="${i}" aria-label="${l.name}${l.fog ? ', with fog' : ''}${done ? ', solved' : ''}">
      <span>${l.number}</span>${l.fog ? `<i class="fog">${icon('cloud')}</i>` : ''}${done ? `<i class="tick">${icon('check')}</i>` : ''}</button>`
  }).join('')
}
function openPicker() {
  pickerPool = LEVELS[levelIndex].pool
  drawPicker()
  $('picker').hidden = false
}
$('num').onclick = () => { sounds.unlock(); openPicker() }
$('closepicker').onclick = () => { $('picker').hidden = true }
$('picker').onclick = (ev) => {
  if (ev.target === $('picker')) { $('picker').hidden = true; return }
  const tab = ev.target.closest('.tab')
  if (tab) { pickerPool = tab.dataset.pool; drawPicker(); return }
  const tile = ev.target.closest('.tile')
  if (tile) { $('picker').hidden = true; start(Number(tile.dataset.index)) }
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
  start(levelIndex)
}
const syncSound = () => { $('sound').innerHTML = icon(sounds.enabled ? 'sound' : 'mute') }
$('sound').onclick = () => { sounds.unlock(); sounds.enabled = !sounds.enabled; syncSound() }
syncSound()
addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z') $('undo').click() })

/* ---------- loop ---------- */
let last = performance.now()
// test captures run slowly in software rendering, so they keep their resolution
const capture = new URLSearchParams(location.search).has('capture')
function frame(now) {
  if (!capture) scene.tune(now - last)
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!document.hidden) {
    updateDrag(dt)
    scene.update(dt)
    scene.render()
    if (touch.busy || touch.drawn) { touch.update(dt); touch.drawn = touch.busy }
  }
  requestAnimationFrame(frame)
}
// Turning a phone rebuilds the sea to fit; bridges and cities carry over.
let resizeTimer = 0
let shape = innerHeight / innerWidth
addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const now = innerHeight / innerWidth
    if (Math.abs(now - shape) < 0.25) return
    shape = now
    scene.load(board, { seed: 5 + levelIndex * 7 })
    refresh(true)
  }, 300)
})
start(levelIndex)
requestAnimationFrame(frame)

// Hooks for the visual tests.
window.__isles = {
  scene, start, apply,
  get counts() { return counts },
  get board() { return board },
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) { updateDrag(1 / 30); scene.update(1 / 30); touch.update(1 / 30) } scene.render() },
  touch,
}
