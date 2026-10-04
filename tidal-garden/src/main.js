import { createIcons, Music, Map as MapIcon, Lock, Play, Footprints, Ship, Sun, House, ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Fingerprint, Grid3x3, Lightbulb, MoonStar, Move3d, RotateCcw, Scale, Sprout, Undo2, Volume2, VolumeX, X, Settings as SettingsIcon, Languages, GraduationCap, Trash2 } from 'lucide'
import { GardenGame, GARDENS, GARDEN_NAMES, CHAPTERS, chapterOf, findViolations, findHint } from './game.js'
import { GardenScene } from './scene.js'
import { mapLayout, mapMarkup, MAP_ART } from './map.js'
import { GardenAudio } from './audio.js'
import { TITLE_ART } from './titleArt.js'
import { DeviceTilt } from './tilt.js'
import { Tutorial } from './tutorial.js'
import { t, LANGUAGES, language, setLanguage, gardenName, chapterName, chapterIntro, terrain } from './i18n.js'
import './style.css'

const game = new GardenGame()
const tutorial = new Tutorial()
let scene
const audio = new GardenAudio()
let hintCell = null
const app = document.querySelector('#app')
// The page speaks the player's language, down to its title and description.
document.documentElement.lang = language()
document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.description'))
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
      <div class="board-access" role="group" aria-label="${t('board.grid')}"></div>
    </div>
    <div class="game-layout">
      <header class="game-bar">
        <button class="round-button" id="to-map" aria-label="${t('bar.map')}" title="${t('bar.map')}">${icon('map')}</button>
        <div class="garden-pill">
          <span class="pill-number" id="chapter-number">1</span>
          <span class="pill-text">
            <small><span id="caption-chapter"></span><span class="pill-dot"></span><span id="time">00:00</span></small>
            <strong id="garden-name"></strong>
            <span class="pill-progress" aria-hidden="true"><span id="progress-bar"></span></span>
          </span>
        </div>
        <div class="bar-tools">
          <button class="round-button open-settings" aria-label="${t('settings')}" title="${t('settings')}">${icon('settings')}</button>
        </div>
      </header>
      <section class="coach" id="coach" aria-live="polite" hidden>
        <p class="coach-title" id="coach-title"></p>
        <p class="coach-text" id="coach-text"></p>
        <div class="coach-foot">
          <p class="coach-instruction" id="coach-instruction"></p>
          <button class="coach-skip" id="coach-skip">${t('coach.skip')}</button>
          <button class="coach-next" id="coach-next"></button>
        </div>
      </section>
      <div class="board-slot" aria-hidden="true"></div>
      <div class="placement-status" id="placement-status" aria-live="polite"><p></p></div>
      <footer class="game-dock">
        <div class="palette" role="group" aria-label="${t('dock.palette')}">
          ${piece('water', 0, t('piece.placeWater'), t('piece.water'))}
          ${piece('land', 1, t('piece.placeLand'), t('piece.land'))}
          ${piece('erase', 'erase', t('piece.erase'), t('piece.clear'))}
        </div>
        <div class="action-row">
          <button class="tool-chip" id="undo" disabled>${icon('undo-2')}<span>${t('dock.undo')}</span></button>
          <button class="tool-chip" id="hint">${icon('lightbulb')}<span>${t('dock.hint')}</span></button>
          <button class="tool-chip" id="reset">${icon('rotate-ccw')}<span>${t('dock.restart')}</span></button>
        </div>
      </footer>
    </div>
    <section class="finale-card" id="finale-card" aria-labelledby="finale-title" inert>
      <p class="eyebrow"><span></span>${t('finale.garden')} <b id="finale-number">01</b>&nbsp;·&nbsp;<em id="finale-name"></em></p>
      <h2 id="finale-title">${t('finale.title')}</h2>
      <p class="finale-meta"><span>${icon('clock-3')}${t('finale.grownIn')} <b id="finale-time">00:00</b></span><span class="time-divider"></span><span><b id="finale-count">1</b> ${t('finale.of', { total: GARDEN_NAMES.length })}</span></p>
      <div class="finale-actions">
        <button class="secondary-button" id="finale-stay">${t('finale.stay')}</button>
        <button class="primary-button" id="finale-next"><span id="finale-next-label">${t('finale.next')}</span> ${icon('arrow-right')}</button>
      </div>
      <p class="finale-tip">${t('finale.tip')}</p>
    </section>
    <section class="title-screen" id="title-screen" aria-label="Tidal Garden">
      ${TITLE_ART}
      <div class="title-content">
        <h1 class="title-logo"><span class="logo-line">Tidal</span> <span class="logo-line">Garden</span></h1>
        <svg class="title-flourish" viewBox="0 0 120 12" aria-hidden="true"><path d="M2 6 q7 -6 14 0 t14 0 t14 0 M76 6 q7 -6 14 0 t14 0 t14 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="60" cy="6" r="3" fill="currentColor"/></svg>
        <p class="title-tagline">${t('title.tagline')}</p>
      </div>
      <div class="title-bottom">
        <button class="play-button" id="title-play">${icon('play')}<span>${t('title.play')}</span></button>
        <p class="title-progress" id="title-progress"></p>
      </div>
      <div class="title-tools">
        <button class="round-button music-toggle" aria-label="${t('audio.musicOff')}" aria-pressed="false" title="${t('audio.music')}">${icon('music')}</button>
        <button class="round-button sound-toggle" aria-label="${t('audio.effectsOff')}" aria-pressed="false" title="${t('audio.effects')}">${icon('volume-x')}</button>
        <button class="round-button open-settings" aria-label="${t('settings')}" title="${t('settings')}">${icon('settings')}</button>
        <button class="round-button" id="title-help" aria-label="${t('bar.rules')}" title="${t('bar.rules')}">${icon('circle-help')}</button>
      </div>
    </section>
    <section class="map-screen" id="map-screen" aria-label="${t('map.label')}" inert>
      <div class="map-scroll" id="map-scroll"><div class="map-canvas" id="map-canvas"></div></div>
      <header class="map-bar">
        <button class="round-button" id="map-home" aria-label="${t('map.home')}">${icon('house')}</button>
        <div class="map-progress" id="map-progress" aria-live="polite"><span>${icon('sprout')}</span><b id="map-count">0</b><small>/ ${GARDEN_NAMES.length}</small></div>
        <div class="map-tools">
          <button class="round-button music-toggle" aria-label="${t('audio.musicOff')}" aria-pressed="false" title="${t('audio.music')}">${icon('music')}</button>
          <button class="round-button sound-toggle" aria-label="${t('audio.effectsOff')}" aria-pressed="false" title="${t('audio.effects')}">${icon('volume-x')}</button>
          <button class="round-button open-settings" aria-label="${t('settings')}" title="${t('settings')}">${icon('settings')}</button>
        </div>
      </header>
      <p class="map-toast" id="map-toast" role="status"></p>
      <div class="map-card" id="map-card" role="dialog" aria-labelledby="map-card-title" inert>
        <button class="round-button map-card-close" id="map-card-close" aria-label="${t('close')}">${icon('x')}</button>
        <p class="map-card-chapter" id="map-card-chapter"></p>
        <h2 id="map-card-title"></h2>
        <p class="map-card-name" id="map-card-name"></p>
        <p class="map-card-status" id="map-card-status"></p>
        <button class="play-button" id="map-card-play">${icon('play')}<span id="map-card-play-label">${t('map.play')}</span></button>
      </div>
    </section>
  </main>
  <dialog id="modal"><button class="icon-button modal-close" aria-label="${t('close')}">${icon('x')}</button><div id="modal-content"></div></dialog>
