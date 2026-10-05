import { POOLS } from './levels.js'
import { assignFlowers, bedComplete, buildBoard, conflicts, isSolved, MAX_SEED } from './logic.js'
import { GardenScene } from './scene.js'
import { Sounds } from './sounds.js'
import { PIPS, NUM } from './flowers.js'
import './style.css'

const STORAGE_KEY = 'flower-patch.v1'
const POOL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
// every level in play order, easy to hard, each knowing which pool it is in
const LEVELS = Object.entries(POOLS).flatMap(([pool, levels]) => levels.map((level, k) => ({ ...level, pool, number: k + 1 })))

const ICON = {
  prev: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  trowel: '<path d="M12.5 11.5 20 4"/><path d="M12.8 7.2 5 9.5c-1.6.5-2 2.5-.9 3.7l6.7 6.7c1.2 1.1 3.2.7 3.7-.9l2.3-7.8z"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`
// a die face of little sprouts, each dot in the seed's own colour
const face = (n) => `<svg class="face" viewBox="-1 -1 2 2" aria-hidden="true">${PIPS[n].map(([x, z]) => `<circle cx="${x * 2.2}" cy="${z * 2.2}" r="${n === 1 ? 0.36 : 0.24}" style="fill:#${NUM[n].toString(16).padStart(6, '0')}"/>`).join('')}</svg>`

document.querySelector('#app').innerHTML = `
  <div class="app">
    <header>
      <button class="badge" id="num" aria-label="Choose a garden">1</button>
      <div class="titles"><h1 id="name"></h1><p id="prog"></p></div>
      <button class="round" id="sound" aria-label="Sound">${icon('sound')}</button>
      <button class="round" id="prev" aria-label="Previous garden">${icon('prev')}</button>
      <button class="round" id="next" aria-label="Next garden">${icon('next')}</button>
    </header>
    <div class="stage" id="stage"></div>
    <footer>
      <p class="say" id="say" aria-live="polite"></p>
      <div class="tray" id="tray" role="group" aria-label="Seeds"></div>
      <div class="row">
        <button class="chip" id="undo">${icon('undo')}<span>Undo</span></button>
        <button class="chip" id="restart">${icon('restart')}<span>Restart</span></button>
      </div>
    </footer>
    <section class="picker" id="picker" hidden>
      <div class="sheet">
        <div class="sheethead"><h2>Choose a garden</h2><button class="round" id="closepicker" aria-label="Close">${icon('close')}</button></div>
        <div class="tabs" id="tabs" role="tablist"></div>
        <div class="grid" id="grid"></div>
      </div>
    </section>
    <section class="win" id="win" hidden>
      <h2>In full bloom!</h2>
      <p id="winmeta"></p>
      <button class="chip go" id="winnext">Next garden</button>
    </section>
  </div>`
const $ = (id) => document.getElementById(id)

function loadSaved() {
  const empty = { level: 0, done: [], plots: {} }
  try { return { ...empty, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } } catch { return empty }
}
const saved = loadSaved()
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* private windows */ } }

const sounds = new Sounds()
const scene = new GardenScene($('stage'))
let levelIndex = Math.min(saved.level ?? 0, LEVELS.length - 1)
let board, flowers, values, history, won, seed, complete, shown = 0

const say = (text) => { $('say').textContent = text }
const buzz = (pattern) => { try { navigator.vibrate?.(pattern) } catch { /* not allowed here */ } }
const biggest = () => Math.max(...board.size)

