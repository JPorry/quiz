import { createIcons, Music, Map as MapIcon, Lock, Play, Footprints, Ship, Sun, House, ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Fingerprint, Grid3x3, Lightbulb, MoonStar, Move3d, RotateCcw, Scale, Sprout, Undo2, Volume2, VolumeX, X } from 'lucide'
import { GardenGame, GARDENS, GARDEN_NAMES, CHAPTERS, chapterOf, findViolations, findHint } from './game.js'
import { GardenScene } from './scene.js'
import { mapLayout, mapMarkup, MAP_ART } from './map.js'
import { GardenAudio } from './audio.js'
import { TITLE_ART } from './titleArt.js'
import { DeviceTilt } from './tilt.js'
import './style.css'

const game = new GardenGame()
let scene
const audio = new GardenAudio()
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
    <div class="game-layout">
      <header class="game-bar">
        <button class="round-button" id="to-map" aria-label="Garden map" title="Garden map">${icon('map')}</button>
        <div class="garden-pill">
          <span class="pill-number" id="chapter-number">1</span>
          <span class="pill-text">
            <small><span id="caption-chapter">The Shallows</span><span class="pill-dot"></span><span id="time">00:00</span></small>
            <strong id="garden-name">First light</strong>
            <span class="pill-progress" aria-hidden="true"><span id="progress-bar"></span></span>
          </span>
        </div>
        <div class="bar-tools">
          <button class="round-button" id="tilt" aria-label="Tilt the garden with your phone" aria-pressed="false" title="Tilt with your phone" hidden>${icon('move-3d')}</button>
          <button class="round-button sound-toggle" id="sound" data-scope="all" aria-label="Mute music and sounds" aria-pressed="false" title="Music and sounds">${icon('volume-x')}</button>
          <button class="round-button" id="help" aria-label="Garden rules" title="Garden rules">${icon('circle-help')}</button>
        </div>
      </header>
      <div class="board-slot" aria-hidden="true"></div>
      <div class="placement-status" id="placement-status" aria-live="polite"><p></p></div>
      <footer class="game-dock">
        <div class="palette" role="group" aria-label="Place terrain">
          ${piece('water', 0, 'Place water', 'Water')}
          ${piece('land', 1, 'Place land', 'Land')}
          ${piece('erase', 'erase', 'Erase terrain', 'Clear')}
        </div>
        <div class="action-row">
          <button class="tool-chip" id="undo" disabled>${icon('undo-2')}<span>Undo</span></button>
          <button class="tool-chip" id="hint">${icon('lightbulb')}<span>Hint</span></button>
          <button class="tool-chip" id="reset">${icon('rotate-ccw')}<span>Restart</span></button>
        </div>
      </footer>
    </div>
    <section class="finale-card" id="finale-card" aria-labelledby="finale-title" inert>
      <p class="eyebrow"><span></span>Garden <b id="finale-number">01</b>&nbsp;·&nbsp;<em id="finale-name">First light</em></p>
      <h2 id="finale-title">A world in balance.</h2>
      <p class="finale-meta"><span>${icon('clock-3')}Grown in <b id="finale-time">00:00</b></span><span class="time-divider"></span><span><b id="finale-count">1</b> of ${GARDEN_NAMES.length} gardens</span></p>
      <div class="finale-actions">
        <button class="secondary-button" id="finale-stay">Stay a little longer</button>
        <button class="primary-button" id="finale-next"><span id="finale-next-label">Grow the next garden</span> ${icon('arrow-right')}</button>
      </div>
      <p class="finale-tip">Drag to turn the island</p>
    </section>
    <section class="title-screen" id="title-screen" aria-label="Tidal Garden">
      ${TITLE_ART}
      <div class="title-content">
        <h1 class="title-logo"><span class="logo-line">Tidal</span> <span class="logo-line">Garden</span></h1>
        <svg class="title-flourish" viewBox="0 0 120 12" aria-hidden="true"><path d="M2 6 q7 -6 14 0 t14 0 t14 0 M76 6 q7 -6 14 0 t14 0 t14 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="60" cy="6" r="3" fill="currentColor"/></svg>
        <p class="title-tagline">A little land, a little water.</p>
      </div>
      <div class="title-bottom">
        <button class="play-button" id="title-play">${icon('play')}<span>Play</span></button>
        <p class="title-progress" id="title-progress"></p>
      </div>
      <div class="title-tools">
        <button class="round-button music-toggle" aria-label="Turn the music off" aria-pressed="false" title="Music">${icon('music')}</button>
        <button class="round-button sound-toggle" aria-label="Turn sound effects off" aria-pressed="false" title="Sound effects">${icon('volume-x')}</button>
        <button class="round-button" id="title-help" aria-label="Garden rules" title="Garden rules">${icon('circle-help')}</button>
      </div>
    </section>
    <section class="map-screen" id="map-screen" aria-label="Garden map" inert>
      <div class="map-scroll" id="map-scroll"><div class="map-canvas" id="map-canvas"></div></div>
      <header class="map-bar">
        <button class="round-button" id="map-home" aria-label="Back to the title">${icon('house')}</button>
        <div class="map-progress" aria-live="polite"><span>${icon('sprout')}</span><b id="map-count">0</b><small>/ ${GARDEN_NAMES.length}</small></div>
        <div class="map-tools">
          <button class="round-button music-toggle" aria-label="Turn the music off" aria-pressed="false" title="Music">${icon('music')}</button>
          <button class="round-button sound-toggle" aria-label="Turn sound effects off" aria-pressed="false" title="Sound effects">${icon('volume-x')}</button>
        </div>
      </header>
      <div class="map-card" id="map-card" role="dialog" aria-labelledby="map-card-title" inert>
        <button class="round-button map-card-close" id="map-card-close" aria-label="Close">${icon('x')}</button>
        <p class="map-card-chapter" id="map-card-chapter"></p>
        <h2 id="map-card-title"></h2>
        <p class="map-card-name" id="map-card-name"></p>
        <p class="map-card-status" id="map-card-status"></p>
        <button class="play-button" id="map-card-play">${icon('play')}<span id="map-card-play-label">Play</span></button>
      </div>
    </section>
  </main>
  <dialog id="modal"><button class="icon-button modal-close" aria-label="Close">${icon('x')}</button><div id="modal-content"></div></dialog>
