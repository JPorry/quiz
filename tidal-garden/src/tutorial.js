// The guided gardens. A small coach walks a new player through the tutorial garden one rule at a
// time, each shown on a real tile of their own board: never three in a row, mind the gap, and five
// and five. The first daily garden with a new kind of clue (villages, lighthouses, ferries or
// pilgrims) gets a shorter guide of its own, showing that clue deciding a tile. The coach points at
// the piece to pick and makes the right tile glow, with soft rings on what decides it, then hands
// over with where the hint lives.
import { t, terrain, pieceName } from './i18n.js'
import { easiestDeductions, VILLAGE_TECHNIQUES, LIGHT_TECHNIQUES, FERRY_TECHNIQUES, PILGRIM_TECHNIQUES } from './solver.js'

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

// What the coach says for each rule, about a particular tile, in the player's language.
const kinds = (m) => ({ kind: terrain(m.value), other: terrain(1 - m.value), axis: t(`axis.${m.axis}`) })
const LESSONS = {
  pair: (m) => ({ title: t('coach.pair'), text: t('coach.pairText', kinds(m)) }),
  gap: (m) => ({ title: t('coach.gap'), text: t('coach.gapText', kinds(m)) }),
  count: (m) => ({ title: t('coach.count'), text: t('coach.countText', kinds(m)) }),
}
const BASICS = ['pair', 'gap', 'count']

// Each later chapter's guide: the clues it reads. How the coach introduces them and hands over is
// in the dictionary, under the guide's name. The guide's lesson is any move its clues decide, so it
// always shows the new idea at work.
export const GUIDES = {
  villages: { techniques: VILLAGE_TECHNIQUES },
  lighthouses: { techniques: LIGHT_TECHNIQUES },
  ferries: { techniques: FERRY_TECHNIQUES },
  pilgrims: { techniques: PILGRIM_TECHNIQUES },
}

// Which guide a garden would show: the basics in the tutorial garden, and in a daily garden the
// first of its kinds of clue the player hasn't been shown yet.
export function guideFor(puzzle, finished = new Set()) {
  if (puzzle.id === 'tutorial') return 'basics'
  return (puzzle.kinds ?? []).find((kind) => GUIDES[kind] && !finished.has(kind)) ?? null
}

// What the coach says about each clue deciding a tile.
const clueLesson = (technique) => ({ title: t(`lesson.${technique}`), text: t(`lesson.${technique}Text`) })

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
    // A garden keeps the guide it opened with, so finishing one never starts another mid-garden.
    this.chosen = {}
  }

  // Whether the basics (the tutorial garden) have been played or skipped.
  get basicsDone() { return this.finished.has('basics') }

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
    this.chosen = {}
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
  card(puzzle, grid, selected, complete) {
    if (!(puzzle.id in this.chosen)) this.chosen[puzzle.id] = guideFor(puzzle, this.finished)
    const id = this.chosen[puzzle.id]
    this.current = id
    if (!id || this.finished.has(id)) return null
    // Finishing a garden mid-guide ends the guide; opening one already finished leaves it waiting.
    if (complete) { if (this.states[id] && this.states[id].step !== 'welcome') this.finish(id); return null }
    const guide = GUIDES[id]
    const steps = id === 'basics' ? BASICS : ['lesson']
    const state = this.state(id)
    if (state.step === 'welcome') {
      return id === 'basics'
        ? { step: 'welcome', title: t('coach.welcome'), text: t('coach.welcomeText'), action: t('coach.begin') }
        : { step: 'welcome', title: t(`guide.${id}`), text: t(`guide.${id}Text`), action: t('coach.showMe') }
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
        ? { step: 'outro', title: t('coach.lastRule'), text: t('coach.lastRuleText'), action: t('coach.gotIt') }
        : { step: 'outro', title: t(`guide.${id}Outro`), text: `${t(`guide.${id}OutroText`)} ${t('coach.stuck')}`, action: t('coach.gotIt') }
    }
    const m = state.lesson
    // When the board doesn't show the idea yet, the player keeps going until it does.
    if (!m && id === 'basics') return { step: 'practice', title: t('coach.keepGoing'), text: t('coach.keepGoingText') }
    // A chapter's clues may need a few familiar moves first: the coach rings them on the board and
    // the player plays on until one decides a tile.
    if (!m) return { step: 'practice', title: t('coach.keepGoing'), text: t('coach.watchText', { clues: t(`guide.${id}Clues`) }), because: guideClues(guide.techniques, puzzle) }
    const lesson = id === 'basics' ? LESSONS[state.step](m) : clueLesson(m.technique)
    return { step: state.step, ...lesson, ...this.pointAt(m, grid, selected) }
  }

  // The coach's pointing: which piece to pick, the glowing tile, and what decides it.
  pointAt(m, grid, selected) {
    const placedWrong = grid[m.row][m.col] !== null && grid[m.row][m.col] !== m.value
    const instruction = placedWrong ? t('coach.wrong') : selected !== m.value ? t('coach.pick', { piece: pieceName(m.value) }) : t('coach.tap')
    return { instruction, target: { row: m.row, col: m.col }, pick: selected !== m.value && !placedWrong ? m.value : null, because: m.because }
  }
}
