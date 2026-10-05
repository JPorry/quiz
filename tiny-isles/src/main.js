import { LEVELS } from './levels.js'
import { buildBoard, blockedBy, degrees, status as boardStatus } from './logic.js'
import { IslandScene } from './scene.js'
import { Sounds } from './sounds.js'
import './style.css'

const STORAGE_KEY = 'tiny-isles.v1'
const NAMES = [
  'Pebble Bay', 'Coral Cove', 'Seashell Keys', 'Lagoon Loop', 'Driftwood Isles',
  'Starfish Shoals', 'Puffin Point', 'Turtle Reef', 'Sandcastle Sound', 'Kelp Harbour',
  'Lighthouse Rocks', 'Mango Atoll', 'Pelican Pier', 'Seaglass Strait', 'Breezy Banks',
  'Sunset Archipelago', 'Dolphin Dunes', 'Tidepool Twins', 'Saltwater Skyline', 'Harbour Lights',
  'Coconut Crossing', 'Moonbeam Marina', 'Marina Bay', 'Palm Crescent', 'Azure Heights',
  'Pearl Towers', 'Glimmer Coast', 'Neon Waterfront', 'Skyport Isles', 'Sapphire Metropolis',
]

const ICON = {
  prev: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`

document.querySelector('#app').innerHTML = `
  <div class="app">
    <header>
      <div class="badge" id="num">1</div>
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
  $('num').textContent = levelIndex + 1
  $('name').textContent = NAMES[levelIndex]
  scene.load(board, { seed: 5 + levelIndex * 7 })
  refresh(true)
  say(levelIndex === 0
    ? 'Drag from an island toward a neighbour to build a bridge. The number is how many bridges it wants.'
    : 'Every island wants its number of bridges, and all of them must join up.')
}

const say = (text) => { $('say').textContent = text }

function refresh(quiet = false) {
  const d = degrees(board, counts)
  const st = boardStatus(board, counts)
  const next = board.burrows.map((b) => Math.min(8, d[b.index]))
  if (!quiet) next.forEach((t, i) => { if (t > tiers[i]) sounds.grow(t) })
  tiers = next
  scene.setIslands(board.burrows.map((b) => ({ tier: next[b.index], have: d[b.index], done: d[b.index] === b.value, over: d[b.index] > b.value })))
  scene.setBridges(counts)
  const doneCount = board.burrows.filter((b) => d[b.index] === b.value).length
  $('prog').textContent = `${doneCount} of ${board.burrows.length} islands happy`
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
  if ([e.a, e.b].some((i) => d[i] > board.burrows[i].value)) say('That island has more bridges than its number. Tap a bridge to take it down.')
  else if (st.closed.length) say('Some islands are closed off from the rest. Every island must join up.')
  else if (next === 2 && before === 1) say('A two-lane bridge: twice the traffic!')
  else say(`${board.burrows.length - board.burrows.filter((b) => d[b.index] === b.value).length} islands still want bridges.`)
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
      $('winmeta').textContent = `${board.burrows.length} islands and ${counts.reduce((a, b) => a + b, 0)} bridges in ${NAMES[levelIndex]}.`
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
  drag = { id: ev.pointerId, island, start: p, sx: ev.clientX, sy: ev.clientY, moved: false, edge: null, progress: 0, shown: 0, snapped: false }
  if (island !== null) { scene.bounce(island); sounds.press() }
})

canvas.addEventListener('pointermove', (ev) => {
  if (!drag || drag.id !== ev.pointerId) return
  const p = scene.toWorld(ev.clientX, ev.clientY)
  if (!p) return
  if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 9) drag.moved = true
  if (drag.island === null || !drag.moved) return
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
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) { updateDrag(1 / 30); scene.update(1 / 30) } scene.render() },
}