`

const $ = (selector) => document.querySelector(selector)
const refreshIcons = () => createIcons({ icons: { Music, Map: MapIcon, Lock, Play, Footprints, Ship, Sun, House, ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Fingerprint, Grid3x3, Lightbulb, MoonStar, Move3d, RotateCcw, Scale, Sprout, Undo2, Volume2, VolumeX, X }, attrs: { 'stroke-width': 1.6 } })
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

// The board slot is whatever the bar, the hint line, and the dock leave free; the diorama fills it.
function boardSafeArea() {
  const world = $('#world').getBoundingClientRect()
  const slot = $('.board-slot').getBoundingClientRect()
  return { top: slot.top - world.top, bottom: slot.bottom - world.top, left: slot.left - world.left, right: slot.right - world.left }
}

// While the finished garden is on show, the interface steps aside: the island takes everything
// between the top bar and the card at the bottom.
// Wide screens keep the card in the journal's place on the left; narrower ones put it underneath.
function finaleSafeArea() {
  const world = $('#world').getBoundingClientRect()
  const phone = world.width <= 700
  const card = $('#finale-card')
  const top = $('.game-bar').getBoundingClientRect().bottom - world.top + (phone ? 0 : 6)
  // Layout positions ignore the card's slide-in offset, so the framing holds still as it appears.
  if (world.width >= 1100) return { top, bottom: world.height - 30, left: card.offsetLeft + card.offsetWidth + 30, right: world.width - 40 }
  return { top, bottom: card.offsetTop - (phone ? 6 : 16), left: phone ? 10 : 40, right: world.width - (phone ? 10 : 40) }
}

try {
  scene = new GardenScene($('#world'), { onCell: placeCell, safeArea: boardSafeArea, finaleArea: finaleSafeArea, onFlourish: (lines) => clueSound('flourish', { lines: lines.length }), onVillage: () => clueSound('village'), onLighthouse: () => clueSound('lighthouse'), onFerry: () => clueSound('ferry'), onPilgrim: () => clueSound('pilgrim') })
} catch (error) {
  $('#world').innerHTML = `<div class="render-error"><p>Your garden needs WebGL to bloom.</p><small>Please open it in a browser with hardware acceleration enabled.</small></div>`
  console.error(error)
}

function placeCell(row, col) {
  scene?.selectCell({ row, col })
  if (!game.place(row, col)) return
  hintCell = null
  const before = findViolations(game.grid, game.puzzle).size
  audio.play(game.selected === 0 ? 'place-water' : game.selected === 1 ? 'place-land' : 'place-erase', { row, col })
  render()
  if (game.complete) { audio.play('win'); startFinale('celebrate', { row, col }) }
  else if (findViolations(game.grid, game.puzzle).size > before) audio.play('oops', { at: 0.12 })
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
  const invalid = findViolations(game.grid, game.puzzle)
  scene?.update(game.grid, game.puzzle.puzzle, invalid, game.complete, game.puzzle)
  $('#caption-chapter').textContent = chapterOf(game.level).name
  $('#chapter-number').textContent = game.level + 1
  $('#garden-name').textContent = GARDEN_NAMES[game.level]
  $('#progress-bar').style.width = `${game.filled}%`
  $('#time').textContent = `${String(Math.floor(game.seconds / 60)).padStart(2, '0')}:${String(game.seconds % 60).padStart(2, '0')}`
  $('#undo').disabled = !game.history.length
  // A finished garden swaps the hint for a way back to its evening view.
  if (game.complete !== shownComplete) {
    shownComplete = game.complete
    $('#hint').innerHTML = game.complete ? `${icon('moon-star')}<span>See it at dusk</span>` : `${icon('lightbulb')}<span>Hint</span>`
    refreshIcons()
  }
  if (finale && !game.complete) endFinale()
  // The raised piece already shows the selection, so the status line only speaks up when it matters.
  // The first garden of a chapter explains what is new until the first tile goes down.
  const introducing = !game.history.length && CHAPTERS.find((chapter) => chapter.start === game.level && chapter.intro)
  const status = game.complete ? 'A world in balance' : invalid.size ? 'A little out of balance' : hintCell ? hintText(hintCell)
    : introducing ? introducing.intro : ''
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
  audio.play(value === 0 ? 'water' : value === 1 ? 'land' : 'erase')
  game.selected = value
  hintCell = null
  scene?.showHover(null)
  render()
}))

$('#undo').addEventListener('click', () => { if (game.undo()) { audio.play('undo'); hintCell = null; render() } })
// Music and sound effects each have their own switch on the title and the map; the garden's own
// bar has one button that hushes or wakes both together.
function showAudio() {
  document.querySelectorAll('.music-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(audio.music))
    button.setAttribute('aria-label', audio.music ? 'Turn the music off' : 'Turn the music on')
    button.classList.toggle('off', !audio.music)
  })
  document.querySelectorAll('.sound-toggle').forEach((button) => {
    const on = button.dataset.scope === 'all' ? audio.music || audio.effects : audio.effects
    button.setAttribute('aria-pressed', String(on))
    button.setAttribute('aria-label', button.dataset.scope === 'all' ? (on ? 'Mute music and sounds' : 'Play music and sounds') : (on ? 'Turn sound effects off' : 'Turn sound effects on'))
    button.innerHTML = icon(on ? 'volume-2' : 'volume-x')
  })
  refreshIcons()
}
document.querySelectorAll('.music-toggle').forEach((button) => button.addEventListener('click', () => { audio.unlock(); audio.setMusic(!audio.music); showAudio() }))
document.querySelectorAll('.sound-toggle').forEach((button) => button.addEventListener('click', () => {
  audio.unlock()
  if (button.dataset.scope === 'all') {
    const on = !(audio.music || audio.effects)
    audio.setMusic(on)
    audio.setEffects(on)
  } else audio.setEffects(!audio.effects)
  showAudio()
  audio.play('tap')
}))
showAudio()
// Browsers only allow sound after a tap or a key, so the first one wakes the music.
addEventListener('pointerdown', () => audio.unlock(), true)
addEventListener('keydown', () => audio.unlock(), true)
document.addEventListener('visibilitychange', () => {
  if (!audio.context) return
  if (document.hidden) audio.context.suspend()
  else audio.context.resume()
})
// Clue celebrations stay quiet once the garden is finished, when the finale has its own sound.
function clueSound(name, options) { if (!game.complete) audio.play(name, options) }
// On phones the garden leans very slightly with the device. Where the browser shares motion
// freely it starts on; iOS asks once, on the player's first tap, and the button turns it on or off.
const tilt = new DeviceTilt({ reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches })
function showTilt() {
  $('#tilt').setAttribute('aria-pressed', String(tilt.enabled))
  $('#tilt').setAttribute('aria-label', tilt.enabled ? 'Stop tilting the garden with your phone' : 'Tilt the garden with your phone')
}
if (tilt.supported && scene && !tilt.reducedMotion) {
  scene.tilt = tilt
  $('#tilt').hidden = false
  tilt.restore()
  showTilt()
  // iOS only shares motion after a tap on each visit: the first prompts, later ones confirm quietly.
  if (tilt.shouldAsk) {
    const ask = async (event) => {
      if (event.target.closest?.('#tilt') || !tilt.shouldAsk) return
      if (await tilt.confirm() === 'retry') return
      removeEventListener('touchend', ask, true)
      removeEventListener('click', ask, true)
      showTilt()
    }
    addEventListener('touchend', ask, true)
    addEventListener('click', ask, true)
  }
}
$('#tilt').addEventListener('click', async () => {
  if (tilt.enabled) tilt.disable()
  else await tilt.enable()
  showTilt()
})

// Says which tile to fill and the reasoning behind it, so the hint teaches the technique.
function hintText({ row, col, value, technique, axis }) {
  const kind = value === 0 ? 'water' : 'land', other = value === 0 ? 'land' : 'water'
  const why = {
    pair: `it's beside two ${other} tiles in a row`,
    gap: `it sits between two ${other} tiles`,
    count: `its ${axis} already has five ${other}`,
    line: `it's the only way to finish its ${axis}`,
    seal: `the village beside it already has as many tiles as its sign`,
    grow: `it's the only way the village beside it can still grow`,
    apart: `land here would join islands into a village bigger than its sign`,
    block: `the lighthouse beside it already sees its number, so land must stop the beam here`,
    shine: `a lighthouse can only reach its number if its light passes here`,
    channel: `every way left between two matching docks passes here, so their ferry needs this water`,
    trail: `every way left between two matching shrines passes here, so their pilgrim needs this land`,
  }[technique]
  return `Row ${row + 1}, column ${col + 1} is ${kind}: ${why}`
}

