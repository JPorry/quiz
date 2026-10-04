// The guided first garden. A small coach walks a new player through the first garden one rule at a
// time, each shown on a real tile of their own board: never three in a row, mind the gap, and five
// and five. It points at the piece to pick and makes the right tile glow, then hands over with the
// last rule and where the hint lives.

export const TUTORIAL_LEVEL = 0
const STORAGE_KEY = 'tidal-garden.tutorial'

const lines = (grid) => [
  ...grid.map((values, row) => ({ axis: 'row', cells: values.map((_, col) => [row, col]) })),
  ...grid[0].map((_, col) => ({ axis: 'column', cells: grid.map((_, row) => [row, col]) })),
]

// A tile on the board that a rule decides, with the tiles that decide it. Every move here is
// forced, so it always matches the garden's solution. Of all the candidates, the coach picks the
// one nearest the front and middle of the board, where it's easiest to see and tap.
export function findLesson(grid, rule) {
  const found = []
  for (const { axis, cells } of lines(grid)) found.push(...lessonsIn(grid, rule, axis, cells))
  const nearness = ({ row, col }) => row * 10 - Math.abs(col - (grid.length - 1) / 2)
  return found.sort((a, b) => nearness(b) - nearness(a))[0] ?? null
}

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
const ORDER = ['pair', 'gap', 'count']

export class Tutorial {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage
    let done = false
    try { done = storage?.getItem(STORAGE_KEY) === 'done' } catch { /* Shown again, which is harmless. */ }
    this.step = done ? 'done' : 'welcome'
    this.lesson = null
  }

  get active() { return this.step !== 'done' }

  finish() {
    this.step = 'done'
    this.lesson = null
    try { this.storage?.setItem(STORAGE_KEY, 'done') } catch { /* Fine without. */ }
  }

  restart() {
    this.step = 'welcome'
    this.lesson = null
    try { this.storage?.removeItem(STORAGE_KEY) } catch { /* Fine without. */ }
  }

  // Moves the coach along after the welcome or the last rule.
  next() {
    if (this.step === 'welcome') this.step = 'pair'
    else if (this.step === 'outro') this.finish()
  }

  // What the coach shows right now for this board and selected piece, or null when it has nothing
  // to say (another garden, or the tutorial is over). Advances past rules whose tile is in place.
  card(level, grid, selected, complete) {
    if (!this.active || level !== TUTORIAL_LEVEL) return null
    if (complete) { this.finish(); return null }
    if (this.step === 'welcome') {
      return { step: 'welcome', title: 'Welcome to your first garden', text: 'Every tile becomes water or land, in balance. Let’s place a few together.', action: 'Let’s begin' }
    }
    // A rule's lesson ends once its tile holds the right terrain.
    while (ORDER.includes(this.step)) {
      if (this.lesson && grid[this.lesson.row][this.lesson.col] === this.lesson.value) {
        this.lesson = null
        this.step = ORDER[ORDER.indexOf(this.step) + 1] ?? 'outro'
        continue
      }
      if (!this.lesson) this.lesson = findLesson(grid, this.step)
      break
    }
    if (this.step === 'outro') {
      return { step: 'outro', title: 'One last rule', text: 'No two finished rows, or two finished columns, may match. Stuck? Tap Hint and a tile will glow, with the reason why.', action: 'Got it' }
    }
    const m = this.lesson
    // When the board doesn't show this rule yet, the player keeps going until it does.
    if (!m) return { step: 'practice', title: 'Keep going', text: 'Fill more tiles with what you’ve learned. There’s one more rule to show you soon.' }
    const lesson = LESSONS[this.step](m)
    const placedWrong = grid[m.row][m.col] !== null && grid[m.row][m.col] !== m.value
    const instruction = placedWrong ? 'Not quite. Tap Undo and try again.' : selected !== m.value ? `Pick ${Name(m.value)} below.` : 'Now tap the glowing tile.'
    return { step: this.step, ...lesson, instruction, target: { row: m.row, col: m.col }, pick: selected !== m.value && !placedWrong ? m.value : null, because: m.because }
  }
}
