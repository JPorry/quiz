import { createIcons, ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Fingerprint, Grid3x3, Lightbulb, MoonStar, RotateCcw, Scale, Sprout, Undo2, Volume2, VolumeX, X } from 'lucide'
import { GardenGame, GARDEN_NAMES, findViolations, findHint } from './game.js'
import { GardenScene } from './scene.js'
import './style.css'

const game = new GardenGame()
let scene
let soundEnabled = false
let soundContext
let hintCell = null
const app = document.querySelector('#app')
const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`
// The picker is three little diorama pieces: a pool, a grassy islet, and an empty socket.
const PIECE_ART = {
  water: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#35b3c4"/><rect x="4" y="4" width="56" height="56" rx="11" fill="none" stroke="#7fdcd6" stroke-width="3"/><g class="art-waves" stroke="#b5f0ee" stroke-width="3" fill="none" stroke-linecap="round"><path d="M-24 24 q6 -5 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0"/><path d="M-36 42 q6 -5 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0"/></g><path class="art-glint" d="M47 13 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4z" fill="#fff"/></svg>`,
  land: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#f4dfae"/><rect x="7" y="7" width="50" height="50" rx="11" fill="#92d46f"/><circle cx="17" cy="47" r="2.8" fill="#ffe07a"/><circle cx="47" cy="48" r="2.8" fill="#ff9fb2"/><circle cx="49" cy="17" r="2.6" fill="#fff"/><circle cx="14" cy="18" r="2.4" fill="#ff9fb2"/><ellipse cx="37" cy="40" rx="13" ry="7.5" fill="#2f6f3a" opacity=".28"/><g class="art-tree"><circle cx="31" cy="31" r="13" fill="#54b25c"/><circle cx="26" cy="26" r="5" fill="#9fe282"/></g></svg>`,
  erase: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#f6eedb"/><rect x="11" y="11" width="42" height="42" rx="9" fill="#dccdaa"/><rect x="13" y="14" width="38" height="37" rx="8" fill="#efe5cd"/><g class="art-cloud"><rect x="19" y="20" width="26" height="25" rx="6" fill="none" stroke="#b3a283" stroke-width="2.4" stroke-dasharray="5 4.5" stroke-linecap="round"/><path d="M28.5 32.5h7M32 29v7" stroke="#b3a283" stroke-width="2" stroke-linecap="round"/></g></svg>`,
}
const PARTICLES = Array.from({ length: 10 }, (_, i) => `<i style="--a: ${i * 36 + (i % 2) * 14}deg; --i: ${i}"></i>`).join('')
const piece = (kind, value, label, name) => `<button class="piece ${kind}" data-value="${value}" aria-label="${label}" aria-pressed="false"><span class="piece-stage"><span class="piece-shadow"></span><span class="piece-ring"></span><span class="piece-tile">${PIECE_ART[kind]}</span><span class="piece-burst" aria-hidden="true">${PARTICLES}</span></span><span class="piece-name">${name}</span></button>`
app.innerHTML = `
  <main class="garden-app">
    <div class="dusk" aria-hidden="true"></div>
    <div class="world" id="world">
      <div class="board-access" role="group" aria-label="Garden puzzle grid"></div>
    </div>
    <header class="masthead">
      <a class="brand" href="./" aria-label="Tidal Garden home"><span class="brand-icon">${icon('sprout')}</span><span>Tidal Garden</span></a>
      <div class="header-tools">
        <button class="icon-button" id="sound" aria-label="Enable placement sounds" aria-pressed="false" title="Placement sounds">${icon('volume-x')}</button>
        <button class="icon-button" id="help" aria-label="Garden rules" title="Garden rules">${icon('circle-help')}</button>
      </div>
    </header>
    <aside class="garden-journal">
      <p class="eyebrow"><span></span> A world in balance</p>
      <h1>Tidal<br><em>Garden.</em></h1>
      <p class="intro">A quiet place.<br>A little land. A little water.</p>
      <div class="journal-divider"></div>
      <button class="chapter" id="levels">
        <span class="chapter-number" id="chapter-number">01</span>
        <span class="chapter-text"><small>Your garden</small><strong id="garden-name">First light</strong></span>
        ${icon('chevron-down')}
      </button>
      <div class="progress-block">
        <div class="progress-heading"><span>Growing in harmony</span><span><strong id="progress-value">34</strong><small> / 100</small></span></div>
        <div class="progress-track"><span id="progress-bar"></span></div>
        <div class="terrain-counts"><span><b class="water-dot"></b>Water <strong id="water-count">0</strong></span><span><b class="land-dot"></b>Land <strong id="land-count">0</strong></span></div>
      </div>
      <div class="time-detail">${icon('clock-3')}<span id="time">00:00</span><span class="time-divider"></span><span id="remaining">66 to grow</span></div>
    </aside>
    <div class="scene-caption"><span class="caption-mark"></span><span>THE SHALLOWS</span><span class="caption-line"></span><span>GARDEN <b id="caption-level">01</b></span></div>
    <footer class="game-dock">
      <div class="placement-status" id="placement-status" aria-live="polite"><span></span><p></p></div>
      <div class="palette" role="group" aria-label="Place terrain">
        ${piece('water', 0, 'Place water', 'Water')}
        ${piece('land', 1, 'Place land', 'Land')}
        ${piece('erase', 'erase', 'Erase terrain', 'Clear')}
      </div>
      <div class="action-row">
        <button class="text-tool" id="undo" disabled>${icon('undo-2')}<span>Undo</span></button>
        <span class="action-divider"></span>
        <button class="text-tool" id="hint">${icon('lightbulb')}<span>A little nudge</span></button>
        <span class="action-divider"></span>
        <button class="text-tool" id="reset">${icon('rotate-ccw')}<span>Start again</span></button>
      </div>
    </footer>
    <section class="finale-card" id="finale-card" aria-labelledby="finale-title" inert>
      <p class="eyebrow"><span></span>Garden <b id="finale-number">01</b>&nbsp;·&nbsp;<em id="finale-name">First light</em></p>
      <h2 id="finale-title">A world in balance.</h2>
      <p class="finale-meta"><span>${icon('clock-3')}Grown in <b id="finale-time">00:00</b></span><span class="time-divider"></span><span><b id="finale-count">1</b> of 20 gardens</span></p>
      <div class="finale-actions">
        <button class="secondary-button" id="finale-stay">Stay a little longer</button>
        <button class="primary-button" id="finale-next"><span id="finale-next-label">Grow the next garden</span> ${icon('arrow-right')}</button>
      </div>
      <p class="finale-tip">Drag to turn the island</p>
    </section>
    <div class="quiet-footer"><span>LAND & WATER, IN EQUAL MEASURE</span><span>NO. <b id="edition-number">001</b></span></div>
  </main>
  <dialog id="modal"><button class="icon-button modal-close" aria-label="Close">${icon('x')}</button><div id="modal-content"></div></dialog>
`