function start(index, { fresh = false } = {}) {
  levelIndex = (index + LEVELS.length) % LEVELS.length
  saved.level = levelIndex
  save()
  const level = LEVELS[levelIndex]
  board = buildBoard(level)
  flowers = assignFlowers(board, levelIndex * 13 + 5)
  values = Int8Array.from(board.givens)
  // pick up where the player left off
  const plot = saved.plots[level.id]
  if (plot?.length === board.cells && !fresh) {
    ;[...plot].forEach((ch, i) => { if (!board.givens[i] && ch !== '.') values[i] = Math.min(MAX_SEED, Number(ch)) })
  }
  history = []
  // a garden already solved opens in bloom, unless it is being played again
  won = !fresh && !plot && saved.done.includes(level.id)
  if (won) values = Int8Array.from(board.solution)
  complete = new Set()
  seed = Math.min(seed ?? 1, biggest())
  $('win').hidden = true
  $('num').textContent = level.number
  $('num').dataset.pool = level.pool
  $('name').textContent = level.name
  scene.load(board, flowers, [...board.givens.keys()].filter((i) => board.givens[i]), { seed: 3 + levelIndex * 7 })
  drawTray()
  refresh(true)
  if (won) {
    scene.celebrate()
    say('This garden is in full bloom. Pick another from the list, or play it again with Restart.')
  } else if (levelIndex === 0) say('Each bed of N plots takes one of each seed from 1 to N. Pick a seed packet, then tap a plot.')
  else if (levelIndex === 1) say('The same seed can never touch, not even corner to corner.')
  else say(`${board.beds.length} beds to fill. Seeds that touch can't match.`)
}

function drawTray() {
  const top = biggest()
  $('tray').innerHTML = Array.from({ length: top }, (_, k) => k + 1).map((n) =>
    `<button class="packet" data-seed="${n}" aria-label="Seed ${n}" aria-pressed="${n === seed}">${face(n)}<span>${n}</span></button>`).join('') +
    `<button class="packet trowel" data-seed="0" aria-label="Trowel: dig up a seed" aria-pressed="${seed === 0}">${icon('trowel')}</button>`
}

function choose(n) {
  seed = n
  for (const b of $('tray').children) b.setAttribute('aria-pressed', String(Number(b.dataset.seed) === n))
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
  // the count catches up as each budding bed sends its flower up to it
  if (quiet || complete.size < shown) shown = complete.size
  showProgress()
  $('undo').disabled = !history.length || won
  if (!won) {
    saved.plots[LEVELS[levelIndex].id] = [...values].map((v) => v || '.').join('')
    save()
  }
  return { bad, fresh }
}