$('#hint').addEventListener('click', () => {
  if (game.complete) { startFinale('revisit'); return }
  if (findViolations(game.grid, game.puzzle).size) {
    audio.play('oops')
    $('#placement-status p').textContent = 'Check the coral-marked tiles first'
    return
  }
  hintCell = findHint(game.grid, game.puzzle.solution, game.puzzle)
  if (!hintCell) {
    audio.play('oops')
    $('#placement-status p').textContent = 'One of your tiles is out of place'
    return
  }
  audio.play('hint')
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
  audio.play('open')
  openModal(`<p class="eyebrow">A fresh beginning</p><h2>Let the tide<br>start again?</h2><p class="modal-description">Your placed terrain in this garden will be cleared.</p><div class="modal-actions"><button class="secondary-button" id="cancel-reset">Keep growing</button><button class="primary-button" id="confirm-reset">Start again ${icon('rotate-ccw')}</button></div>`)
  $('#cancel-reset').addEventListener('click', () => { audio.play('back'); modal.close() })
  $('#confirm-reset').addEventListener('click', () => { audio.play('restart'); scene?.resetPresentation(); game.reset(); hintCell = null; render(); modal.close() })
})

function openHelp() {
  audio.play('open')
  openModal(`<p class="eyebrow">The art of balance</p><h2>A little land.<br>A little water.</h2><div class="rule"><span class="rule-icon">${icon('scale')}</span><div><h3>Equal measure</h3><p>Every row and column contains five water tiles and five land tiles.</p></div></div><div class="rule"><span class="rule-icon">${icon('grid-3x3')}</span><div><h3>Keep the rhythm</h3><p>Three water tiles or three land tiles may never appear consecutively, horizontally or vertically.</p></div></div><div class="rule"><span class="rule-icon">${icon('fingerprint')}</span><div><h3>Every line is its own</h3><p>No two completed rows or columns can have the same terrain pattern.</p></div></div><div class="rule"><span class="rule-icon">${icon('house')}</span><div><h3>Village signs</h3><p>In later gardens, a wooden sign counts the land tiles of its island. Each new tile you join to it raises a little hut, and the village comes to life when the island is closed in at its number.</p></div></div><div class="rule"><span class="rule-icon">${icon('sun')}</span><div><h3>Lighthouses</h3><p>A lighthouse counts the water tiles its light reaches straight up, down, left and right before land or the edge stops it. Glowing dots show what it already sees, and it lights up when every beam ends at its number.</p></div></div><div class="rule"><span class="rule-icon">${icon('ship')}</span><div><h3>Ferries</h3><p>Docks with matching roofs must be joined by water, moving up, down, left and right, so their little ferry can sail from one to the other.</p></div></div><div class="rule"><span class="rule-icon">${icon('footprints')}</span><div><h3>Pilgrims</h3><p>Shrines with matching lanterns must stand on the same island, joined by land up, down, left and right, so their little pilgrim can walk from one to the other.</p></div></div><p class="given-note"><b></b> Stone-rimmed land with a little landmark, and deeper pools of water, mark the terrain already in place.</p>`)
}
$('#help').addEventListener('click', openHelp)
$('#title-help').addEventListener('click', openHelp)

