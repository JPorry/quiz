import * as THREE from 'three'
import { LEVELS } from './levels.js'
import { buildBoard, blockedBy, degrees, reachable, routeFrom, status as boardStatus } from './logic.js'
import { WarrenScene, R } from './scene.js'
import { Sounds } from './sounds.js'
import './style.css'

const STORAGE_KEY = 'bunny-burrows.warren.v1'
const LANE_SPEC = { 0: [0, 0.2], 1: [0.15, 0.13] } // the lane a dig adds, by current count

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
      <div class="titles"><h1 id="name">Clover Hollow</h1><p id="prog"></p></div>
      <button class="round" id="sound" aria-label="Sound">${icon('sound')}</button>
      <button class="round" id="prev" aria-label="Previous burrow">${icon('prev')}</button>
      <button class="round" id="next" aria-label="Next burrow">${icon('next')}</button>
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
      <h2>Everyone's fed!</h2>
      <p id="winmeta"></p>
      <button class="chip go" id="winnext">Next burrow</button>
    </section>
  </div>`
const $ = (id) => document.getElementById(id)

/* ---------- saved progress ---------- */
function loadSaved() {
  try { return { level: 0, done: [], ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } } catch { return { level: 0, done: [] } }
}
const saved = loadSaved()
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* private windows */ } }

// Levels drop empty rows above the first burrow, so a burrow always sits right under
// the meadow, and the busiest of those is where the carrot patch grows.
function prepare(level) {
  const top = Math.min(...level.burrows.map((b) => b[0]))
  const burrows = level.burrows.map(([r, c, v]) => [r - top, c, v])
  const candidates = burrows.map((b, i) => [b, i]).filter(([b]) => b[0] === 0)
  candidates.sort(([a], [b]) => b[2] - a[2] || Math.abs(a[1] - (level.width - 1) / 2) - Math.abs(b[1] - (level.width - 1) / 2))
  return { ...level, height: level.height - top, burrows, source: candidates[0][1] }
}

/* ---------- game ---------- */
const sounds = new Sounds()
const scene = new WarrenScene($('stage'))
let levelIndex = Math.min(saved.level ?? 0, LEVELS.length - 1)
let board, counts, history, fed, pending, won, digs

function start(index) {
  levelIndex = (index + LEVELS.length) % LEVELS.length
  saved.level = levelIndex
  save()
  const level = prepare(LEVELS[levelIndex])
  board = buildBoard(level)
  counts = board.edges.map(() => 0)
  history = []
  fed = new Set([board.source])
  pending = new Set()
  won = false
  digs = 0
  $('win').hidden = true
  $('num').textContent = levelIndex + 1
  $('name').textContent = level.name
  scene.load(board, { seed: 11 + levelIndex * 7 })
  refresh()
  say(levelIndex === 0
    ? 'Drag from a room toward a neighbour to dig a tunnel. Every bunny needs its own tunnel.'
    : 'Carrots come down from the patch. Dig a tunnel for every bunny.')
}

function say(text) {
  $('say').textContent = text
}

function bunniesFed() {
  const d = degrees(board, counts)
  return board.burrows.reduce((n, b) => n + (fed.has(b.index) ? Math.min(d[b.index], b.value) : 0), 0)
}

function refresh() {
  const d = degrees(board, counts)
  scene.setRooms(board.burrows.map((b) => ({
    states: Array.from({ length: b.value }, (_, k) => (k < d[b.index] ? (fed.has(b.index) ? 'fed' : 'wait') : 'sleep')),
    lit: fed.has(b.index),
    worried: d[b.index] > b.value,
    spill: Math.max(0, d[b.index] - b.value),
  })))
  const lit = new Set(board.edges.filter((e) => counts[e.index] && fed.has(e.a) && fed.has(e.b)).map((e) => e.index))
  scene.setTunnels(counts, lit)
  const total = board.burrows.reduce((n, b) => n + b.value, 0)
  $('prog').textContent = `${bunniesFed()} of ${total} bunnies have a carrot`
  $('undo').disabled = !history.length || won
}

// Send carrots down the tunnels to every room that has just joined the patch.
function deliver() {
  const reach = reachable(board, counts, board.source)
  for (const i of [...fed]) if (!reach.has(i)) fed.delete(i)
  for (const i of [...pending]) if (!reach.has(i)) pending.delete(i)
  for (const b of board.burrows) {
    const i = b.index
    if (!reach.has(i) || fed.has(i) || pending.has(i)) continue
    pending.add(i)
    const route = routeFrom(board, counts, board.source, i).map((j) => scene.pos(j))
    route.unshift(new THREE.Vector3(scene.pos(board.source).x, 0.2, 0))
    scene.sendCarrot(route, () => {
      pending.delete(i)
      if (!reachable(board, counts, board.source).has(i)) return
      fed.add(i)
      scene.hop(i)
      sounds.munch(i)
      refresh()
      checkWin()
    })
  }
  refresh()
  checkWin()
}

function apply(edge, next) {
  const before = counts[edge]
  if (before === next || won) return false
  if (!before && next) {
    const blocker = blockedBy(board, counts, edge)
    if (blocker !== undefined) {
      sounds.bonk()
      buzz([10, 40, 10])
      scene.shake(blocker)
      say("Tunnels can't cross. Fill in the other one first.")
      return false
    }
  }
  history.push([edge, before])
  counts[edge] = next
  const e = board.edges[edge]
  for (const i of [e.a, e.b]) scene.bounce(i, next > before ? 1 : 0.6)
  if (next > before) {
    sounds.dig(++digs)
    buzz(12)
    scene.dust(edge, 16)
  } else {
    sounds.fill()
    buzz(8)
    scene.dust(edge, 8)
  }
  const d = degrees(board, counts)
  const over = [e.a, e.b].some((i) => d[i] > board.burrows[i].value)
  if (over) say('That room has more tunnels than bunnies. Tap a tunnel to fill it in.')
  else if (next === 2 && before === 1) say('A double tunnel, for two bunnies!')
  else nudge()
  deliver()
  return true
}

function nudge() {
  const reach = reachable(board, counts, board.source)
  const waiting = board.burrows.length - reach.size
  if (waiting) say(waiting === 1 ? 'One family is still cut off from the carrots.' : `${waiting} families are still cut off from the carrots.`)
  else say('Every room can reach the patch. Now give every bunny a tunnel.')
}

function checkWin() {
  if (won || pending.size || !boardStatus(board, counts).complete) return
  won = true
  refresh()
  setTimeout(() => {
    sounds.win()
    board.burrows.forEach((b, k) => setTimeout(() => { scene.hop(b.index); scene.hearts(b.index) }, k * 120))
    if (!saved.done.includes(LEVELS[levelIndex].id)) saved.done.push(LEVELS[levelIndex].id)
    save()
    setTimeout(() => {
      const total = board.burrows.reduce((n, b) => n + b.value, 0)
      $('winmeta').textContent = `${total} bunnies munching carrots in ${LEVELS[levelIndex].name}.`
      $('win').hidden = false
    }, 1500)
  }, 500)
}

const buzz = (pattern) => { try { navigator.vibrate?.(pattern) } catch { /* not allowed here */ } }

/* ---------- digging: the main interaction ---------- */
let drag = null
let selected = null
const canvas = scene.renderer.domElement
canvas.style.touchAction = 'none'

canvas.addEventListener('pointerdown', (ev) => {
  sounds.unlock()
  if (won) return
  const p = scene.toBoard(ev.clientX, ev.clientY)
  if (!p) return
  canvas.setPointerCapture(ev.pointerId)
  const room = scene.roomAt(p)
  drag = { id: ev.pointerId, room, start: p, p, sx: ev.clientX, sy: ev.clientY, moved: false, edge: null, progress: 0, shown: 0, snapped: false, crumb: 0 }
  if (room !== null) { scene.bounce(room, 0.5); sounds.press() }
})

canvas.addEventListener('pointermove', (ev) => {
  if (!drag || drag.id !== ev.pointerId) return
  const p = scene.toBoard(ev.clientX, ev.clientY)
  if (!p) return
  drag.p = p
  if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 9) drag.moved = true
  if (drag.room === null || !drag.moved) return
  const o = scene.pos(drag.room)
  const dx = p.x - o.x, dy = p.y - o.y
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'up' : 'down'
  const edge = board.neighbors[drag.room][dir] ?? null
  if (edge !== drag.edge) { drag.edge = edge; drag.shown = 0; drag.snapped = false }
  if (edge === null) { drag.progress = 0; return }
  const e = board.edges[edge]
  const t = scene.pos(e.a === drag.room ? e.b : e.a)
  const total = o.distanceTo(t) - 2 * (R - 0.12)
  drag.progress = clamp(((dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy)) - (R - 0.12)) / total, 0, 1)
})

function endDrag(ev) {
  if (!drag || drag.id !== ev.pointerId) return
  const d = drag
  drag = null
  scene.setPreview(null)
  if (d.room !== null && d.moved) {
    if (d.snapped && d.edge !== null) apply(d.edge, (counts[d.edge] + 1) % 3)
    else if (d.edge !== null && d.shown > 0.05) sounds.pop(400, 220, { len: 0.1, vol: 0.15 })
    return
  }
  if (d.moved) return
  const room = scene.roomAt(d.start)
  if (room !== null) {
    // tap a room, then a neighbour, to dig between them
    if (selected !== null && selected !== room) {
      const dir = Object.keys(board.neighbors[selected]).find((k) => {
        const e = board.edges[board.neighbors[selected][k]]
        return e.a === room || e.b === room
      })
      const from = selected
      selected = null
      if (dir) return void apply(board.neighbors[from][dir], (counts[board.neighbors[from][dir]] + 1) % 3)
    }
    selected = selected === room ? null : room
    if (selected !== null) { scene.bounce(room, 0.8); sounds.press() }
    return
  }
  const t = scene.tunnelAt(d.start)
  selected = null
  if (t !== null) apply(t, (counts[t] + 1) % 3)
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', (ev) => { if (drag?.id === ev.pointerId) { drag = null; scene.setPreview(null) } })
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// The tunnel follows the finger with a little spring, crumbs fly from the paw,
// and past halfway it snaps through to the neighbour with a pop.
function updateDrag(dt) {
  if (!drag || drag.room === null || drag.edge === null) {
    if (!drag) scene.setPreview(null)
    return
  }
  const n = counts[drag.edge]
  if (n === 2) {
    // a third dig fills the double tunnel back in: no preview, just the snap
    const want = drag.progress > 0.55
    if (want && !drag.snapped) { drag.snapped = true; sounds.snap(); buzz(8) }
    if (!want) drag.snapped = false
    scene.setPreview(null)
    return
  }
  const blocked = !n && blockedBy(board, counts, drag.edge) !== undefined
  const snap = drag.progress > 0.55 && !blocked
  const target = snap ? 1 : Math.min(drag.progress, blocked ? 0.35 : 1)
  const before = drag.shown
  drag.shown += (target - drag.shown) * (1 - Math.exp(-dt * (snap ? 22 : 16)))
  if (snap && !drag.snapped) {
    drag.snapped = true
    sounds.snap()
    buzz(8)
    const e = board.edges[drag.edge]
    scene.bounce(e.a === drag.room ? e.b : e.a, 0.9)
  } else if (!snap) drag.snapped = false
  const tip = scene.setPreview({ edge: drag.edge, from: drag.room, lane: LANE_SPEC[n], progress: drag.shown, blocked })
  if (tip && Math.abs(drag.shown - before) > 0.004) {
    drag.crumb += dt
    if (drag.crumb > 0.045) { drag.crumb = 0; scene.crumbs(tip.x, tip.y, 2); sounds.crunch(0.05) }
  }
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
  deliver()
  nudge()
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
function syncSound() {
  $('sound').innerHTML = icon(sounds.enabled ? 'sound' : 'mute')
}
$('sound').onclick = () => { sounds.unlock(); sounds.enabled = !sounds.enabled; syncSound() }
syncSound()
addEventListener('keydown', (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z') $('undo').click() })

/* ---------- loop ---------- */
let last = performance.now()
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!document.hidden) {
    updateDrag(dt)
    scene.update(dt)
    scene.render()
  }
  requestAnimationFrame(frame)
}
// A big change of shape (a phone turning) rebuilds the warren to fit; the dug
// tunnels and fed rooms carry over.
let resizeTimer = 0
let shape = innerHeight / innerWidth
addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const now = innerHeight / innerWidth
    if (Math.abs(now - shape) < 0.25) return
    shape = now
    scene.load(board, { seed: 11 + levelIndex * 7 })
    refresh()
  }, 300)
})
start(levelIndex)
requestAnimationFrame(frame)

// Hooks for the visual tests.
window.__burrows = {
  scene, start, apply,
  get counts() { return counts },
  get board() { return board },
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) { updateDrag(1 / 30); scene.update(1 / 30) } scene.render() },
}
