// The guided gardens. A small coach walks a new player through the first garden one rule at a
// time, each shown on a real tile of their own board: never three in a row, mind the gap, and five
// and five. The first garden of each later chapter gets a shorter guide of its own, showing its new
// clue deciding a tile. The coach points at the piece to pick and makes the right tile glow, with
// soft rings on what decides it, then hands over with where the hint lives.
import { CHAPTERS } from './game.js'
import { easiestDeductions, VILLAGE_TECHNIQUES, LIGHT_TECHNIQUES, FERRY_TECHNIQUES, PILGRIM_TECHNIQUES } from './solver.js'

export const TUTORIAL_LEVEL = 0
const STORAGE_KEY = 'tidal-garden.guides'
const OLD_KEY = 'tidal-garden.tutorial'

const lines = (grid) => [
  ...grid.map((values, row) => ({ axis: 'row', cells: values.map((_, col) => [row, col]) })),
  ...grid[0].map((_, col) => ({ axis: 'column', cells: grid.map((_, row) => [row, col]) })),
]

// A tile on the board that a rule decides, with the tiles that decide it. Every move here is
// forced, so it always matches the garden's solution. Of all the candidates, the coach picks the
// one nearest the front and middle of the board, where it's easiest to see and tap.
export function findLesson(grid, rule) {
  return nearest(findLessons(grid, rule), grid.length)
}

function findLessons(grid, rule) {
  const found = []
  for (const { axis, cells } of lines(grid)) found.push(...lessonsIn(grid, rule, axis, cells))
  return found
}

const nearest = (moves, size = 10) => {
  const nearness = ({ row, col }) => row * 10 - Math.abs(col - (size - 1) / 2)
  return [...moves].sort((a, b) => nearness(b) - nearness(a))[0] ?? null
}
const distance = ([r1, c1], [r2, c2]) => Math.abs(r1 - r2) + Math.abs(c1 - c2)

function lessonsIn(grid, rule, axis, cells) {
  const found = []
  const at = (i) => (i >= 0 && i < cells.length ? grid[cells[i][0]][cells[i][1]] : undefined)
  const move = (i, value, because) => ({ row: cells[i][0], col: cells[i][1], value, axis, because: because.map((j) => cells[j]) })
  if (rule === 'pair') {
    for (let i = 0; i < cells.length - 1; i++) {
      const v = at(i)
      if (v === null || v !== at(i + 1)) continue
      if (at(i - 1) === null) found.push(move(i - 1, 1 - v, [i, i + 1]))
      if (at(i + 2) === null) found.push(move(i + 2, 1 - v, [i, i + 1]))
    }
  }
  if (rule === 'gap') {
    for (let i = 0; i < cells.length - 2; i++) {
      const v = at(i)
      if (v !== null && at(i + 1) === null && at(i + 2) === v) found.push(move(i + 1, 1 - v, [i, i + 2]))
    }
  }
  if (rule === 'count') {
    for (const v of [0, 1]) {
      const full = cells.map((_, i) => i).filter((i) => at(i) === v)
      if (full.length !== cells.length / 2) continue
      cells.forEach((_, i) => { if (at(i) === null) found.push(move(i, 1 - v, full)) })
    }
  }
  return found
}

const name = (value) => (value === 0 ? 'water' : 'land')
const Name = (value) => (value === 0 ? 'Water' : 'Land')

// What the coach says for each rule, about a particular tile.
const LESSONS = {
  pair: (m) => ({ title: 'Never three in a row', text: `Two ${name(1 - m.value)} tiles sit side by side, so the tile next to them must be ${name(m.value)}.` }),
  gap: (m) => ({ title: 'Mind the gap', text: `A tile between two ${name(1 - m.value)} tiles must be ${name(m.value)}, or there would be three in a row.` }),
  count: (m) => ({ title: 'Five and five', text: `Every row and column holds five water and five land. This ${m.axis} already has five ${name(1 - m.value)}, so the rest is ${name(m.value)}.` }),
}
const BASICS = ['pair', 'gap', 'count']