$('#to-map').addEventListener('click', () => { audio.play('back'); showScreen('map') })

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
  // Evening falls in the music too: the melody settles and crickets come out.
  audio.setMood('evening')
  $('#finale-number').textContent = String(game.level + 1).padStart(2, '0')
  $('#finale-name').textContent = GARDEN_NAMES[game.level]
  $('#finale-time').textContent = $('#time').textContent
  $('#finale-count').textContent = game.completed.length
  $('#finale-next-label').textContent = 'Onward'
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
  audio.setMood(screen)
}
$('#finale-stay').addEventListener('click', () => { audio.play('back'); endFinale(); scene?.clearSelection() })
// Onward leads back to the map, where the marker hops along to the garden that just opened.
$('#finale-next').addEventListener('click', () => showScreen('map', { offer: true }))
// A tap during the celebration brings the card forward without cutting the show short.
$('#world').addEventListener('pointerdown', () => { if (finale) showCard() })

document.addEventListener('keydown', (event) => {
  if (screen === 'map' && event.key === 'Escape' && mapCard.classList.contains('visible')) { closeCard(); return }
  if (screen !== 'play' || modal.open || event.target instanceof HTMLInputElement) return
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
  if (screen === 'play' && !game.complete && !document.hidden && !modal.open) { game.seconds++; game.save(); render() }
}, 1000)
// The game has three screens: the title, the map of every garden, and the garden itself. Each
// step forward is a history entry, so a phone's back button walks back through them.
let screen
let mapWidth = 0
let shownFrontier = game.frontier
const mapScreen = $('#map-screen')
const mapScroll = $('#map-scroll')
const mapCanvas = $('#map-canvas')
const mapCard = $('#map-card')
let cardLevel = null