const $ = (selector) => document.querySelector(selector)
const refreshIcons = () => createIcons({ icons: { ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Fingerprint, Grid3x3, Lightbulb, MoonStar, RotateCcw, Scale, Sprout, Undo2, Volume2, VolumeX, X }, attrs: { 'stroke-width': 1.6 } })
refreshIcons()

const access = $('.board-access')
for (let row = 0; row < 10; row++) {
  for (let col = 0; col < 10; col++) {
    const button = document.createElement('button')
    button.className = 'cell-access'
    button.dataset.row = row
    button.dataset.col = col
    button.addEventListener('click', () => placeCell(row, col))
    button.addEventListener('focus', () => { scene?.showHover(null); scene?.selectCell({ row, col }) })
    button.addEventListener('blur', () => scene?.showHover(null))
    button.addEventListener('keydown', (event) => {
      const delta = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key]
      if (delta) {
        event.preventDefault()
        let r = row + delta[0], c = col + delta[1]
        while (r >= 0 && r < 10 && c >= 0 && c < 10) {
          const next = access.children[r * 10 + c]
          if (!next.disabled) { next.focus(); break }
          r += delta[0]; c += delta[1]
        }
      }
    })
    access.append(button)
  }
}

// The open space between the journal, the caption, and the dock, where the diorama sits.
function boardSafeArea() {
  const world = $('#world').getBoundingClientRect()
  const phone = world.width <= 700
  const top = $(phone ? '.garden-journal' : '.scene-caption').getBoundingClientRect().bottom - world.top + (phone ? 8 : 14)
  const bottom = $('#placement-status').getBoundingClientRect().top - world.top - (phone ? 2 : 14)
  // Phones keep a little breathing room on either side of the tray.
  const left = phone ? 12 : $('.garden-journal').getBoundingClientRect().right - world.left + 36
  return { top, bottom, left, right: world.width - (phone ? 12 : 36) }
}