// Each later chapter's guide: the clues it reads, how the coach introduces them, and how it hands
// over. The guide's lesson is any move its clues decide, so it always shows the new idea at work.
export const GUIDES = {
  villages: {
    clues: 'signs',
    techniques: VILLAGE_TECHNIQUES,
    intro: { title: 'Villages', text: 'A wooden sign counts the land tiles of its island. Each tile you join to it raises a hut, and the village comes alive when its island is closed in by water at exactly its number.' },
    outro: { title: 'Grow every village', text: 'Every sign must end on an island of exactly its number. Stuck? Tap Hint and a tile will glow, with the reason why.' },
  },
  lighthouses: {
    clues: 'lighthouses',
    techniques: LIGHT_TECHNIQUES,
    intro: { title: 'Lighthouses', text: 'A lighthouse counts the water its light reaches up, down, left and right, before land or the edge stops it. Glowing dots show what it already sees.' },
    outro: { title: 'Light every lighthouse', text: 'Every lighthouse must see exactly its number. Stuck? Tap Hint and a tile will glow, with the reason why.' },
  },
  ferries: {
    clues: 'docks',
    techniques: FERRY_TECHNIQUES,
    intro: { title: 'Ferries', text: 'Docks with matching roofs must be joined by water, moving up, down, left and right, so their little ferry can sail from one to the other.' },
    outro: { title: 'Join every pair of docks', text: 'Every ferry needs a channel of water to its twin. Stuck? Tap Hint and a tile will glow, with the reason why.' },
  },
  pilgrims: {
    clues: 'shrines',
    techniques: PILGRIM_TECHNIQUES,
    intro: { title: 'Pilgrims', text: 'Shrines with matching lanterns must stand on the same island, joined by land up, down, left and right, so their pilgrim can walk from one to the other.' },
    outro: { title: 'Join every pair of shrines', text: 'Every pilgrim needs a trail of land to its twin. Stuck? Tap Hint and a tile will glow, with the reason why.' },
  },
  crossings: {
    clues: 'docks and shrines',
    techniques: [...FERRY_TECHNIQUES, ...PILGRIM_TECHNIQUES],
    intro: { title: 'Crossings', text: 'Ferries and pilgrims now share each garden. Docks need water between them and shrines need land, so their paths have to cross with care.' },
    outro: { title: 'Every path at once', text: 'Every ferry and every pilgrim must reach its twin. Stuck? Tap Hint and a tile will glow, with the reason why.' },
  },
  archipelago: {
    clues: 'clues',
    techniques: [...VILLAGE_TECHNIQUES, ...LIGHT_TECHNIQUES, ...FERRY_TECHNIQUES, ...PILGRIM_TECHNIQUES],
    intro: { title: 'The Archipelago', text: 'Villages, lighthouses, ferries and pilgrims, all in one garden. Every clue still holds, and they lean on each other.' },
    outro: { title: 'All together', text: 'Every clue must hold at the end. Stuck? Tap Hint and a tile will glow, with the reason why.' },
  },
}
const CHAPTER_GUIDES = ['villages', 'lighthouses', 'ferries', 'pilgrims', 'crossings', 'archipelago']

// Which guide belongs to a garden: the basics in the first, and a chapter's own in its first garden.
export function guideFor(level) {
  if (level === TUTORIAL_LEVEL) return 'basics'
  const index = CHAPTERS.findIndex((chapter) => chapter.start === level)
  return index > 0 ? CHAPTER_GUIDES[index - 1] ?? null : null
}