function showScreen(name, { push = true, offer = false } = {}) {
  if (name === screen) return
  if (screen === 'play') { endFinale(); scene?.showHover(null) }
  // Each move between screens drifts the music into that screen's mood, on a breath of wind.
  if (screen) audio.play('swoosh')
  screen = name
  appRoot.dataset.screen = name
  audio.setMood(name)
  $('#title-screen').inert = name !== 'title'
  mapScreen.inert = name !== 'map'
  // The title and the map cover the whole garden, so the scene rests while they're open.
  if (scene) scene.paused = name !== 'play'
  if (name === 'title') {
    const done = game.completed.length
    $('#title-progress').textContent = done ? `${done} of ${GARDEN_NAMES.length} gardens in balance` : `${GARDEN_NAMES.length} little gardens to grow`
  }
  if (name === 'map') openMap({ offer })
  else closeCard()
  if (name === 'play') {
    hintCell = null
    render()
    if (game.complete) startFinale('revisit')
  }
  if (push) history.pushState({ screen: name }, '', name === 'title' ? location.pathname + location.search : `#${name}`)
}
// Tall screens crop the title's picture to fill; wide ones fit it whole, so the island stays a
// sensible size beneath the logo.
function frameTitle() {
  $('.title-art')?.setAttribute('preserveAspectRatio', innerWidth / innerHeight > 0.85 ? 'xMidYMax meet' : 'xMidYMax slice')
}
addEventListener('resize', frameTitle)
frameTitle()
// Safari zooms on a pinch or a double tap even when the page asks it not to, so those gestures are
// stopped here; the garden's own pinch and drag go through the canvas's pointer events instead.
for (const type of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(type, (event) => event.preventDefault(), { passive: false })
addEventListener('popstate', (event) => showScreen(event.state?.screen ?? 'title', { push: false }))
$('#title-play').addEventListener('click', () => { audio.unlock(); audio.play('tap'); showScreen('map') })
$('#map-home').addEventListener('click', () => { audio.play('back'); showScreen('title') })

// Lays out the whole map and scrolls to the newest open garden. When a garden has opened since the
// map was last seen, the marker hops along to it and, after a win, its card comes up.
function openMap({ offer = false } = {}) {
  const width = Math.min(mapScroll.clientWidth || innerWidth, 560)
  mapWidth = width
  const frontier = game.frontier
  const layout = mapLayout(CHAPTERS, width)
  mapCanvas.style.width = `${width}px`
  mapCanvas.style.height = `${layout.height}px`
  mapCanvas.innerHTML = MAP_ART + mapMarkup(layout, CHAPTERS, { completed: game.completed, isUnlocked: (level) => game.isUnlocked(level), frontier, names: GARDEN_NAMES })
  refreshIcons()
  $('#map-count').textContent = game.completed.length
  const marker = mapCanvas.querySelector('.map-marker')
  const from = layout.nodes[Math.min(shownFrontier, frontier)]
  const to = layout.nodes[frontier]
  mapScroll.scrollTop = from.y - mapScroll.clientHeight * 0.55
  if (frontier !== shownFrontier && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    marker.style.left = `${from.x}px`
    marker.style.top = `${from.y}px`
    mapCanvas.querySelector(`.map-node[data-level="${frontier}"]`)?.classList.add('opening')
    audio.play('hop', { at: 0.1 })
    audio.play('unlock', { at: 0.7 })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      marker.classList.add('hopping')
      marker.style.left = `${to.x}px`
      marker.style.top = `${to.y}px`
      mapScroll.scrollTo({ top: to.y - mapScroll.clientHeight * 0.55, behavior: 'smooth' })
    }))
  }
  shownFrontier = frontier
  if (offer) setTimeout(() => { if (screen === 'map') openCard(frontier) }, 900)
}
mapCanvas.addEventListener('click', (event) => {
  const node = event.target.closest('.map-node')
  if (!node) return
  const level = Number(node.dataset.level)
  if (!game.isUnlocked(level)) {
    audio.play('locked')
    node.classList.remove('nudge')
    void node.offsetWidth
    node.classList.add('nudge')
    return
  }
  audio.play('select', { level })
  openCard(level)
})
addEventListener('resize', () => { if (screen === 'map' && Math.min(mapScroll.clientWidth, 560) !== mapWidth) openMap() })