// While the finished garden is on show, the interface steps aside: the island takes everything
// between the masthead and the card at the bottom.
// Wide screens keep the card in the journal's place on the left; narrower ones put it underneath.
function finaleSafeArea() {
  const world = $('#world').getBoundingClientRect()
  const phone = world.width <= 700
  const card = $('#finale-card')
  const top = $('.masthead').getBoundingClientRect().bottom - world.top + (phone ? 0 : 6)
  // Layout positions ignore the card's slide-in offset, so the framing holds still as it appears.
  if (world.width >= 1100) return { top, bottom: world.height - 30, left: card.offsetLeft + card.offsetWidth + 30, right: world.width - 40 }
  return { top, bottom: card.offsetTop - (phone ? 6 : 16), left: phone ? 10 : 40, right: world.width - (phone ? 10 : 40) }
}

try {
  scene = new GardenScene($('#world'), { onCell: placeCell, safeArea: boardSafeArea, finaleArea: finaleSafeArea })
} catch (error) {
  $('#world').innerHTML = `<div class="render-error"><p>Your garden needs WebGL to bloom.</p><small>Please open it in a browser with hardware acceleration enabled.</small></div>`
  console.error(error)
}

function playTone(value) {
  if (!soundEnabled) return
  soundContext ??= new AudioContext()
  soundContext.resume()
  const now = soundContext.currentTime
  const oscillator = soundContext.createOscillator()
  const gain = soundContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(value === 0 ? 520 : 660, now)
  oscillator.frequency.exponentialRampToValueAtTime(value === 0 ? 220 : 440, now + 0.45)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.045, now + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
  oscillator.connect(gain).connect(soundContext.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.65)
}

// A rising arpeggio for a finished garden.
function playChime() {
  if (!soundEnabled) return
  soundContext ??= new AudioContext()
  soundContext.resume()
  const now = soundContext.currentTime
  ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, index) => {
    const oscillator = soundContext.createOscillator()
    const gain = soundContext.createGain()
    const start = now + 0.25 + index * 0.16
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.04, start + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.6)
    oscillator.connect(gain).connect(soundContext.destination)
    oscillator.start(start)
    oscillator.stop(start + 1.7)
  })
}

function placeCell(row, col) {
  scene?.selectCell({ row, col })
  if (!game.place(row, col)) return
  hintCell = null
  playTone(game.selected)
  render()
  if (game.complete) { playChime(); startFinale('celebrate', { row, col }) }
}

// Picking a piece makes it hop up with a burst of splashes, leaves, or mist.
let shownSelection
let shownComplete = false
function burst(button) {
  if (!button) return
  button.classList.remove('burst')
  void button.offsetWidth
  button.classList.add('burst')
  clearTimeout(button.burstTimer)
  button.burstTimer = setTimeout(() => button.classList.remove('burst'), 950)
}
const pieceFor = (value) => document.querySelector(`.piece[data-value="${value === null ? 'erase' : value}"]`)