// What the coach says about each clue deciding a tile.
const CLUE_LESSONS = {
  seal: { title: 'Closing a village', text: () => 'This village already has as many tiles as its sign, so it\u2019s closed in by water here.' },
  grow: { title: 'Growing a village', text: () => 'This village is still short of its number, and this is its only way to grow, so it must be land.' },
  apart: { title: 'Keeping villages apart', text: () => 'Land here would join islands into a village bigger than its sign, so it must be water.' },
  block: { title: 'Stopping the light', text: () => 'This lighthouse already sees its number, so land must stop its light here.' },
  shine: { title: 'Letting the light through', text: () => 'This lighthouse can only reach its number if its light passes here, so it must be water.' },
  channel: { title: 'Opening a channel', text: () => 'Every way left between these two docks passes here, so their ferry needs this tile to be water.' },
  trail: { title: 'Laying a trail', text: () => 'Every way left between these two shrines passes here, so their pilgrim needs this tile to be land.' },
}

// The clue tiles behind a move: the nearest sign or lighthouse, or both ends of the nearest ferry
// or pilgrim route.
function cluesBehind(move, { signs = [], lights = [], ferries = [], pilgrims = [] }) {
  const at = [move.row, move.col]
  const closest = (cells) => [...cells].sort((a, b) => distance(a, at) - distance(b, at))[0]
  const closestPair = (pairs) => [...pairs].sort((a, b) => Math.min(...a.map((c) => distance(c, at))) - Math.min(...b.map((c) => distance(c, at))))[0] ?? []
  if (['seal', 'grow', 'apart'].includes(move.technique)) return [closest(signs.map((sign) => sign.cell))].filter(Boolean)
  if (['block', 'shine'].includes(move.technique)) {
    const inLine = lights.filter(({ cell }) => cell[0] === move.row || cell[1] === move.col)
    return [closest((inLine.length ? inLine : lights).map((light) => light.cell))].filter(Boolean)
  }
  if (move.technique === 'channel') return closestPair(ferries.map((ferry) => ferry.docks))
  if (move.technique === 'trail') return closestPair(pilgrims.map((pilgrim) => pilgrim.shrines))
  return []
}

const SIMPLEST = ['seal', 'grow', 'block', 'shine', 'channel', 'trail', 'apart']

// A tile one of the guide's clues decides right now, matching the garden's solution, nearest the
// front of the board.
export function findClueLesson(grid, puzzle, techniques) {
  const context = { signs: puzzle.signs ?? [], lights: puzzle.lights ?? [], ferries: puzzle.ferries ?? [], pilgrims: puzzle.pilgrims ?? [] }
  // The simplest idea first: closing or growing a village before keeping villages apart.
  let move = null
  for (const technique of SIMPLEST.filter((t) => techniques.includes(t))) {
    const next = easiestDeductions(grid, [technique], context)
    const found = next?.deductions.filter((m) => !puzzle.solution || puzzle.solution[m.row][m.col] === m.value).map((m) => ({ ...m, technique })) ?? []
    if ((move = nearest(found, grid.length))) break
  }
  return move && { row: move.row, col: move.col, value: move.value, technique: move.technique, because: cluesBehind(move, context) }
}

// Every clue a guide is about, to keep in view while the player works towards it.
function guideClues(techniques, { signs = [], lights = [], ferries = [], pilgrims = [] }) {
  return [
    ...(techniques.includes('seal') ? signs.map((sign) => sign.cell) : []),
    ...(techniques.includes('shine') ? lights.map((light) => light.cell) : []),
    ...(techniques.includes('channel') ? ferries.flatMap((ferry) => ferry.docks) : []),
    ...(techniques.includes('trail') ? pilgrims.flatMap((pilgrim) => pilgrim.shrines) : []),
  ]
}