const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
// A small card about the garden, with the way in.
function openCard(level) {
  cardLevel = level
  const saved = game.grids[level]
  const filled = saved?.grid?.flat().filter((value) => value !== null).length ?? 0
  const givens = GARDENS[level].puzzle.flat().filter((value) => value !== null).length
  const done = game.completed.includes(level)
  $('#map-card-chapter').textContent = chapterOf(level).name
  $('#map-card-title').textContent = `Garden ${level + 1}`
  $('#map-card-name').textContent = GARDEN_NAMES[level]
  $('#map-card-status').textContent = done ? `In balance · grown in ${clock(saved?.seconds ?? 0)}` : filled > givens ? `Growing · ${filled} of 100 tiles` : 'A new garden'
  $('#map-card-play-label').textContent = done ? 'Visit' : filled > givens ? 'Continue' : 'Play'
  mapCard.inert = false
  mapCard.classList.add('visible')
  mapCanvas.querySelectorAll('.map-node.chosen').forEach((node) => node.classList.remove('chosen'))
  mapCanvas.querySelector(`.map-node[data-level="${level}"]`)?.classList.add('chosen')
}
function closeCard() {
  cardLevel = null
  mapCard.classList.remove('visible')
  mapCard.inert = true
  mapCanvas.querySelectorAll('.map-node.chosen').forEach((node) => node.classList.remove('chosen'))
}
$('#map-card-close').addEventListener('click', () => { audio.play('back'); closeCard() })
$('#map-card-play').addEventListener('click', () => {
  if (cardLevel === null) return
  audio.play('start')
  if (cardLevel !== game.level) {
    game.load(cardLevel)
    scene?.clearSelection()
  }
  showScreen('play')
})