function render() {
  const invalid = findViolations(game.grid)
  scene?.update(game.grid, game.puzzle.puzzle, invalid, game.complete)
  $('#chapter-number').textContent = String(game.level + 1).padStart(2, '0')
  $('#garden-name').textContent = GARDEN_NAMES[game.level]
  $('#caption-level').textContent = String(game.level + 1).padStart(2, '0')
  $('#edition-number').textContent = String(game.level + 1).padStart(3, '0')
  $('#progress-value').textContent = game.filled
  $('#progress-bar').style.width = `${game.filled}%`
  $('#water-count').textContent = game.grid.flat().filter((v) => v === 0).length
  $('#land-count').textContent = game.grid.flat().filter((v) => v === 1).length
  $('#remaining').textContent = game.complete ? 'In perfect balance' : `${game.remaining} to grow`
  $('#time').textContent = `${String(Math.floor(game.seconds / 60)).padStart(2, '0')}:${String(game.seconds % 60).padStart(2, '0')}`
  $('#undo').disabled = !game.history.length
  // A finished garden swaps the hint for a way back to its evening view.
  if (game.complete !== shownComplete) {
    shownComplete = game.complete
    $('#hint').innerHTML = game.complete ? `${icon('moon-star')}<span>See it at dusk</span>` : `${icon('lightbulb')}<span>A little nudge</span>`
    refreshIcons()
  }
  if (finale && !game.complete) endFinale()
  // The raised piece already shows the selection, so the status line only speaks up when it matters.
  const status = game.complete ? 'A world in balance' : invalid.size ? 'A little out of balance' : hintCell ? hintText(hintCell) : ''
  $('#placement-status p').textContent = status
  $('#placement-status').classList.toggle('invalid', invalid.size > 0)
  document.querySelectorAll('[data-value]').forEach((button) => {
    const value = button.dataset.value === 'erase' ? null : Number(button.dataset.value)
    button.classList.toggle('selected', value === game.selected)
    button.setAttribute('aria-pressed', String(value === game.selected))
  })
  if (shownSelection !== undefined && shownSelection !== game.selected) burst(pieceFor(game.selected))
  shownSelection = game.selected
}

document.querySelectorAll('[data-value]').forEach((button) => button.addEventListener('click', () => {
  const value = button.dataset.value === 'erase' ? null : Number(button.dataset.value)
  if (value === game.selected) burst(button)
  game.selected = value
  hintCell = null
  scene?.showHover(null)
  render()
}))

$('#undo').addEventListener('click', () => { if (game.undo()) { hintCell = null; render() } })
$('#sound').addEventListener('click', () => {
  soundEnabled = !soundEnabled
  $('#sound').setAttribute('aria-pressed', String(soundEnabled))
  $('#sound').setAttribute('aria-label', soundEnabled ? 'Disable placement sounds' : 'Enable placement sounds')
  $('#sound').innerHTML = icon(soundEnabled ? 'volume-2' : 'volume-x')
  refreshIcons()
  if (soundEnabled) playTone(0)
})
// Says which tile to fill and the reasoning behind it, so the hint teaches the technique.
function hintText({ row, col, value, technique, axis }) {
  const kind = value === 0 ? 'water' : 'land', other = value === 0 ? 'land' : 'water'
  const why = {
    pair: `it's beside two ${other} tiles in a row`,
    gap: `it sits between two ${other} tiles`,
    count: `its ${axis} already has five ${other}`,
    line: `it's the only way to finish its ${axis}`,
  }[technique]
  return `Row ${row + 1}, column ${col + 1} is ${kind}: ${why}`
}

$('#hint').addEventListener('click', () => {
  if (game.complete) { startFinale('revisit'); return }
  if (findViolations(game.grid).size) {
    $('#placement-status p').textContent = 'Check the coral-marked tiles first'
    return
  }
  hintCell = findHint(game.grid, game.puzzle.solution)
  if (!hintCell) {
    $('#placement-status p').textContent = 'One of your tiles is out of place'
    return
  }
  game.selected = hintCell.value
  render()
  scene?.showHover(null)
  scene?.selectCell(hintCell, { force: true })
  $('#placement-status p').textContent = hintText(hintCell)
})

const modal = $('#modal')
const modalContent = $('#modal-content')
function openModal(content) {
  modalContent.innerHTML = content
  refreshIcons()
  modal.showModal()
}
$('.modal-close').addEventListener('click', () => modal.close())
modal.addEventListener('click', (event) => {
  const rect = modal.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close()
})

