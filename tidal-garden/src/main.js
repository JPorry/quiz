import { createIcons, ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Eraser, Fingerprint, Grid3x3, Lightbulb, RotateCcw, Scale, Sprout, Undo2, Volume2, VolumeX, Waves, X } from 'lucide'
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
app.innerHTML = `
  <main class="garden-app">
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
      <div class="placement-status" id="placement-status" aria-live="polite"><span></span><p>Water selected</p></div>
      <div class="palette" role="group" aria-label="Place terrain">
        <button class="terrain-tool water selected" data-value="0" aria-label="Place water" aria-pressed="true"><span class="tool-art water-art">${icon('waves')}</span><span><strong>Water</strong><small>Let it flow</small></span><b class="selected-dot"></b></button>
        <button class="terrain-tool land" data-value="1" aria-label="Place land" aria-pressed="false"><span class="tool-art land-art">${icon('sprout')}</span><span><strong>Land</strong><small>Let it grow</small></span><b class="selected-dot"></b></button>
        <button class="erase-tool" data-value="erase" aria-label="Erase terrain" aria-pressed="false" title="Erase terrain">${icon('eraser')}</button>
      </div>
      <div class="action-row">
        <button class="text-tool" id="undo" disabled>${icon('undo-2')}<span>Undo</span></button>
        <span class="action-divider"></span>
        <button class="text-tool" id="hint">${icon('lightbulb')}<span>A little nudge</span></button>
        <span class="action-divider"></span>
        <button class="text-tool" id="reset">${icon('rotate-ccw')}<span>Start again</span></button>
      </div>
    </footer>
    <div class="quiet-footer"><span>LAND & WATER, IN EQUAL MEASURE</span><span>NO. <b id="edition-number">001</b></span></div>
  </main>
  <dialog id="modal"><button class="icon-button modal-close" aria-label="Close">${icon('x')}</button><div id="modal-content"></div></dialog>
`

const $ = (selector) => document.querySelector(selector)
const refreshIcons = () => createIcons({ icons: { ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Eraser, Fingerprint, Grid3x3, Lightbulb, RotateCcw, Scale, Sprout, Undo2, Volume2, VolumeX, Waves, X }, attrs: { 'stroke-width': 1.6 } })
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
  const left = phone ? 0 : $('.garden-journal').getBoundingClientRect().right - world.left + 36
  return { top, bottom, left, right: world.width - (phone ? 0 : 36) }
}

try {
  scene = new GardenScene($('#world'), { onCell: placeCell, safeArea: boardSafeArea })
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

function placeCell(row, col) {
  scene?.selectCell({ row, col })
  if (!game.place(row, col)) return
  hintCell = null
  playTone(game.selected)
  render()
  if (game.complete) showCompletion()
}

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
  $('#hint').disabled = game.complete
  const status = game.complete ? 'A world in balance' : invalid.size ? 'A little out of balance' : game.selected === null ? 'Erase selected' : game.selected === 0 ? 'Water selected' : 'Land selected'
  $('#placement-status p').textContent = status
  $('#placement-status').classList.toggle('invalid', invalid.size > 0)
  document.querySelectorAll('[data-value]').forEach((button) => {
    const value = button.dataset.value === 'erase' ? null : Number(button.dataset.value)
    button.classList.toggle('selected', value === game.selected)
    button.setAttribute('aria-pressed', String(value === game.selected))
  })
}

document.querySelectorAll('[data-value]').forEach((button) => button.addEventListener('click', () => {
  game.selected = button.dataset.value === 'erase' ? null : Number(button.dataset.value)
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
$('#hint').addEventListener('click', () => {
  if (findViolations(game.grid).size) {
    $('#placement-status p').textContent = 'Check the coral-marked tiles first'
    return
  }
  hintCell = findHint(game.grid)
  if (!hintCell) {
    $('#placement-status p').textContent = 'Compare completed rows and columns'
    return
  }
  game.selected = hintCell.value
  render()
  scene?.showHover(null)
  scene?.selectCell(hintCell, { force: true })
  $('#placement-status p').textContent = `Row ${hintCell.row + 1}, column ${hintCell.col + 1} needs ${hintCell.value === 0 ? 'water' : 'land'}`
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
  }))
})

function showCompletion() {
  const next = (game.level + 1) % GARDEN_NAMES.length
  openModal(`<span class="completion-icon">${icon('sprout')}</span><p class="eyebrow">${GARDEN_NAMES[game.level]}</p><h2>A world<br>in balance.</h2><p class="modal-description">Every pool has its place.<br>Every garden has room to grow.</p><button class="primary-button" id="next-garden">${game.level === 19 ? 'Return to first light' : 'Grow the next garden'} ${icon('arrow-right')}</button><button class="completion-stay" id="stay-garden">Stay a little longer</button>`)
  $('#next-garden').addEventListener('click', () => { game.load(next); render(); modal.close() })
  $('#stay-garden').addEventListener('click', () => modal.close())
}

document.addEventListener('keydown', (event) => {
  if (modal.open || event.target instanceof HTMLInputElement) return
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

// Read-only development diagnostics keep visual and canvas tests grounded in the rendered scene.
if (import.meta.env.DEV) {
  window.__tidal = {
    get snapshot() {
      return {
        level: game.level, grid: game.grid.map((row) => [...row]), filled: game.filled,
        complete: game.complete, history: game.history.length,
        camera: scene?.camera.position.toArray(), daylight: scene?.daylight,
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
    cellPosition(row, col) {
      const rect = access.children[row * 10 + col].getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    },
  }
}
