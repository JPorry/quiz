import { LEVELS } from './levels.js'
import { buildBoard, blockedBy, status as boardStatus, findHint } from './logic.js'
import { WarrenScene } from './scene.js'
import { Sounds } from './sounds.js'
import './style.css'

const STORAGE_KEY = 'bunny-burrows.v1'
const params = new URLSearchParams(location.search)

const ICONS = {
  levels: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  hint: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  numbers: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
}
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`

/* ---------- saved progress ---------- */

function load() {
  try {
    return { completed: [], current: 0, boards: {}, numbers: false, sound: true, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return { completed: [], current: 0, boards: {}, numbers: false, sound: true }
  }
}
const saved = load()
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Private windows may refuse storage; the game still plays.
  }
}
const unlocked = (index) => params.has('unlock') || index === 0 || saved.completed.includes(LEVELS[index - 1]?.id) || saved.completed.includes(LEVELS[index].id)

/* ---------- page ---------- */

const app = document.querySelector('#app')
app.innerHTML = `
  <main class="game">
    <div class="stage" id="stage"></div>
    <div class="labels" id="labels" aria-hidden="true"></div>
    <header class="bar">
      <button class="round" id="to-levels" aria-label="All burrows">${icon('levels')}</button>
      <div class="pill">
        <span class="pill-number" id="level-number">1</span>
        <span class="pill-text">
          <strong id="level-name">Clover Hollow</strong>
          <small id="level-progress">0 of 4 burrows fed</small>
        </span>
      </div>
      <button class="round" id="sound" aria-label="Sound">${icon('sound')}</button>
      <button class="round" id="help" aria-label="How to play">${icon('help')}</button>
    </header>
    <p class="status" id="status" aria-live="polite"></p>
    <footer class="dock">
      <button class="chip" id="undo">${icon('undo')}<span>Undo</span></button>
      <button class="chip" id="hint">${icon('hint')}<span>Hint</span></button>
      <button class="chip" id="numbers" aria-pressed="false">${icon('numbers')}<span>Numbers</span></button>
      <button class="chip" id="restart">${icon('restart')}<span>Restart</span></button>
    </footer>

    <section class="screen title-screen" id="title-screen">
      <div class="title-card">
        <p class="eyebrow">A cozy warren puzzle</p>
        <h1><span>Bunny</span> <span>Burrows</span></h1>
        <p class="lede">Lay little paths between the burrows so Grandma's carrots reach the whole family.</p>
        <button class="primary" id="play">Play <span id="play-level"></span></button>
        <button class="secondary" id="title-levels">All burrows</button>
      </div>
    </section>

    <section class="screen levels-screen" id="levels-screen" hidden>
      <div class="sheet">
        <header>
          <h2>The Meadow</h2>
          <p id="levels-count"></p>
          <button class="round" id="close-levels" aria-label="Close">${icon('close')}</button>
        </header>
        <ol class="level-grid" id="level-grid"></ol>
      </div>
    </section>

    <section class="screen help-screen" id="help-screen" hidden>
      <div class="sheet help">
        <header>
          <h2>How to play</h2>
          <button class="round" id="close-help" aria-label="Close">${icon('close')}</button>
        </header>
        <ul class="rules">
          <li><b class="rule-art basket"></b><span><strong>Each burrow has baskets.</strong> Lay exactly one path per basket. Drag from a burrow toward a neighbour, or tap two burrows.</span></li>
          <li><b class="rule-art double"></b><span><strong>One or two paths</strong> can join two burrows. Tap a path to double it, tap again to take it away.</span></li>
          <li><b class="rule-art cross"></b><span><strong>Paths run straight</strong> to the nearest burrow, and can't cross each other.</span></li>
          <li><b class="rule-art grandma"></b><span><strong>Grandma's carrots</strong> travel along the paths. Every burrow must be joined to Grandma, so the whole family is fed.</span></li>
        </ul>
        <p class="help-foot">Baskets on a mound's top are still waiting for a path. Full baskets mean the carrots have arrived.</p>
        <button class="primary" id="help-ok">Got it</button>
      </div>
    </section>

    <section class="finale" id="finale" hidden>
      <p class="eyebrow">Burrow <b id="finale-number">1</b> · <em id="finale-name"></em></p>
      <h2>Everyone's fed!</h2>
      <p class="finale-meta" id="finale-meta"></p>
      <div class="finale-actions">
        <button class="secondary" id="finale-stay">Stay a while</button>
        <button class="primary" id="finale-next">Next burrow ${icon('arrow')}</button>
      </div>
    </section>
  </main>
