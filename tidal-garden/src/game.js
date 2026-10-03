import { isValidBinarySolution } from './binaryLogic.js'
import { easiestDeductions } from './solver.js'
import { PUZZLES } from './puzzles.js'
import { SHORE_PUZZLES } from './shorePuzzles.js'
import { hintViolations, hintsHold } from './hints.js'

// v2: the gardens were regenerated, so progress saved for the old ones no longer applies.
const STORAGE_KEY = 'tidal-garden.v2'
export const GARDEN_NAMES = [
  'First light', 'Quiet currents', 'Emerald shallows', 'Soft horizons',
  'Stillwater', 'The jade coast', 'Morning dew', 'Hidden springs',
  'A little wild', 'Gentle tides', 'Silver ripples', 'Salt & sunlight',
  'Green sanctuary', 'Drifting clouds', 'Low tide', 'Sea glass',
  'Secret garden', 'Distant shores', 'Moon pool', 'A world in balance',
  'First footbridge', 'Sandbar', 'Driftwood', 'Low causeway',
  'Tidepools', 'Shell beach', 'Reed shallows', 'Lantern pier',
  'Saltmarsh', 'Two shores',
]
// The gardens come in chapters; later chapters add new kinds of hint.
export const CHAPTERS = Object.freeze([
  { name: 'The Shallows', start: 0, count: PUZZLES.length },
  { name: 'Bridges & Shorelines', start: PUZZLES.length, count: SHORE_PUZZLES.length },
])
export const GARDENS = Object.freeze([...PUZZLES.map((garden) => ({ ...garden, hints: [] })), ...SHORE_PUZZLES])
export const chapterOf = (level) => CHAPTERS.findLast((chapter) => level >= chapter.start) ?? CHAPTERS[0]
export const copyGrid = (grid) => grid.map((row) => [...row])

export function findViolations(grid, hints = []) {
  const invalid = hintViolations(grid, hints)
  const size = grid.length
  const lines = [
    ...grid.map((values, row) => ({ values, cells: values.map((_, col) => [row, col]) })),
    ...grid.map((_, col) => ({ values: grid.map((row) => row[col]), cells: grid.map((_, row) => [row, col]) })),
  ]
  const add = (cell) => invalid.add(cell.join(':'))
  for (const line of lines) {
    for (const value of [0, 1]) {
      if (line.values.filter((v) => v === value).length > size / 2) {
        line.values.forEach((v, i) => { if (v === value) add(line.cells[i]) })
      }
    }
    for (let i = 0; i <= size - 3; i++) {
      if (line.values[i] !== null && line.values[i] === line.values[i + 1] && line.values[i] === line.values[i + 2]) {
        line.cells.slice(i, i + 3).forEach(add)
      }
    }
  }
  for (let axis = 0; axis < 2; axis++) {
    const group = lines.slice(axis * size, (axis + 1) * size)
    for (let a = 0; a < size; a++) {
      if (group[a].values.includes(null)) continue
      for (let b = a + 1; b < size; b++) {
        if (group[a].values.every((v, i) => v === group[b].values[i])) {
          group[a].cells.forEach(add)
          group[b].cells.forEach(add)
        }
      }
    }
  }
  return invalid
}

// The easiest move available right now, matching the garden's solution, and why it works.
export function findHint(grid, solution, hints = []) {
  const next = easiestDeductions(grid, undefined, hints)
  if (!next) return null
  const move = next.deductions.find(({ row, col, value }) => !solution || solution[row][col] === value)
  if (!move) return null
  return { row: move.row, col: move.col, value: move.value, technique: move.technique, axis: move.line.axis }
}

export class GardenGame {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage
    this.level = 0
    this.selected = 0
    this.history = []
    this.completed = []
    this.seconds = 0
    this.grids = {}
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null')
      if (saved && saved.version === 1) {
        this.completed = Array.isArray(saved.completed) ? saved.completed.filter((v) => Number.isInteger(v) && v >= 0 && v < GARDENS.length) : []
        this.grids = saved.grids && typeof saved.grids === 'object' ? saved.grids : {}
        this.level = Number.isInteger(saved.level) && saved.level >= 0 && saved.level < GARDENS.length ? saved.level : 0
      }
    } catch { /* Storage can be unavailable in private browsing. */ }
    this.load(this.level)
  }

  load(level) {
    this.level = level
    this.puzzle = GARDENS[level]
    const saved = this.grids[level]
    const isValidSavedGrid = (grid) => Array.isArray(grid) && grid.length === 10 && grid.every((row, r) => Array.isArray(row) && row.length === 10 && row.every((v, c) => [null, 0, 1].includes(v) && (this.puzzle.puzzle[r][c] === null || this.puzzle.puzzle[r][c] === v)))
    const validGrid = isValidSavedGrid(saved?.grid)
    this.grid = copyGrid(validGrid ? saved.grid : this.puzzle.puzzle)
    this.seconds = validGrid && Number.isFinite(saved.seconds) ? Math.max(0, saved.seconds) : 0
    this.history = validGrid && Array.isArray(saved.history)
      ? saved.history.filter(isValidSavedGrid).map(copyGrid)
      : []
    this.save()
  }

  // Finished means a balanced garden that also keeps every footbridge and shoreline.
  get complete() { return isValidBinarySolution(this.grid) && hintsHold(this.grid, this.puzzle.hints) }
  get filled() { return this.grid.flat().filter((v) => v !== null).length }
  get placed() { return this.filled - this.puzzle.puzzle.flat().filter((v) => v !== null).length }
  get remaining() { return 100 - this.filled }

  place(row, col, value = this.selected) {
    if (this.complete || this.puzzle.puzzle[row][col] !== null || this.grid[row][col] === value) return false
    this.history.push(copyGrid(this.grid))
    this.grid[row][col] = value
    if (this.complete && !this.completed.includes(this.level)) this.completed.push(this.level)
    this.save()
    return true
  }

  undo() {
    if (!this.history.length) return false
    this.grid = this.history.pop()
    this.save()
    return true
  }

  reset() {
    this.grid = copyGrid(this.puzzle.puzzle)
    this.history = []
    this.seconds = 0
    this.save()
  }

  save() {
    this.grids[this.level] = { grid: this.grid, history: this.history, seconds: this.seconds }
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, level: this.level, completed: this.completed, grids: this.grids }))
    } catch { /* Playing does not depend on storage access. */ }
  }
}