// Every visit opens on the title; ?play goes straight into the current garden, for testing.
const firstScreen = new URLSearchParams(location.search).has('play') ? 'play' : 'title'
history.replaceState({ screen: firstScreen }, '', location.pathname + location.search)
render()
showScreen(firstScreen, { push: false })

// Read-only development diagnostics keep visual and canvas tests grounded in the rendered scene.
if (import.meta.env.DEV) {
  window.__tidal = {
    get snapshot() {
      return {
        level: game.level, grid: game.grid.map((row) => [...row]), filled: game.filled,
        complete: game.complete, history: game.history.length,
        camera: scene?.camera.position.toArray(), daylight: scene?.daylight, sun: scene?.sun.position.toArray().map((v) => +v.toFixed(2)),
        clouds: scene?.clouds.clouds.length,
        pilgrims: scene && { shrines: scene.shrines.shrineCount, joined: scene.shrines.joinedCount, walking: scene.shrines.walkingCount, lanterns: scene.shrines.lanternCount, at: scene.shrines.pairs.map((pair) => pair.pilgrim.group.visible && [+pair.pilgrim.group.position.x.toFixed(2), +pair.pilgrim.group.position.z.toFixed(2)]) },
        ferries: scene && { docks: scene.harbors.dockCount, joined: scene.harbors.joinedCount, sailing: scene.harbors.sailingCount, at: scene.harbors.routes.map((route) => route.ferry.group.visible && [+route.ferry.group.position.x.toFixed(2), +route.ferry.group.position.z.toFixed(2)]) },
        lighthouses: scene && { towers: scene.beacons.towers.size, lit: scene.beacons.litCount, dots: scene.beacons.dotCount },
        villages: scene && { huts: scene.villages.hutCount, alive: scene.villages.aliveCount, signs: scene.villages.signModels.size },
        lean: scene?.lean,
        audio: { state: audio.context?.state ?? 'none', music: audio.music, effects: audio.effects, mood: audio.mood, playing: !!audio.playing, track: audio.decks[audio.live]?.track ?? null, time: audio.decks[audio.live]?.element.currentTime ?? 0, effectsLoaded: audio.buffers.size },
        flourishes: scene?.flourish.count,
        rain: scene && { strength: scene.rain.strength, drops: scene.rain.drops.length, marks: scene.rain.marks.length },
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
    get screen() { return screen },
    show(name) { showScreen(name) },
    gust() { scene?.breeze.start(scene.time) },
    cloud(progress = 0, options) { return scene?.clouds.spawn(scene.time, progress, options) },
    // Holds every running flourish at a given age, so a screenshot can catch it mid-sweep.
    // Holds every lit lighthouse at a moment of its lighting-up, for screenshots; null releases it.
    holdLighthouse(age) { if (scene) scene.beacons.hold = age },
    // Sends every moored ferry off on its next crossing right away.
    departFerries() { scene?.harbors.depart() },
    // Sends every resting pilgrim off on their next walk right away.
    departPilgrims() { scene?.shrines.depart() },
    holdFlourish(age) { scene?.flourish.active.forEach((flourish) => { flourish.hold = age }) },
    // Where a tile's centre appears on screen with the live camera, leaning included.
    screenPoint(row, col) {
      const cell = scene.cells[row * 10 + col]
      const p = cell.group.position.clone().setY(scene.cellHeight(cell)).project(scene.camera)
      const rect = scene.renderer.domElement.getBoundingClientRect()
      return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height }
    },
    cellPosition(row, col) {
      const rect = access.children[row * 10 + col].getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    },
  }
}