$('#reset').addEventListener('click', () => {
  openModal(`<p class="eyebrow">A fresh beginning</p><h2>Let the tide<br>start again?</h2><p class="modal-description">Your placed terrain in this garden will be cleared.</p><div class="modal-actions"><button class="secondary-button" id="cancel-reset">Keep growing</button><button class="primary-button" id="confirm-reset">Start again ${icon('rotate-ccw')}</button></div>`)
  $('#cancel-reset').addEventListener('click', () => modal.close())
  $('#confirm-reset').addEventListener('click', () => { scene?.resetPresentation(); game.reset(); hintCell = null; render(); modal.close() })
})

$('#help').addEventListener('click', () => {
  openModal(`<p class="eyebrow">The art of balance</p><h2>A little land.<br>A little water.</h2><div class="rule"><span class="rule-icon">${icon('scale')}</span><div><h3>Equal measure</h3><p>Every row and column contains five water tiles and five land tiles.</p></div></div><div class="rule"><span class="rule-icon">${icon('grid-3x3')}</span><div><h3>Keep the rhythm</h3><p>Three water tiles or three land tiles may never appear consecutively, horizontally or vertically.</p></div></div><div class="rule"><span class="rule-icon">${icon('fingerprint')}</span><div><h3>Every line is its own</h3><p>No two completed rows or columns can have the same terrain pattern.</p></div></div><p class="given-note"><b></b> Gold dots mark the terrain already in place.</p>`)
})

$('#levels').addEventListener('click', () => {
  openModal(`<p class="eyebrow">Twenty little worlds</p><h2>Your gardens.</h2><p class="modal-description">${game.completed.length} of 20 in perfect balance</p><div class="level-grid">${GARDEN_NAMES.map((name, index) => `<button class="level-button ${game.level === index ? 'current' : ''} ${game.completed.includes(index) ? 'completed' : ''}" data-level="${index}" aria-label="Garden ${index + 1}: ${name}${game.completed.includes(index) ? ', completed' : ''}"><span>${String(index + 1).padStart(2, '0')}</span>${game.completed.includes(index) ? icon('check') : ''}</button>`).join('')}</div>`)
  document.querySelectorAll('[data-level]').forEach((button) => button.addEventListener('click', () => {
    game.load(Number(button.dataset.level))
    hintCell = null
    scene?.clearSelection()
    render()
    modal.close()
    if (game.complete) startFinale('revisit')
  }))
})

// The finale: the interface steps aside while the scene celebrates, then a small card
// offers the next garden without covering the finished one.
let finale = null
const appRoot = $('.garden-app')
const card = $('#finale-card')
function startFinale(mode, origin = null) {
  if (!scene) return
  endCard()
  finale = { mode }
  appRoot.classList.add('finale')
  appRoot.classList.toggle('finale-quick', mode !== 'celebrate')
  scene.finale.start(mode, origin)
  $('#finale-number').textContent = String(game.level + 1).padStart(2, '0')
  $('#finale-name').textContent = GARDEN_NAMES[game.level]
  $('#finale-time').textContent = $('#time').textContent
  $('#finale-count').textContent = game.completed.length
  $('#finale-next-label').textContent = game.level === GARDEN_NAMES.length - 1 ? 'Return to first light' : 'Grow the next garden'
  finale.timer = setTimeout(showCard, scene.finale.plan.card * 1000)
}
function showCard() {
  if (!finale || finale.card) return
  clearTimeout(finale.timer)
  finale.card = true
  card.inert = false
  card.classList.add('visible')
  $('#finale-next').focus({ preventScroll: true })
}
function endCard() {
  clearTimeout(finale?.timer)
  card.classList.remove('visible')
  card.inert = true
}
function endFinale() {
  if (!finale) return
  endCard()
  finale = null
  appRoot.classList.remove('finale', 'finale-quick')
  scene?.finale.stop()
}
$('#finale-stay').addEventListener('click', () => { endFinale(); scene?.clearSelection() })
$('#finale-next').addEventListener('click', () => {
  endFinale()
  game.load((game.level + 1) % GARDEN_NAMES.length)
  hintCell = null
  render()
  if (game.complete) startFinale('revisit')
})
// A tap during the celebration brings the card forward without cutting the show short.
$('#world').addEventListener('pointerdown', () => { if (finale) showCard() })