`
const $ = (id) => document.getElementById(id)

/* ---------- game ---------- */

const sounds = new Sounds()
sounds.enabled = saved.sound
let levelIndex = Math.min(saved.current ?? 0, LEVELS.length - 1)
let board
let counts
let history = []
let selected = null
let hint = null
let startedAt = 0
let solved = false
let lastClosed = ''

const scene = new WarrenScene($('stage'), {
  onTapBurrow: tapBurrow,
  onDragEdge: (edge) => {
    select(null)
    cycle(edge)
  },
  onTapEdge: (edge) => {
    select(null)
    cycle(edge)
  },
  onTapEmpty: () => select(null),
  safeArea: () => {
    const bar = document.querySelector('.bar').getBoundingClientRect()
    const dock = document.querySelector('.dock').getBoundingClientRect()
    const status = $('status').getBoundingClientRect()
    const height = window.innerHeight
    // On the title, the meadow sits above the title card.
    if (!$('title-screen').hidden) {
      const card = document.querySelector('.title-card').getBoundingClientRect()
      return { top: 24, bottom: height - card.top + 12, left: 16, right: 16 }
    }
    return { top: bar.bottom + 8, bottom: height - Math.min(dock.top, status.top) + 8, left: 12, right: 12 }
  },
})

function startLevel(index, { fresh = false } = {}) {
  levelIndex = index
  saved.current = index
  save()
  const level = LEVELS[index]
  board = buildBoard(level)
  const stored = saved.boards[level.id]
  counts = !fresh && stored?.counts?.length === board.edges.length ? stored.counts.slice() : board.edges.map(() => 0)
  history = !fresh && stored?.history ? stored.history.slice() : []
  startedAt = Date.now() - (!fresh && stored?.elapsed ? stored.elapsed : 0)
  selected = null
  hint = null
  solved = saved.completed.includes(level.id) && boardStatus(board, counts).complete
  scene.load(board)
  scene.sync(counts, boardStatus(board, counts), { initial: true })
  $('level-number').textContent = index + 1
  $('level-name').textContent = level.name
  $('finale').hidden = true
  document.body.classList.remove('celebrating')
  refresh()
  if (index === 0 && !counts.some(Boolean)) say('Drag from a burrow toward a neighbour to lay a path. Every basket needs one path.')
  else if (!counts.some(Boolean)) say(`Grandma lives in the burrow with the chimney. Join everyone to her.`)
}

function persist() {
  saved.boards[LEVELS[levelIndex].id] = { counts, history: history.slice(-200), elapsed: Date.now() - startedAt }
  save()
}

function say(text) {
  $('status').textContent = text
}

function refresh() {
  const status = boardStatus(board, counts)
  const fedCount = [...status.fed.keys()].filter((i) => status.degree[i] === board.burrows[i].value).length
  $('level-progress').textContent = `${fedCount} of ${board.burrows.length} burrows happy`
  $('undo').disabled = history.length === 0
  return status
}

function apply(edge, next) {
  const before = counts[edge]
  if (next === before) return
  if (before === 0 && next > 0) {
    const blocker = blockedBy(board, counts, edge)
    if (blocker !== undefined) {
      scene.blocked(edge, blocker)
      sounds.play('bonk')
      say("Paths can't cross. Take the other path away first.")
      return
    }
  }
  history.push([edge, before])
  counts[edge] = next
  afterChange(edge, next > before ? 'add' : 'remove')
}

function cycle(edge) {
  if (solved) return
  hint = null
  scene.showHint(null)
  const next = (counts[edge] + 1) % 3
  // A path that would cross another skips straight past.
  apply(edge, next)
}

function afterChange(edge, kind) {
  const status = boardStatus(board, counts)
  scene.sync(counts, status, { changed: edge })
  refresh()
  persist()
  sounds.play(kind === 'add' ? (counts[edge] === 2 ? 'double' : 'place') : 'remove')

  const e = board.edges[edge]
  const overHere = [e.a, e.b].find((i) => status.degree[i] > board.burrows[i].value)
  const closedKey = status.closed.map((g) => g.join(',')).join('|')
  if (status.complete) return finish()
  if (overHere !== undefined) {
    say('That burrow has more paths than baskets, and carrots are spilling out.')
    sounds.play('oops')
  } else if (status.closed.length && closedKey !== lastClosed) {
    say("Those burrows are closed off from Grandma, so her carrots can't reach them.")
    sounds.play('oops')
  } else if (status.fed.size === board.burrows.length) {
    say('Everyone can reach Grandma! Now fill every basket.')
  } else {
    const waiting = board.burrows.length - status.fed.size
    say(waiting === 1 ? 'One burrow is still waiting for carrots.' : `${waiting} burrows are still waiting for carrots.`)
  }
  lastClosed = closedKey
  if (kind === 'add' && status.fed.has(e.a) && status.fed.has(e.b)) sounds.play('carrots', 0.25)
}

function finish() {
  solved = true
  select(null)
  const level = LEVELS[levelIndex]
  if (!saved.completed.includes(level.id)) saved.completed.push(level.id)
  save()
  say('Everyone is fed. Hooray!')
  sounds.play('win')
  scene.celebrate()
  document.body.classList.add('celebrating')
  const seconds = Math.round((Date.now() - startedAt) / 1000)
  $('finale-number').textContent = levelIndex + 1
  $('finale-name').textContent = level.name
  $('finale-meta').textContent = `${board.burrows.length} burrows fed in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · ${saved.completed.length} of ${LEVELS.length} done`
  $('finale-next').hidden = levelIndex >= LEVELS.length - 1
  setTimeout(() => {
    if (solved) $('finale').hidden = false
  }, 2600)
}

function tapBurrow(index) {
  if (solved) return
  if (selected === null) return select(index)
  if (selected === index) return select(null)
  const dir = Object.keys(board.neighbors[selected]).find((d) => {
    const e = board.edges[board.neighbors[selected][d]]
    return e.a === index || e.b === index
  })
  if (dir) {
    const edge = board.neighbors[selected][dir]
    select(null)
    cycle(edge)
  } else select(index)
}

function select(index) {
  selected = index
  const candidates = index === null ? [] : Object.values(board.neighbors[index]).map((e) => (board.edges[e].a === index ? board.edges[e].b : board.edges[e].a))
  scene.select(index, candidates)
  if (index !== null) sounds.play('tap')
}

function undo() {
  if (!history.length || solved) return
  const [edge, before] = history.pop()
  counts[edge] = before
  hint = null
  scene.showHint(null)
  const status = boardStatus(board, counts)
  scene.sync(counts, status, { changed: edge })
  refresh()
  persist()
  sounds.play('undo')
  say('Undone.')
}

function restart() {
  if (!counts.some(Boolean)) return
  if ($('restart').dataset.confirm !== '1') {
    $('restart').dataset.confirm = '1'
    $('restart').querySelector('span').textContent = 'Sure?'
    setTimeout(() => {
      $('restart').dataset.confirm = ''
      $('restart').querySelector('span').textContent = 'Restart'
    }, 2500)
    return
  }
  $('restart').dataset.confirm = ''
  $('restart').querySelector('span').textContent = 'Restart'
  sounds.play('remove')
  startLevel(levelIndex, { fresh: true })
  persist()
}

function showHint() {
  if (solved) return
  const level = LEVELS[levelIndex]
  hint = findHint(board, counts, level.solution)
  if (!hint) return
  scene.showHint(hint.edge)
  sounds.play('hint')
  say(hint.text)
}

/* ---------- number badges (optional) ---------- */

function drawLabels() {
  const layer = $('labels')
  if (!saved.numbers || !board || !document.body.classList.contains('playing')) {
    layer.innerHTML = ''
  } else {
    const status = boardStatus(board, counts)
    if (layer.children.length !== board.burrows.length) {
      layer.innerHTML = board.burrows.map(() => '<span class="badge"></span>').join('')
    }
    board.burrows.forEach((b, i) => {
      const el = layer.children[i]
      const p = scene.project(i, 0.62)
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`
      el.textContent = b.value
      el.classList.toggle('done', status.degree[i] === b.value)
      el.classList.toggle('over', status.degree[i] > b.value)
    })
  }
  requestAnimationFrame(drawLabels)
}
requestAnimationFrame(drawLabels)