`

const $ = (selector) => document.querySelector(selector)
const refreshIcons = () => createIcons({ icons: { Music, Map: MapIcon, Lock, Play, Footprints, Ship, Sun, House, ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Fingerprint, Grid3x3, Lightbulb, MoonStar, Move3d, RotateCcw, Scale, Sprout, Undo2, Volume2, VolumeX, X, Settings: SettingsIcon, Languages, GraduationCap, Trash2 }, attrs: { 'stroke-width': 1.6 } })
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
  $('#world').innerHTML = `<div class="render-error"><p>${t('render.error')}</p><small>${t('render.errorHelp')}</small></div>`
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
  const coach = tutorial.card(game.level, game.grid, game.selected, game.complete, game.puzzle)
  scene?.update(game.grid, game.puzzle.puzzle, invalid, game.complete, game.puzzle)
  $('#caption-chapter').textContent = chapterName(CHAPTERS.indexOf(chapterOf(game.level)))
  $('#chapter-number').textContent = game.level + 1
  $('#garden-name').textContent = gardenName(game.level)
  $('#progress-bar').style.width = `${game.filled}%`
  $('#time').textContent = `${String(Math.floor(game.seconds / 60)).padStart(2, '0')}:${String(game.seconds % 60).padStart(2, '0')}`
  $('#undo').disabled = !game.history.length
  // A finished garden swaps the hint for a way back to its evening view.
  if (game.complete !== shownComplete) {
    shownComplete = game.complete
    $('#hint').innerHTML = game.complete ? `${icon('moon-star')}<span>${t('dock.dusk')}</span>` : `${icon('lightbulb')}<span>${t('dock.hint')}</span>`
    refreshIcons()
  }
  if (finale && !game.complete) endFinale()
  // The raised piece already shows the selection, so the status line only speaks up when it matters.
  // The first garden of a chapter explains what is new until the first tile goes down.
  const introducing = !coach && !game.history.length && CHAPTERS.findIndex((chapter) => chapter.start === game.level && chapter.intro)
  const status = game.complete ? t('status.balanced') : invalid.size ? t('status.invalid') : hintCell ? hintText(hintCell)
    : introducing > 0 ? chapterIntro(introducing) : ''
  $('#placement-status p').textContent = status
  $('#placement-status').classList.toggle('invalid', invalid.size > 0)
  document.querySelectorAll('[data-value]').forEach((button) => {
    const value = button.dataset.value === 'erase' ? null : Number(button.dataset.value)
    button.classList.toggle('selected', value === game.selected)
    button.setAttribute('aria-pressed', String(value === game.selected))
  })
  if (shownSelection !== undefined && shownSelection !== game.selected) burst(pieceFor(game.selected))
  shownSelection = game.selected
  renderCoach(coach)
}

// The guided gardens: a card above the board says what to do, the piece to pick bounces, and
// the tile to place glows on the board, with soft rings on the tiles that decide it.
function renderCoach(card) {
  const app = document.querySelector('.garden-app')
  const was = app.classList.contains('coaching')
  app.classList.toggle('coaching', !!card)
  $('#coach').hidden = !card
  scene?.showGuide(card?.target || card?.because?.length ? card : null)
  document.querySelectorAll('.piece').forEach((button) => button.classList.toggle('coach-pick', card?.pick !== undefined && card?.pick !== null && button.dataset.value === String(card.pick)))
  // The card takes a row of its own, so the board makes room for it, and takes the room back after.
  if (was !== !!card) scene?.resize()
  if (!card) return
  $('#coach').dataset.step = card.step
  $('#coach-title').textContent = card.title
  $('#coach-text').textContent = card.text
  $('#coach-instruction').textContent = card.instruction ?? ''
  $('#coach-next').textContent = card.action ?? ''
  $('#coach-next').hidden = !card.action
  $('#coach-skip').hidden = card.step === 'outro'
}
$('#coach-next').addEventListener('click', () => { audio.play(tutorial.step === 'outro' ? 'start' : 'tap'); tutorial.next(); render() })
$('#coach-skip').addEventListener('click', () => { audio.play('back'); tutorial.finish(); render() })

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
// Music and sound effects each have their own switch on the title and the map, and a slider in
// Settings.
function showAudio() {
  document.querySelectorAll('.music-toggle').forEach((button) => {
    button.setAttribute('aria-pressed', String(audio.music))
    button.setAttribute('aria-label', t(audio.music ? 'audio.musicOff' : 'audio.musicOn'))
    button.classList.toggle('off', !audio.music)
  })
  document.querySelectorAll('.sound-toggle').forEach((button) => {
    const on = audio.effects
    button.setAttribute('aria-pressed', String(on))
    button.setAttribute('aria-label', t(on ? 'audio.effectsOff' : 'audio.effectsOn'))
    button.innerHTML = icon(on ? 'volume-2' : 'volume-x')
  })
  refreshIcons()
}
document.querySelectorAll('.music-toggle').forEach((button) => button.addEventListener('click', () => { audio.unlock(); audio.setMusic(!audio.music); showAudio() }))
document.querySelectorAll('.sound-toggle').forEach((button) => button.addEventListener('click', () => {
  audio.unlock()
  audio.setEffects(!audio.effects)
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
// Its switch lives in Settings, shown only where the phone can tilt the garden.
const tiltAvailable = tilt.supported && !!scene && !tilt.reducedMotion
function showTilt() {
  const toggle = $('#tilt-toggle')
  if (toggle) toggle.checked = tilt.enabled
}
if (tiltAvailable) {
  scene.tilt = tilt
  tilt.restore()
  showTilt()
  // iOS only shares motion after a tap on each visit: the first prompts, later ones confirm quietly.
  if (tilt.shouldAsk) {
    const ask = async (event) => {
      if (event.target.closest?.('#tilt-toggle') || !tilt.shouldAsk) return
      if (await tilt.confirm() === 'retry') return
      removeEventListener('touchend', ask, true)
      removeEventListener('click', ask, true)
      showTilt()
    }
    addEventListener('touchend', ask, true)
    addEventListener('click', ask, true)
  }
}

// Says which tile to fill and the reasoning behind it, so the hint teaches the technique.
function hintText({ row, col, value, technique, axis }) {
  const why = t(`hint.${technique}`, { other: terrain(1 - value), axis: t(`axis.${axis}`) })
  return t('hint.text', { row: row + 1, col: col + 1, kind: terrain(value), why })
}

$('#hint').addEventListener('click', () => {
  if (game.complete) { startFinale('revisit'); return }
  if (findViolations(game.grid, game.puzzle).size) {
    audio.play('oops')
    $('#placement-status p').textContent = t('status.checkFirst')
    return
  }
  hintCell = findHint(game.grid, game.puzzle.solution, game.puzzle)
  if (!hintCell) {
    audio.play('oops')
    $('#placement-status p').textContent = t('status.misplaced')
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
// Only a click on the backdrop closes it: a button that swaps the content would otherwise count
// as outside once the dialog shrinks around its new content.
modal.addEventListener('click', (event) => {
  if (event.target !== modal) return
  const rect = modal.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close()
})

$('#reset').addEventListener('click', () => {
  audio.play('open')
  openModal(`<p class="eyebrow">${t('restart.eyebrow')}</p><h2>${t('restart.title')}</h2><p class="modal-description">${t('restart.text')}</p><div class="modal-actions"><button class="secondary-button" id="cancel-reset">${t('restart.keep')}</button><button class="primary-button" id="confirm-reset">${t('restart.confirm')} ${icon('rotate-ccw')}</button></div>`)
  $('#cancel-reset').addEventListener('click', () => { audio.play('back'); modal.close() })
  $('#confirm-reset').addEventListener('click', () => { audio.play('restart'); scene?.resetPresentation(); game.reset(); hintCell = null; render(); modal.close() })
})

function openHelp() {
  audio.play('open')
  openModal(`<p class="eyebrow">${t('rules.eyebrow')}</p><h2>${t('rules.title')}</h2><div class="rule"><span class="rule-icon">${icon('scale')}</span><div><h3>${t('rules.balance')}</h3><p>${t('rules.balanceText')}</p></div></div><div class="rule"><span class="rule-icon">${icon('grid-3x3')}</span><div><h3>${t('rules.rhythm')}</h3><p>${t('rules.rhythmText')}</p></div></div><div class="rule"><span class="rule-icon">${icon('fingerprint')}</span><div><h3>${t('rules.unique')}</h3><p>${t('rules.uniqueText')}</p></div></div><div class="rule"><span class="rule-icon">${icon('house')}</span><div><h3>${t('rules.villages')}</h3><p>${t('rules.villagesText')}</p></div></div><div class="rule"><span class="rule-icon">${icon('sun')}</span><div><h3>${t('rules.lighthouses')}</h3><p>${t('rules.lighthousesText')}</p></div></div><div class="rule"><span class="rule-icon">${icon('ship')}</span><div><h3>${t('rules.ferries')}</h3><p>${t('rules.ferriesText')}</p></div></div><div class="rule"><span class="rule-icon">${icon('footprints')}</span><div><h3>${t('rules.pilgrims')}</h3><p>${t('rules.pilgrimsText')}</p></div></div><p class="given-note"><b></b> ${t('rules.given')}</p><div class="modal-actions"><button class="secondary-button" id="help-settings">${icon('settings')} ${t('settings')}</button></div>`)
  $('#help-settings').addEventListener('click', openSettings)
}

// Settings: how loud the music and the effects are, the language, and two fresh starts: the
// tutorial again, or every garden from the beginning.
const percent = (value) => Math.round(value * 100)
const REOPEN = 'tidal-garden.reopen'
function openSettings() {
  audio.play('open')
  openModal(`<p class="eyebrow">${t('settings.eyebrow')}</p><h2>${t('settings.title')}</h2>
    <div class="setting"><label for="music-volume"><span class="rule-icon">${icon('music')}</span>${t('audio.music')}</label><input type="range" id="music-volume" min="0" max="100" step="5" value="${audio.music ? percent(audio.musicVolume) : 0}"><output id="music-volume-value"></output></div>
    <div class="setting"><label for="effects-volume"><span class="rule-icon">${icon('volume-2')}</span>${t('audio.effects')}</label><input type="range" id="effects-volume" min="0" max="100" step="5" value="${audio.effects ? percent(audio.effectsVolume) : 0}"><output id="effects-volume-value"></output></div>
    <div class="setting"><label for="language"><span class="rule-icon">${icon('languages')}</span>${t('settings.language')}</label><select id="language">${Object.entries(LANGUAGES).map(([code, { name }]) => `<option value="${code}" lang="${code}"${code === language() ? ' selected' : ''}>${name}</option>`).join('')}</select></div>
    <p class="setting-note">${t('settings.languageNote')}</p>
    ${tiltAvailable ? `<div class="setting"><label for="tilt-toggle"><span class="rule-icon">${icon('move-3d')}</span>${t('settings.tilt')}</label><input type="checkbox" role="switch" class="switch" id="tilt-toggle"${tilt.enabled ? ' checked' : ''}></div><p class="setting-note">${t('settings.tiltNote')}</p>` : ''}
    <div class="settings-actions">
      <button class="secondary-button" id="settings-rules">${icon('circle-help')} ${t('bar.rules')}</button>
      <button class="secondary-button" id="replay-tutorial">${icon('graduation-cap')} ${t('settings.replay')}</button>
      <button class="danger-button" id="reset-progress">${icon('trash-2')} ${t('settings.reset')}</button>
    </div>`)
  const show = () => {
    $('#music-volume-value').textContent = `${$('#music-volume').value}%`
    $('#effects-volume-value').textContent = `${$('#effects-volume').value}%`
    for (const id of ['#music-volume', '#effects-volume']) $(id).style.setProperty('--fill', `${$(id).value}%`)
  }
  show()
  $('#music-volume').addEventListener('input', (event) => { audio.unlock(); audio.setMusicVolume(event.target.value / 100); showAudio(); show() })
  $('#effects-volume').addEventListener('input', (event) => { audio.setEffectsVolume(event.target.value / 100); showAudio(); show() })
  // Letting go of the effects slider plays a little tap at the new loudness.
  $('#effects-volume').addEventListener('change', () => audio.play('tap'))
  // A new language reloads the game in it, back on the same screen with Settings open.
  $('#language').addEventListener('change', (event) => {
    setLanguage(event.target.value)
    try { sessionStorage.setItem(REOPEN, screen) } catch { /* It just opens on the title. */ }
    location.reload()
  })
  $('#tilt-toggle')?.addEventListener('change', async (event) => {
    if (event.target.checked) await tilt.enable()
    else tilt.disable()
    showTilt()
  })
  $('#settings-rules').addEventListener('click', openHelp)
  $('#replay-tutorial').addEventListener('click', replayTutorial)
  $('#reset-progress').addEventListener('click', confirmResetAll)
}
document.querySelectorAll('.open-settings').forEach((button) => button.addEventListener('click', openSettings))

// The tutorial plays again in the first garden, cleared for it (a finished garden stays finished),
// and every chapter's guide comes back too.
function replayTutorial() {
  audio.play('start')
  modal.close()
  tutorial.restart()
  closeCard()
  game.load(0)
  game.reset()
  scene?.resetPresentation()
  hintCell = null
  if (screen === 'play') { endFinale(); render() } else showScreen('play')
}

function confirmResetAll() {
  audio.play('oops')
  const done = game.completed.length
  openModal(`<p class="eyebrow">${t('resetAll.eyebrow')}</p><h2>${t('resetAll.title')}</h2><p class="modal-description">${t(done === 0 ? 'resetAll.textNone' : done === 1 ? 'resetAll.textOne' : 'resetAll.textMany', { done })}</p><div class="modal-actions"><button class="secondary-button" id="keep-progress">${t('resetAll.keep')}</button><button class="danger-button" id="confirm-reset-all">${icon('trash-2')} ${t('resetAll.confirm')}</button></div>`)
  $('#keep-progress').addEventListener('click', () => { audio.play('back'); openSettings() })
  $('#confirm-reset-all').addEventListener('click', () => {
    audio.play('restart')
    game.resetAll()
    tutorial.restart()
    shownFrontier = game.frontier
    scene?.resetPresentation()
    hintCell = null
    endFinale()
    modal.close()
    render()
    if (screen === 'title') updateTitle()
    else showScreen('title')
  })
}
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
  $('#finale-name').textContent = gardenName(game.level)
  $('#finale-time').textContent = $('#time').textContent
  $('#finale-count').textContent = game.completed.length
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

function updateTitle() {
  const done = game.completed.length
  $('#title-progress').textContent = done ? t('title.progress', { done, total: GARDEN_NAMES.length }) : t('title.fresh', { total: GARDEN_NAMES.length })
}

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
  if (name === 'title') updateTitle()
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
  const chapters = CHAPTERS.map((chapter, index) => ({ ...chapter, name: chapterName(index) }))
  const layout = mapLayout(chapters, width)
  mapCanvas.style.width = `${width}px`
  mapCanvas.style.height = `${layout.height}px`
  mapCanvas.innerHTML = MAP_ART + mapMarkup(layout, chapters, { completed: game.completed, isUnlocked: (level) => game.isUnlocked(level), frontier, names: GARDEN_NAMES.map((_, level) => gardenName(level)) })
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

// A hidden developer switch: tapping the garden count seven times in quick succession opens every
// garden on the map (or closes them again), for trying any level.
let devTaps = []
$('#map-progress').addEventListener('click', () => {
  const now = performance.now()
  devTaps = [...devTaps.filter((time) => now - time < 3000), now]
  if (devTaps.length < 7) return
  devTaps = []
  game.unlockAll = !game.unlockAll
  audio.play(game.unlockAll ? 'unlock' : 'locked')
  const toast = $('#map-toast')
  toast.textContent = t(game.unlockAll ? 'map.devOn' : 'map.devOff')
  toast.classList.remove('visible')
  void toast.offsetWidth
  toast.classList.add('visible')
  openMap()
})

const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
// A small card about the garden, with the way in.
function openCard(level) {
  cardLevel = level
  const saved = game.grids[level]
  const filled = saved?.grid?.flat().filter((value) => value !== null).length ?? 0
  const givens = GARDENS[level].puzzle.flat().filter((value) => value !== null).length
  const done = game.completed.includes(level)
  $('#map-card-chapter').textContent = chapterName(CHAPTERS.indexOf(chapterOf(level)))
  $('#map-card-title').textContent = t('map.garden', { n: level + 1 })
  $('#map-card-name').textContent = gardenName(level)
  $('#map-card-status').textContent = done ? t('map.done', { time: clock(saved?.seconds ?? 0) }) : filled > givens ? t('map.growing', { filled }) : t('map.new')
  $('#map-card-play-label').textContent = t(done ? 'map.visit' : filled > givens ? 'map.continue' : 'map.play')
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

// Every visit opens on the title; ?play goes straight into the current garden, for testing. After
// switching language, the game comes back where it was, with Settings open.
let reopen = null
try { reopen = sessionStorage.getItem(REOPEN); sessionStorage.removeItem(REOPEN) } catch { /* Fine without. */ }
const firstScreen = new URLSearchParams(location.search).has('play') ? 'play' : ['title', 'map', 'play'].includes(reopen) ? reopen : 'title'
history.replaceState({ screen: firstScreen }, '', location.pathname + location.search)
render()
showScreen(firstScreen, { push: false })
if (reopen) openSettings()

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
        coach: { step: tutorial.step, lesson: tutorial.lesson },
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
