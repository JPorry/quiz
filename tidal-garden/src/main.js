import { createIcons, Music, Play, Footprints, Ship, Sun, House, ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, Fingerprint, Grid3x3, Lightbulb, MoonStar, Move3d, RotateCcw, Scale, Sprout, Undo2, Volume2, X, Settings as SettingsIcon, Languages, GraduationCap, Trash2, Calendar, Flame } from 'lucide'
import { GardenGame, findViolations, findHint } from './game.js'
import { GardenScene } from './scene.js'
import { GardenAudio } from './audio.js'
import { DeviceTilt } from './tilt.js'
import { Tutorial } from './tutorial.js'
import { TIERS, today, dayOf, dateOf, puzzle } from './daily.js'
import { TUTORIAL } from './tutorialGarden.js'
import { t, LANGUAGES, language, setLanguage, terrain } from './i18n.js'
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
const tierName = (tier) => t(`tier.${tier}`)
const tierPips = (tier) => `<i class="pips">${[0, 1, 2].map((k) => `<b class="${k <= TIERS.indexOf(tier) ? 'on' : ''}"></b>`).join('')}</i>`
const capital = (text) => text.charAt(0).toLocaleUpperCase(language()) + text.slice(1)
const longDate = (day) => capital(dateOf(day).toLocaleDateString(language(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))
const dayName = (day) => (day === today() ? t('day.today') : day === today() - 1 ? t('day.yesterday') : capital(dateOf(day).toLocaleDateString(language(), { day: 'numeric', month: 'short', timeZone: 'UTC' })))
// Little drifting petals and bubbles over the menus.
const DRIFT = [...Array(10)].map((_, k) => `<i class="drift ${k % 3 ? 'petal' : 'bubble'}" style="--x:${(k * 37 + 7) % 100}%;--d:${(k * 1.7) % 9}s;--t:${12 + (k * 3) % 7}s;--c:${['#ffc6d6', '#fff3b8', '#ffffff', '#ffd9b8', '#d4f4ff'][k % 5]}"></i>`).join('')
// The picker is three little diorama pieces: a pool, a grassy islet, and an empty socket.
const PIECE_ART = {
  water: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#35b3c4"/><rect x="4" y="4" width="56" height="56" rx="11" fill="none" stroke="#7fdcd6" stroke-width="3"/><g class="art-waves" stroke="#b5f0ee" stroke-width="3" fill="none" stroke-linecap="round"><path d="M-24 24 q6 -5 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0"/><path d="M-36 42 q6 -5 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0"/></g><path class="art-glint" d="M47 13 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4z" fill="#fff"/></svg>`,
  land: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#f4dfae"/><rect x="7" y="7" width="50" height="50" rx="11" fill="#92d46f"/><circle cx="17" cy="47" r="2.8" fill="#ffe07a"/><circle cx="47" cy="48" r="2.8" fill="#ff9fb2"/><circle cx="49" cy="17" r="2.6" fill="#fff"/><circle cx="14" cy="18" r="2.4" fill="#ff9fb2"/><ellipse cx="37" cy="40" rx="13" ry="7.5" fill="#2f6f3a" opacity=".28"/><g class="art-tree"><circle cx="31" cy="31" r="13" fill="#54b25c"/><circle cx="26" cy="26" r="5" fill="#9fe282"/></g></svg>`,
  erase: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#f6eedb"/><rect x="11" y="11" width="42" height="42" rx="9" fill="#dccdaa"/><rect x="13" y="14" width="38" height="37" rx="8" fill="#efe5cd"/><g class="art-cloud"><rect x="19" y="20" width="26" height="25" rx="6" fill="none" stroke="#b3a283" stroke-width="2.4" stroke-dasharray="5 4.5" stroke-linecap="round"/><path d="M28.5 32.5h7M32 29v7" stroke="#b3a283" stroke-width="2" stroke-linecap="round"/></g></svg>`,
}
const PARTICLES = Array.from({ length: 10 }, (_, i) => `<i style="--a: ${i * 36 + (i % 2) * 14}deg; --i: ${i}"></i>`).join('')
const piece = (kind, value, label, name) => `<button class="piece ${kind}" data-value="${value}" aria-label="${label}" aria-pressed="false"><span class="piece-stage"><span class="piece-shadow"></span><span class="piece-ring"></span><span class="piece-tile">${PIECE_ART[kind]}</span><span class="piece-burst" aria-hidden="true">${PARTICLES}</span></span><span class="piece-name">${name}</span></button>`
app.innerHTML = `
  <main class="garden-app" data-screen="title">
    <div class="dusk" aria-hidden="true"></div>
    <div class="world" id="world">
      <div class="board-access" role="group" aria-label="${t('board.grid')}"></div>
    </div>
    <div class="game-layout">
      <header class="game-bar">
        <button class="round-button" id="back" aria-label="${t('back')}" title="${t('back')}">${icon('arrow-left')}</button>
        <div class="garden-pill">
          <span class="pill-number" id="tier-badge" aria-hidden="true"></span>
          <span class="pill-text">
            <small><span id="caption-day"></span><span class="pill-dot"></span><span id="time">00:00</span></small>
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
      <p class="eyebrow"><span></span><b id="finale-tier"></b>&nbsp;·&nbsp;<em id="finale-name"></em></p>
      <h2 id="finale-title">${t('finale.title')}</h2>
      <p class="finale-meta"><span>${icon('clock-3')}${t('finale.grownIn')} <b id="finale-time">00:00</b></span><span class="time-divider"></span><span id="finale-today"></span></p>
      <div class="finale-actions">
        <button class="secondary-button" id="finale-stay">${t('finale.stay')}</button>
        <button class="primary-button" id="finale-next"><span id="finale-next-label">${t('finale.next')}</span> ${icon('arrow-right')}</button>
      </div>
      <p class="finale-tip">${t('finale.tip')}</p>
    </section>
    <section class="titlepage enter" id="titlepage" aria-label="Tidal Garden">
      <img class="titlebg" src="title-sea.webp" alt="" draggable="false" aria-hidden="true">
      <h1 class="logo"><img src="title-logo.webp" alt="Tidal Garden" width="1000" height="500" draggable="false"><i class="glint" aria-hidden="true" style="-webkit-mask-image:url(title-logo.webp);mask-image:url(title-logo.webp)"></i></h1>
      <p class="tagline">${t('title.tagline')}</p>
      <div class="titlespace"></div>
      <nav class="titlebuttons">
        <button class="bigplay" id="title-play">${icon('play')}<span>${t('title.play')}</span></button>
        <button class="titlebtn" id="title-learn">${icon('graduation-cap')}<span>${t('title.learn')}</span></button>
      </nav>
      <button class="round titlegear open-settings" aria-label="${t('settings')}">${icon('settings')}</button>
    </section>
    <div class="menubg" aria-hidden="true"><img src="title-sea.webp" alt="" draggable="false"><span class="wash"></span>${DRIFT}</div>
    <section class="home" id="home" aria-label="${t('home.title')}">
      <header class="homehead">
        <button class="round" id="home-back" aria-label="${t('back.title')}">${icon('arrow-left')}</button>
        <div class="brand"><h1 class="hometitle">${t('home.title')}</h1></div>
        <button class="round open-settings" aria-label="${t('settings')}">${icon('settings')}</button>
      </header>
      <div class="chips">
        <p class="date"><span id="date"></span></p>
        <span class="tag-chip blooms" id="blooms"></span>
      </div>
      <div class="todays" id="todays"></div>
      <footer class="homefoot">
        <p class="hello" id="hello"></p>
        <button class="chip daysbutton" id="open-days">${icon('calendar')}<span>${t('home.earlier')}</span><b class="count" id="catchup" hidden></b></button>
      </footer>
    </section>
    <section class="dayspage" id="dayspage" aria-label="${t('days.title')}">
      <header class="dayshead">
        <button class="round" id="days-back" aria-label="${t('back.home')}">${icon('arrow-left')}</button>
        <div class="titles"><h1 class="hometitle">${t('days.title')}</h1><p class="date dayssum"><span id="dayssummary"></span></p></div>
      </header>
      <div class="months" id="months"></div>
      <div class="picker" id="daysheet" hidden>
        <div class="sheet">
          <div class="sheethead"><h2 id="sheetdate"></h2><button class="round" id="sheetclose" aria-label="${t('close')}">${icon('x')}</button></div>
          <div class="cards" id="cards"></div>
        </div>
      </div>
    </section>
  </main>
  <dialog id="modal"><button class="icon-button modal-close" aria-label="${t('close')}">${icon('x')}</button><div id="modal-content"></div></dialog>
`

const $ = (selector) => document.querySelector(selector)
const refreshIcons = (root) => createIcons({ icons: { Music, Play, Footprints, Ship, Sun, House, ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, Fingerprint, Grid3x3, Lightbulb, MoonStar, Move3d, RotateCcw, Scale, Sprout, Undo2, Volume2, X, Settings: SettingsIcon, Languages, GraduationCap, Trash2, Calendar, Flame }, attrs: { 'stroke-width': 1.6 }, root })
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
  const box = $('#finale-card')
  const top = $('.game-bar').getBoundingClientRect().bottom - world.top + (phone ? 0 : 6)
  // Layout positions ignore the card's slide-in offset, so the framing holds still as it appears.
  if (world.width >= 1100) return { top, bottom: world.height - 30, left: box.offsetLeft + box.offsetWidth + 30, right: world.width - 40 }
  return { top, bottom: box.offsetTop - (phone ? 6 : 16), left: phone ? 10 : 40, right: world.width - (phone ? 10 : 40) }
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
  if (game.complete) {
    // Finishing the tutorial garden finishes the tutorial, however far its coach had got.
    if (game.puzzle.id === TUTORIAL.id) tutorial.finish('basics')
    audio.play('win')
    startFinale('celebrate', { row, col })
  }
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
  const coach = tutorial.card(game.puzzle, game.grid, game.selected, game.complete)
  scene?.update(game.grid, game.puzzle.puzzle, invalid, game.complete, game.puzzle)
  const learning = game.puzzle.id === TUTORIAL.id
  $('#caption-day').textContent = learning ? t('tutorial.caption') : `${dayName(game.puzzle.day)} · ${tierName(game.puzzle.tier)}`
  $('#tier-badge').dataset.tier = game.puzzle.tier
  $('#tier-badge').innerHTML = tierPips(game.puzzle.tier)
  $('#garden-name').textContent = gardenTitle(game.puzzle)
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
  const status = game.complete ? t('status.balanced') : invalid.size ? t('status.invalid') : hintCell ? hintText(hintCell) : ''
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
  if (card) {
    $('#coach').dataset.step = card.step
    $('#coach-title').textContent = card.title
    $('#coach-text').textContent = card.text
    $('#coach-instruction').textContent = card.instruction ?? ''
    $('#coach-next').textContent = card.action ?? ''
    $('#coach-next').hidden = !card.action
    $('#coach-skip').hidden = card.step === 'outro'
    $('#coach-skip').textContent = t(game.puzzle.id === TUTORIAL.id ? 'coach.skip' : 'coach.skipGuide')
  }
  // The card takes a row of its own, so the board makes room for it (and again whenever the card
  // grows or shrinks), and takes the room back after.
  const height = card ? $('#coach').offsetHeight : 0
  if (was !== !!card || height !== coachHeight) scene?.resize()
  coachHeight = height
}
let coachHeight = 0
$('#coach-next').addEventListener('click', () => { audio.play(tutorial.step === 'outro' ? 'start' : 'tap'); tutorial.next(); render() })
// Skipping the tutorial goes straight on to the garden picked; skipping a clue's guide just ends it.
$('#coach-skip').addEventListener('click', () => {
  audio.play('back')
  const learning = game.puzzle.id === TUTORIAL.id
  tutorial.finish()
  if (learning) leaveTutorial()
  else render()
})

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
  $('#music-volume').addEventListener('input', (event) => { audio.unlock(); audio.setMusicVolume(event.target.value / 100); show() })
  $('#effects-volume').addEventListener('input', (event) => { audio.setEffectsVolume(event.target.value / 100); show() })
  // Letting go of the effects slider plays a little tap at the new loudness.
  $('#effects-volume').addEventListener('change', () => audio.play('tap'))
  // A new language reloads the game in it, back on the same screen with Settings open.
  $('#language').addEventListener('change', (event) => {
    setLanguage(event.target.value)
    try { sessionStorage.setItem(REOPEN, '1') } catch { /* It just opens where it was. */ }
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

// The tutorial garden plays again from its welcome, then returns to wherever the player was. Every
// clue's guide comes back too.
function replayTutorial() {
  audio.play('start')
  modal.close()
  tutorial.restart()
  afterTutorial = location.hash === '#/tutorial' ? afterTutorial : location.hash || '#/daily'
  if (location.hash === '#/tutorial') route()
  else location.hash = '#/tutorial'
}

function confirmResetAll() {
  audio.play('oops')
  const done = Object.keys(game.done).length
  openModal(`<p class="eyebrow">${t('resetAll.eyebrow')}</p><h2>${t('resetAll.title')}</h2><p class="modal-description">${t(done === 0 ? 'resetAll.textNone' : done === 1 ? 'resetAll.textOne' : 'resetAll.textMany', { done })}</p><div class="modal-actions"><button class="secondary-button" id="keep-progress">${t('resetAll.keep')}</button><button class="danger-button" id="confirm-reset-all">${icon('trash-2')} ${t('resetAll.confirm')}</button></div>`)
  $('#keep-progress').addEventListener('click', () => { audio.play('back'); openSettings() })
  $('#confirm-reset-all').addEventListener('click', () => {
    audio.play('restart')
    game.resetAll()
    tutorial.restart()
    scene?.resetPresentation()
    hintCell = null
    endFinale()
    modal.close()
    location.hash = ''
    route()
  })
}
$('#back').addEventListener('click', () => { audio.play('back'); location.hash = backTo })

// The finale: the interface steps aside while the scene celebrates, then a small card
// offers the next garden without covering the finished one.
let finale = null
const appRoot = $('.garden-app')
const finaleCard = $('#finale-card')
function startFinale(mode, origin = null) {
  if (!scene) return
  endCard()
  finale = { mode }
  appRoot.classList.add('finale')
  appRoot.classList.toggle('finale-quick', mode !== 'celebrate')
  scene.finale.start(mode, origin)
  // Evening falls in the music too: the melody settles and crickets come out.
  audio.setMood('evening')
  const learning = game.puzzle.id === TUTORIAL.id
  $('#finale-tier').textContent = learning ? t('tutorial.caption') : `${tierName(game.puzzle.tier)} · ${dayName(game.puzzle.day)}`
  $('#finale-name').textContent = gardenTitle(game.puzzle)
  $('#finale-time').textContent = $('#time').textContent
  const solvedToday = TIERS.filter((tier) => game.done[`${today()}-${tier}`] !== undefined).length
  $('#finale-today').textContent = t('finale.today', { n: solvedToday })
  // After the tutorial the card goes on to the garden picked; otherwise to the next one to play.
  next = learning ? null : nextGarden()
  $('#finale-next-label').textContent = learning ? t('finale.letsPlay') : next ? (next.day === game.puzzle.day ? t('finale.nextTier', { tier: tierName(next.tier) }) : t('finale.nextDay', { tier: tierName(next.tier) })) : t('finale.home')
  finale.timer = setTimeout(showCard, scene.finale.plan.card * 1000)
}
function showCard() {
  if (!finale || finale.card) return
  clearTimeout(finale.timer)
  finale.card = true
  finaleCard.inert = false
  finaleCard.classList.add('visible')
  $('#finale-next').focus({ preventScroll: true })
}
function endCard() {
  clearTimeout(finale?.timer)
  finaleCard.classList.remove('visible')
  finaleCard.inert = true
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
// Onward: after the tutorial, the garden picked; otherwise the next garden still to play, or home.
let next = null
$('#finale-next').addEventListener('click', () => {
  audio.play('start')
  if (game.puzzle.id === TUTORIAL.id) leaveTutorial()
  else location.hash = next ? `#/${next.day}/${next.tier}` : '#/daily'
})
// A tap during the celebration brings the card forward without cutting the show short.
$('#world').addEventListener('pointerdown', () => { if (finale) showCard() })

document.addEventListener('keydown', (event) => {
  if (screen === 'days' && event.key === 'Escape' && !$('#daysheet').hidden) { $('#daysheet').hidden = true; return }
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
/* ---------- today's gardens and earlier days ---------- */

const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
const gardenTitle = (p) => (p.id === TUTORIAL.id ? t('tutorial.name') : p.name)
const CLUE_ICON = { villages: 'house', lighthouses: 'sun', ferries: 'ship', pilgrims: 'footprints' }

// A little map of a garden: its starting tiles, any tiles placed (or its answer, once in balance),
// and a dot for each clue.
function miniMap(p) {
  const saved = game.grids[p.id]?.grid
  const done = game.done[p.id] !== undefined
  const grid = done ? p.solution : saved ?? p.puzzle
  const s = 10
  let tiles = ''
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    const v = grid[r][c]
    if (v === null) continue
    tiles += `<rect class="${v ? 'land' : 'water'}${p.puzzle[r][c] === null ? ' placed' : ''}" x="${c * s + 0.8}" y="${r * s + 0.8}" width="${s - 1.6}" height="${s - 1.6}" rx="2.4"/>`
  }
  const clues = [...p.signs.map((x) => x.cell), ...p.lights.map((x) => x.cell), ...p.ferries.flatMap((x) => x.docks), ...p.pilgrims.flatMap((x) => x.shrines)]
    .map(([r, c]) => `<circle class="clue" cx="${c * s + s / 2}" cy="${r * s + s / 2}" r="2.6"/>`).join('')
  return `<svg class="map" viewBox="-1 -1 102 102" aria-hidden="true"><rect class="sea" x="-1" y="-1" width="102" height="102" rx="8"/>${tiles}${clues}</svg>`
}

// days in a row, back from today (or yesterday, if today is still to come), with a garden in balance
function streak(now) {
  const solved = (day) => TIERS.some((tier) => game.done[`${day}-${tier}`] !== undefined)
  let day = solved(now) ? now : now - 1
  let n = 0
  while (day >= 1 && solved(day)) { n++; day-- }
  return n
}

function greeting() {
  const h = new Date().getHours()
  return t(h < 5 ? 'hello.night' : h < 12 ? 'hello.morning' : h < 18 ? 'hello.afternoon' : 'hello.evening')
}

// A garden as a card: its difficulty, a little map, its name, its clues, and what to do next (a
// finished one wears a stamp with its time).
function card(p) {
  const st = game.state(p.id)
  const action = { done: `${icon('check')}<span>${clock(game.done[p.id] ?? 0)}</span>`, started: `${icon('play')}<span>${t('card.resume')}</span>`, new: `${icon('play')}<span>${t('card.play')}</span>` }[st]
  const clues = p.kinds.length ? p.kinds.map((kind) => `<span class="clue-tag">${icon(CLUE_ICON[kind])}${t(`clue.${kind}`)}</span>`).join('') : `<span class="clue-tag">${icon('scale')}${t('clue.balance')}</span>`
  return `<button class="card ${st}" data-tier="${p.tier}" data-day="${p.day}" style="--i:${TIERS.indexOf(p.tier)}" aria-label="${tierName(p.tier)}: ${p.name}, ${t(`card.${st}.state`)}">
    <span class="tier">${tierName(p.tier)}${tierPips(p.tier)}</span>
    <span class="planter">${miniMap(p)}</span>
    <span class="pname">${p.name}</span>
    <span class="meta">${clues}</span>
    <span class="status">${action}</span>
  </button>`
}

// Three little islands for today, filling in as the gardens are solved.
const islet = (tier, st) => `<svg class="islet ${tier} ${st}" viewBox="0 0 32 24" aria-hidden="true"><ellipse cx="16" cy="18" rx="14" ry="5" fill="#7fd0d6"/><path d="M5 16 Q6 9 16 9 Q26 9 27 16 Q16 21 5 16Z" class="sand"/><path d="M8 13 Q10 8 16 8 Q22 8 24 13 Q16 15 8 13Z" class="grass"/>${st === 'done' ? '<circle class="bloom" cx="16" cy="8" r="3.2"/>' : st === 'started' ? '<path class="sprout" d="M16 12 V7 M16 9 q-3 -3 -5 -1 M16 8 q3 -3 5 -1" fill="none" stroke-width="1.6" stroke-linecap="round"/>' : ''}</svg>`

function drawHome() {
  const now = today()
  $('#date').textContent = longDate(now)
  const states = TIERS.map((tier) => game.state(`${now}-${tier}`))
  $('#todays').innerHTML = TIERS.map((tier) => card(puzzle(now, tier))).join('')
  const solved = states.filter((x) => x === 'done').length
  const n = streak(now)
  const flame = n ? `<span class="flame" title="${t(n === 1 ? 'streak.one' : 'streak', { n })}">${icon('flame')}<b>${n}</b></span>` : ''
  $('#blooms').innerHTML = flame + TIERS.map((tier, i) => islet(tier, states[i])).join('') + `<span class="count">${solved}/3</span>`
  $('#blooms').setAttribute('aria-label', [n ? t(n === 1 ? 'streak.one' : 'streak', { n }) : '', t('today.count', { n: solved })].filter(Boolean).join(', '))
  $('#hello').textContent = `${greeting()} ${t(`hello.${solved}`)}`
  let missed = 0
  for (let day = 1; day < now; day++) missed += TIERS.filter((tier) => game.done[`${day}-${tier}`] === undefined).length
  $('#catchup').hidden = !missed
  $('#catchup').textContent = missed > 99 ? '99+' : missed
  refreshIcons()
}

// Earlier days: a calendar, newest month first, weeks starting on Monday.
function drawDays() {
  const now = today()
  const months = []
  for (let day = now; day >= 1; day--) {
    const date = dateOf(day)
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    if (!months.length || months.at(-1).key !== key) months.push({ key, date })
  }
  let solved = 0
  for (let day = 1; day <= now; day++) solved += TIERS.filter((tier) => game.done[`${day}-${tier}`] !== undefined).length
  $('#dayssummary').textContent = t('days.summary', { solved, total: now * 3 })
  const weekdays = [...Array(7)].map((_, k) => new Date(Date.UTC(2024, 0, 1 + k)).toLocaleDateString(language(), { weekday: 'narrow', timeZone: 'UTC' }))
  $('#months').innerHTML = months.map(({ date }) => {
    const y = date.getUTCFullYear(), m = date.getUTCMonth()
    const first = new Date(Date.UTC(y, m, 1))
    const length = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const blanks = (first.getUTCDay() + 6) % 7
    const cells = [...Array(blanks)].map(() => '<span class="cell blank"></span>')
    for (let d = 1; d <= length; d++) {
      const day = dayOf(new Date(y, m, d))
      if (day < 1 || day > now) { cells.push(`<span class="cell off">${d}</span>`); continue }
      const sts = TIERS.map((tier) => game.state(`${day}-${tier}`))
      const all = sts.every((x) => x === 'done')
      cells.push(`<button class="cell${all ? ' complete' : ''}${day === now ? ' today' : ''}" data-day="${day}" aria-label="${dayName(day)}: ${t('days.cell', { n: sts.filter((x) => x === 'done').length })}"><b>${d}</b><span class="dots">${TIERS.map((tier, i) => `<i class="${tier} ${sts[i]}"></i>`).join('')}</span></button>`)
    }
    return `<section class="month"><h2>${capital(first.toLocaleDateString(language(), { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</h2>
      <div class="week">${weekdays.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal">${cells.join('')}</div></section>`
  }).join('')
}

function openDay(day) {
  $('#sheetdate').textContent = day === today() ? t('day.today') : longDate(day)
  $('#cards').innerHTML = TIERS.map((tier) => card(puzzle(day, tier))).join('')
  refreshIcons()
  $('#daysheet').hidden = false
}

// The next garden still to play: the rest of this day first, then today's, then the latest
// earlier day with one open.
function nextGarden() {
  const open = (day) => TIERS.map((tier) => ({ day, tier })).filter(({ day: d, tier }) => game.done[`${d}-${tier}`] === undefined)
  const current = game.puzzle
  if (current?.day) {
    const left = open(current.day).filter(({ tier }) => TIERS.indexOf(tier) > TIERS.indexOf(current.tier))
    if (left.length) return left[0]
  }
  for (let day = today(); day >= 1; day--) { const o = open(day); if (o.length) return o[0] }
  return null
}

for (const id of ['#todays', '#cards']) {
  $(id).addEventListener('click', (event) => {
    const button = event.target.closest('[data-tier]')
    if (!button) return
    audio.unlock()
    audio.play('select', { level: TIERS.indexOf(button.dataset.tier) * 2 })
    location.hash = `#/${button.dataset.day}/${button.dataset.tier}`
  })
}
$('#months').addEventListener('click', (event) => {
  const cell = event.target.closest('.cell[data-day]')
  if (cell) { audio.unlock(); audio.play('open'); openDay(Number(cell.dataset.day)) }
})
$('#open-days').addEventListener('click', () => { audio.unlock(); audio.play('tap'); location.hash = '#/days' })
$('#days-back').addEventListener('click', () => { audio.play('back'); location.hash = '#/daily' })
$('#home-back').addEventListener('click', () => { audio.play('back'); location.hash = '' })
$('#sheetclose').addEventListener('click', () => { audio.play('back'); $('#daysheet').hidden = true })
$('#daysheet').addEventListener('click', (event) => { if (event.target === $('#daysheet')) $('#daysheet').hidden = true })
// The title: Play opens today's gardens, How to play the tutorial garden.
$('#title-play').addEventListener('click', () => { audio.unlock(); audio.play('tap'); location.hash = '#/daily' })
$('#title-learn').addEventListener('click', () => { audio.unlock(); audio.play('tap'); tutorial.restart(); afterTutorial = '#/daily'; location.hash = '#/tutorial' })

/* ---------- moving between screens ---------- */

// #/<day>/<tier> plays a garden, #/daily is today's three, #/days the calendar, #/tutorial the
// tutorial garden, and anything else is the title. A phone's back gesture steps back through them.
let screen
let backTo = '#/daily'
// Where to go once the tutorial is done or skipped: the garden the player picked.
let afterTutorial = ''
function leaveTutorial() {
  tutorial.finish('basics')
  const to = afterTutorial || '#/daily'
  afterTutorial = ''
  // The tutorial steps out of the history, so Back doesn't return to it.
  history.replaceState(null, '', to)
  route()
}

function route() {
  const m = location.hash.match(/^#\/(\d+)\/(easy|medium|hard)$/)
  const day = m && Number(m[1])
  const playable = m && day >= 1 && day <= today()
  const learning = location.hash === '#/tutorial'
  // A first game starts with the tutorial garden, then goes on to the garden picked.
  if (playable && !tutorial.basicsDone) {
    afterTutorial = location.hash
    history.replaceState(null, '', '#/tutorial')
    return route()
  }
  const name = playable || learning ? 'play' : location.hash === '#/days' ? 'days' : location.hash === '#/daily' ? 'home' : 'title'
  const was = screen
  if (was === 'play') { endFinale(); scene?.showHover(null) }
  if (was && was !== name) audio.play('swoosh')
  screen = name
  appRoot.dataset.screen = name
  audio.setMood(name === 'play' ? 'play' : name === 'title' ? 'title' : 'map')
  for (const [id, on] of [['#titlepage', 'title'], ['#home', 'home'], ['#dayspage', 'days']]) $(id).inert = name !== on
  // The menus cover the whole garden, so the scene rests while they're open.
  if (scene) scene.paused = name !== 'play'
  if (name === 'play') {
    if (was !== 'play') backTo = was === 'days' ? '#/days' : was === 'title' ? '' : '#/daily'
    // The tutorial always starts afresh; a daily garden opens where it was left.
    if (learning && tutorial.basicsDone) tutorial.restart()
    game.start(learning ? TUTORIAL : puzzle(day, m[2]))
    scene?.resetPresentation()
    scene?.clearSelection()
    hintCell = null
    render()
    if (game.complete) startFinale('revisit')
    return
  }
  if (name === 'days') { $('#daysheet').hidden = true; drawDays() }
  else if (name === 'home') drawHome()
  else if (was !== 'title') {
    // The title plays its entrance again each time it's shown.
    $('#titlepage').classList.remove('enter')
    void $('#titlepage').offsetWidth
    $('#titlepage').classList.add('enter')
  }
}
addEventListener('hashchange', route)
// A new day may have begun while a menu sat open.
addEventListener('visibilitychange', () => { if (!document.hidden && (screen === 'home' || screen === 'days')) route() })
// Safari zooms on a pinch or a double tap even when the page asks it not to, so those gestures are
// stopped here; the garden's own pinch and drag go through the canvas's pointer events instead.
for (const type of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(type, (event) => event.preventDefault(), { passive: false })

// Every visit opens on the title, unless the address names a screen (?play goes straight into
// today's easy garden, for testing). After switching language, the game comes back where it was,
// with Settings open.
let reopen = null
try { reopen = sessionStorage.getItem(REOPEN); sessionStorage.removeItem(REOPEN) } catch { /* Fine without. */ }
if (new URLSearchParams(location.search).has('play')) {
  tutorial.finish('basics')
  history.replaceState(null, '', `#/${today()}/easy`)
}
game.start(TUTORIAL)
route()
if (reopen) openSettings()

// Read-only development diagnostics keep visual and canvas tests grounded in the rendered scene.
if (import.meta.env.DEV) {
  window.__tidal = {
    get snapshot() {
      return {
        id: game.id, grid: game.grid.map((row) => [...row]), filled: game.filled,
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
    show(hash) { location.hash = hash; route() },
    // Fills in the answer, leaving the last `leave` empty tiles, then places the last one the way a
    // player would (so the finale plays) unless some are left.
    solve(leave = 0) {
      const empty = game.puzzle.puzzle.flatMap((row, r) => row.map((v, c) => (v === null && game.grid[r][c] !== game.puzzle.solution[r][c] ? [r, c] : null))).filter(Boolean)
      const last = empty.pop()
      for (const [r, c] of empty.slice(0, Math.max(0, empty.length - leave))) game.grid[r][c] = game.puzzle.solution[r][c]
      if (last && !leave) { game.selected = game.puzzle.solution[last[0]][last[1]]; placeCell(...last) } else render()
    },
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