/* ---------- screens ---------- */

function showScreen(name) {
  $('title-screen').hidden = name !== 'title'
  $('levels-screen').hidden = name !== 'levels'
  $('help-screen').hidden = name !== 'help'
  document.body.classList.toggle('playing', name === 'game' || name === 'help')
  requestAnimationFrame(() => scene.resize())
}

function renderLevels() {
  $('levels-count').textContent = `${saved.completed.length} of ${LEVELS.length} burrows fed`
  $('level-grid').innerHTML = LEVELS.map((level, i) => {
    const done = saved.completed.includes(level.id)
    const open = unlocked(i)
    return `<li><button class="level ${done ? 'done' : ''} ${i === levelIndex ? 'current' : ''}" data-index="${i}" ${open ? '' : 'disabled'}>
      <span class="level-number">${i + 1}</span>
      <span class="level-name">${level.name}</span>
      <span class="level-state">${done ? icon('check') : open ? `${level.burrows.length} burrows` : icon('lock')}</span>
    </button></li>`
  }).join('')
}

$('play').addEventListener('click', () => {
  sounds.unlock()
  sounds.play('start')
  showScreen('game')
})
$('title-levels').addEventListener('click', () => {
  sounds.unlock()
  renderLevels()
  showScreen('levels')
})
$('to-levels').addEventListener('click', () => {
  renderLevels()
  sounds.play('tap')
  showScreen('levels')
})
$('close-levels').addEventListener('click', () => showScreen('game'))
$('level-grid').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-index]')
  if (!button) return
  sounds.play('start')
  startLevel(Number(button.dataset.index))
  showScreen('game')
})
$('help').addEventListener('click', () => showScreen('help'))
$('close-help').addEventListener('click', () => showScreen('game'))
$('help-ok').addEventListener('click', () => showScreen('game'))
$('undo').addEventListener('click', undo)
$('hint').addEventListener('click', showHint)
$('restart').addEventListener('click', restart)
$('numbers').addEventListener('click', () => {
  saved.numbers = !saved.numbers
  $('numbers').setAttribute('aria-pressed', String(saved.numbers))
  save()
})
$('numbers').setAttribute('aria-pressed', String(saved.numbers))
function syncSoundButton() {
  $('sound').innerHTML = icon(sounds.enabled ? 'sound' : 'mute')
  $('sound').setAttribute('aria-pressed', String(!sounds.enabled))
}
$('sound').addEventListener('click', () => {
  sounds.unlock()
  sounds.enabled = !sounds.enabled
  saved.sound = sounds.enabled
  save()
  syncSoundButton()
  sounds.play('tap')
})
syncSoundButton()
$('finale-next').addEventListener('click', () => {
  sounds.play('start')
  startLevel(Math.min(levelIndex + 1, LEVELS.length - 1))
})
$('finale-stay').addEventListener('click', () => {
  $('finale').hidden = true
  document.body.classList.remove('celebrating')
})
addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') undo()
  if (event.key === 'Escape') select(null)
})
document.addEventListener('pointerdown', () => sounds.unlock(), { once: true })

startLevel(levelIndex)
$('play-level').textContent = `· Burrow ${levelIndex + 1}`
if (params.has('play')) showScreen('game')
else showScreen('title')

// Hooks for the visual tests.
window.__burrows = {
  scene, startLevel, cycle, showHint, undo,
  get board() { return board },
  get counts() { return counts },
  // step every animation forward without waiting on the frame rate
  advance(seconds) {
    for (let t = 0; t < seconds; t += 1 / 30) scene.update(1 / 30)
  },
}