function showProgress() {
  const pool = POOL_NAMES[LEVELS[levelIndex].pool]
  $('prog').textContent = won ? `${pool} · all ${board.beds.length} beds in bloom` : `${pool} · ${shown} of ${board.beds.length} beds in flower`
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

function plant(i) {
  if (won) return
  if (board.givens[i]) {
    scene.wobble(i)
    sounds.bonk()
    say('That one was planted for you. It stays put.')
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
    say(`This bed has ${board.size[i]} plot${board.size[i] === 1 ? '' : 's'}, so it only takes seeds up to ${board.size[i]}.`)
    return
  }
  history.push([i, before])
  values[i] = next
  if (next) { sounds.plant(next); buzz(10) } else { sounds.dig(); buzz(8); scene.puff(i) }
  const { bad, fresh } = refresh(false, i)
  if (next && bad.has(i)) {
    sounds.droop()
    const bedTwin = board.beds[board.bedOf[i]].some((j) => j !== i && values[j] === next)
    say(bedTwin ? `This bed already has a ${next}. Each seed grows once per bed.` : `Two ${next}s are touching, so they wilt. The same seed can't touch, not even at a corner.`)
  } else if (fresh.length) say(fresh.length > 1 ? `${fresh.length} beds are budding!` : `The ${flowerName(flowers[fresh[0]])} bed is budding!`)
  else if (bad.size) say('Some seedlings are still wilting. Find the twins that touch.')
  else say(next ? `${left()} plots left to plant.` : 'Dug up. Pick a seed and plant it somewhere better.')
  if (isSolved(board, values)) win()
}

const NAMES = { tulip: 'tulip', marigold: 'marigold', buttercup: 'buttercup', daisy: 'daisy', forgetmenot: 'forget-me-not', cornflower: 'cornflower', lavender: 'lavender', pansy: 'pansy', rose: 'rose', sunflower: 'sunflower' }
const flowerName = (f) => NAMES[f]
const left = () => values.filter((v) => !v).length

function win() {
  won = true
  bloomCount = 0
  if (!saved.done.includes(LEVELS[levelIndex].id)) saved.done.push(LEVELS[levelIndex].id)
  delete saved.plots[LEVELS[levelIndex].id]
  save()
  refresh()
  say('Every bed is full. Watch the garden bloom!')
  scene.celebrate()
  sounds.win()
  setTimeout(() => {
    const kinds = new Set(flowers).size
    $('winmeta').textContent = `${board.beds.length} beds of ${kinds} kinds of flower in ${LEVELS[levelIndex].name}.`
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
  if (i !== null && i !== undefined) plant(i)
  else if (scene.poke(ev.clientX, ev.clientY)) sounds.boing()
})
canvas.addEventListener('pointercancel', () => { down = null })

$('tray').onclick = (ev) => {
  const b = ev.target.closest('.packet')
  if (!b) return
  sounds.unlock()
  const n = Number(b.dataset.seed)
  choose(n)
  if (n) sounds.pick(n)
  else sounds.dig()
}

/* ---------- buttons ---------- */
$('prev').onclick = () => { sounds.unlock(); start(levelIndex - 1) }
$('next').onclick = () => { sounds.unlock(); start(levelIndex + 1) }
$('winnext').onclick = () => start(levelIndex + 1)
$('undo').onclick = () => {
  if (!history.length || won) return
  const [i, before] = history.pop()
  values[i] = before
  sounds.undo()
  scene.puff(i)
  refresh(false, i)
  say('Undone.')
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
  delete saved.plots[LEVELS[levelIndex].id]
  save()
  start(levelIndex, { fresh: true })
  say('A fresh start. The seeds planted for you are still there.')
}
const syncSound = () => { $('sound').innerHTML = icon(sounds.enabled ? 'sound' : 'mute') }
$('sound').onclick = () => { sounds.unlock(); sounds.enabled = !sounds.enabled; syncSound() }
syncSound()
addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z') return void $('undo').click()
  const n = Number(ev.key)
  if (ev.key >= '1' && ev.key <= '6' && n <= biggest()) choose(n)
  else if (ev.key === '0' || ev.key === 'Backspace') choose(0)
})

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
    const started = !done && saved.plots[l.id]
    return `<button class="tile${done ? ' done' : ''}${i === levelIndex ? ' here' : ''}" data-index="${i}" aria-label="${l.name}, ${l.width} by ${l.height}${done ? ', in bloom' : started ? ', started' : ''}">
      <span>${l.number}</span><small>${l.height}×${l.width}</small>${done ? `<i class="tick">${icon('check')}</i>` : ''}</button>`
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

/* ---------- loop ---------- */
let last = performance.now()
// test captures run slowly in software rendering, so they keep their resolution
const capture = new URLSearchParams(location.search).has('capture')
function frame(now) {
  if (!capture) scene.tune(now - last)
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!document.hidden) {
    scene.update(dt)
    scene.render()
  }
  requestAnimationFrame(frame)
}
seed = 1
start(levelIndex)
requestAnimationFrame(frame)

// Hooks for screenshots and checks.
window.__garden = {
  scene, start, plant, choose,
  get board() { return board },
  get values() { return values },
  // plant the whole solution, or all but the last `leave` cells
  solve(leave = 0) {
    const open = [...board.solution.keys()].filter((i) => !board.givens[i] && values[i] !== board.solution[i])
    open.slice(0, open.length - leave).forEach((i) => { choose(board.solution[i]); plant(i) })
  },
  advance(seconds) { for (let t = 0; t < seconds; t += 1 / 30) scene.update(1 / 30); scene.render() },
}