export class Tutorial {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage
    this.finished = new Set()
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]')
      if (Array.isArray(saved)) saved.forEach((id) => this.finished.add(id))
      if (storage?.getItem(OLD_KEY) === 'done') this.finished.add('basics')
    } catch { /* Shown again, which is harmless. */ }
    this.states = {}
    this.current = null
  }

  save() {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify([...this.finished])) } catch { /* Fine without. */ }
  }

  state(id) { return (this.states[id] ??= { step: 'welcome', lesson: null }) }
  get step() { return this.current ? this.state(this.current).step : 'done' }
  get lesson() { return this.current ? this.state(this.current).lesson : null }
  isFinished(id) { return this.finished.has(id) }

  finish(id = this.current) {
    if (!id) return
    this.finished.add(id)
    delete this.states[id]
    this.save()
  }

  // Every guide shows again, from its welcome.
  restart() {
    this.finished.clear()
    this.states = {}
    try { this.storage?.removeItem(OLD_KEY) } catch { /* Fine without. */ }
    this.save()
  }

  // Moves the coach along after a welcome or a last word.
  next(id = this.current) {
    if (!id) return
    const state = this.state(id)
    if (state.step === 'welcome') state.step = id === 'basics' ? BASICS[0] : 'lesson'
    else if (state.step === 'outro') this.finish(id)
  }

  // What the coach shows right now for this garden, board and selected piece, or null when it has
  // nothing to say. Moves past lessons whose tile is in place.
  card(level, grid, selected, complete, puzzle = {}) {
    const id = guideFor(level)
    this.current = id
    if (!id || this.finished.has(id)) return null
    if (complete) { this.finish(id); return null }
    const guide = GUIDES[id]
    const steps = id === 'basics' ? BASICS : ['lesson']
    const state = this.state(id)
    if (state.step === 'welcome') {
      return id === 'basics'
        ? { step: 'welcome', title: 'Welcome to your first garden', text: 'Every tile becomes water or land, in balance. Let\u2019s place a few together.', action: 'Let\u2019s begin' }
        : { step: 'welcome', ...guide.intro, action: 'Show me' }
    }
    // A lesson ends once its tile holds the right terrain.
    while (steps.includes(state.step)) {
      if (state.lesson && grid[state.lesson.row][state.lesson.col] === state.lesson.value) {
        state.lesson = null
        state.step = steps[steps.indexOf(state.step) + 1] ?? 'outro'
        continue
      }
      if (!state.lesson) state.lesson = id === 'basics' ? findLesson(grid, state.step) : findClueLesson(grid, puzzle, guide.techniques)
      break
    }
    if (state.step === 'outro') {
      return id === 'basics'
        ? { step: 'outro', title: 'One last rule', text: 'No two finished rows, or two finished columns, may match. Stuck? Tap Hint and a tile will glow, with the reason why.', action: 'Got it' }
        : { step: 'outro', ...guide.outro, action: 'Got it' }
    }
    const m = state.lesson
    // When the board doesn't show the idea yet, the player keeps going until it does.
    if (!m && id === 'basics') return { step: 'practice', title: 'Keep going', text: 'Fill more tiles with what you\u2019ve learned. There\u2019s one more rule to show you soon.' }
    // A chapter's clues may need a few familiar moves first: the coach rings them on the board and
    // the player plays on until one decides a tile.
    if (!m) return { step: 'practice', title: 'Keep going', text: `Fill tiles the usual way, and keep an eye on the ringed ${guide.clues}. As soon as one decides a tile, it will glow here.`, because: guideClues(guide.techniques, puzzle) }
    const lesson = id === 'basics' ? LESSONS[state.step](m) : { title: CLUE_LESSONS[m.technique].title, text: CLUE_LESSONS[m.technique].text(m) }
    return { step: state.step, ...lesson, ...this.pointAt(m, grid, selected) }
  }

  // The coach's pointing: which piece to pick, the glowing tile, and what decides it.
  pointAt(m, grid, selected) {
    const placedWrong = grid[m.row][m.col] !== null && grid[m.row][m.col] !== m.value
    const instruction = placedWrong ? 'Not quite. Tap Undo and try again.' : selected !== m.value ? `Pick ${Name(m.value)} below.` : 'Now tap the glowing tile.'
    return { instruction, target: { row: m.row, col: m.col }, pick: selected !== m.value && !placedWrong ? m.value : null, because: m.because }
  }
}