document.addEventListener('keydown', (event) => {
  if (modal.open || event.target instanceof HTMLInputElement) return
  if (finale) {
    if (event.key === 'Escape') endFinale()
    else if (!finale.card && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) showCard()
    return
  }
  if (event.key === '0' || event.key === 'w') game.selected = 0
  else if (event.key === '1' || event.key === 'l') game.selected = 1
  else if (event.key === 'e' || event.key === 'Backspace') { game.selected = null; event.preventDefault() }
  else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { game.undo(); event.preventDefault() }
  else return
  render()
})

setInterval(() => {
  if (!game.complete && !document.hidden && !modal.open) { game.seconds++; game.save(); render() }
}, 1000)
render()
if (game.complete) startFinale('revisit')

// Read-only development diagnostics keep visual and canvas tests grounded in the rendered scene.
if (import.meta.env.DEV) {
  window.__tidal = {
    get snapshot() {
      return {
        level: game.level, grid: game.grid.map((row) => [...row]), filled: game.filled,
        complete: game.complete, history: game.history.length,
        camera: scene?.camera.position.toArray(), daylight: scene?.daylight,
        clouds: scene?.clouds.clouds.length,
        finale: scene && { active: scene.finale.active, mode: scene.finale.mode, ...scene.finale.view, card: !!finale?.card, flock: scene.finale.flock.filter((bird) => bird.root.visible).length, fireflies: scene.finale.fireflies.length, lanterns: scene.finale.lanterns.filter((lantern) => lantern.root.visible).length },
        calls: scene?.renderer.info.render.calls,
        rendering: scene && { ...scene.profile, frames: scene.renderedFrames, buffer: [scene.renderer.domElement.width, scene.renderer.domElement.height] },
        ripples: scene?.ripples.map((ripple) => ripple.toArray()), particles: scene?.particles.length,
        waterInteraction: scene && { activeRipples: scene.waterRipples.active, rippleVisible: scene.waterRipples.mesh.visible, rippleVertices: scene.waterRipples.mesh.geometry.attributes.position.count },
        hover: scene?.hoverCell,
        aim: scene?.aim?.cell ?? null,
        touchMode: scene?.touchMode,
        waterLife: scene && { time: scene.time, splashes: scene.waterLife.splashes.map((splash) => splash.toArray()), plumes: scene.waterLife.plumes.map((plume) => ({ started: plume.started, visible: plume.group.visible, height: plume.column.scale.y })), drops: scene.waterLife.drops.length, leaps: scene.waterLife.leapers.filter((leaper) => leaper.leap).length, shoal: scene.waterLife.shoal.map((fish) => ({ x: fish.x, z: fish.z, opacity: fish.opacity, hidden: fish.hidden })) },
        selected: scene?.selectedCell,
        activeCell: scene?.activeCell,
        guides: scene?.crossTiles.map((plane) => plane.visible),
        boundary: scene && { segments: scene.guides.children.length, color: scene.boundaryMaterial.color.getHex(), opacity: scene.boundaryMaterial.opacity },
        targets: scene?.targets.length,
        water: scene && { clock: scene.waterUniforms.uTime.value, sun: scene.sun.position.toArray() },
        completedRegions: scene && [...scene.completions.regions.values()].map((region) => ({ id: region.id, value: region.value, cells: region.cells, ornaments: region.nodes.length, habitat: region.habitat.kind, residents: region.habitat.actors.map((actor) => ({ position: actor.root.position.toArray(), heading: actor.root.rotation.y, scale: actor.root.scale.x })) })),
        completionEvents: scene?.completions.events.map((event) => ({ ...event })),
        activeCompletions: scene?.completions.active.map((effect) => ({ id: effect.id, variant: effect.variant, age: scene.time - effect.started, particles: effect.particles.length, rings: effect.rings.length })),
        terrain: scene?.cells.map((cell) => ({
          row: cell.row, col: cell.col, mask: cell.mask,
          reactionAt: cell.reactionAt, elevation: cell.land.position.y, sway: cell.plants.rotation.x,
        })),
      }
    },
    gust() { scene?.breeze.start(scene.time) },
    cloud(progress = 0) { return scene?.clouds.spawn(scene.time, progress) },
    cellPosition(row, col) {
      const rect = access.children[row * 10 + col].getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    },
  }
}
