import { isValidBinarySolution } from './binaryLogic.js'
import { easiestDeductions } from './solver.js'
import { censusViolations, censusHolds } from './census.js'
import { lighthouseViolations, lighthousesHold } from './lighthouses.js'
import { ferryViolations, ferriesHold } from './ferries.js'
import { pilgrimViolations, pilgrimsHold } from './pilgrims.js'

// Daily gardens keep their progress by id ("<day>-<tier>"): the finished ones with their time, and
// the tiles, undo history and time of the rest. The tutorial garden is never saved.
const STORAGE_KEY = 'tidal-garden.daily'

export const copyGrid = (grid) => grid.map((row) => [...row])

export function findViolations(grid, { signs = [], lights = [], ferries = [], pilgrims = [] } = {}) {
  const invalid = new Set([...censusViolations(grid, signs), ...lighthouseViolations(grid, lights), ...ferryViolations(grid, ferries), ...pilgrimViolations(grid, pilgrims)])
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
export function findHint(grid, solution, { signs = [], lights = [], ferries = [], pilgrims = [] } = {}) {
  const next = easiestDeductions(grid, undefined, { signs, lights, ferries, pilgrims })
  if (!next) return null
  const move = next.deductions.find(({ row, col, value }) => !solution || solution[row][col] === value)
  if (!move) return null
  return { row: move.row, col: move.col, value: move.value, technique: move.technique, axis: move.line.axis }
}

export class GardenGame {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage
    this.selected = 0
    this.done = {}
    this.grids = {}
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null')
      if (saved && saved.version === 1) {
        this.done = saved.done && typeof saved.done === 'object' ? saved.done : {}
        this.grids = saved.grids && typeof saved.grids === 'object' ? saved.grids : {}
      }
    } catch { /* Storage can be unavailable in private browsing. */ }
  }

  // Opens a garden where it was left (or fresh, for the tutorial).
  start(puzzle) {
    this.puzzle = puzzle
    this.id = puzzle.id
    const saved = this.saves ? this.grids[puzzle.id] : null
    const fits = (grid) => Array.isArray(grid) && grid.length === 10 && grid.every((row, r) => Array.isArray(row) && row.length === 10 && row.every((v, c) => [null, 0, 1].includes(v) && (puzzle.puzzle[r][c] === null || puzzle.puzzle[r][c] === v)))
    const valid = fits(saved?.grid)
    this.grid = copyGrid(valid ? saved.grid : puzzle.puzzle)
    this.seconds = valid && Number.isFinite(saved.seconds) ? Math.max(0, saved.seconds) : 0
    this.history = valid && Array.isArray(saved.history) ? saved.history.filter(fits).map(copyGrid) : []
  }

  get saves() { return this.puzzle?.id !== 'tutorial' }

  // Where a garden stands: finished, started (a tile placed), or new.
  state(id) {
    if (this.done[id] !== undefined) return 'done'
    const saved = this.grids[id]
    return saved?.history?.length ? 'started' : 'new'
  }

  // Finished means a balanced garden whose every village and lighthouse matches its number, and
  // whose every pair of docks is joined by water and every pair of shrines by land.
  get complete() { return isValidBinarySolution(this.grid) && censusHolds(this.grid, this.puzzle.signs) && lighthousesHold(this.grid, this.puzzle.lights) && ferriesHold(this.grid, this.puzzle.ferries) && pilgrimsHold(this.grid, this.puzzle.pilgrims) }
  get filled() { return this.grid.flat().filter((v) => v !== null).length }
  get placed() { return this.filled - this.puzzle.puzzle.flat().filter((v) => v !== null).length }
  get remaining() { return 100 - this.filled }

  place(row, col, value = this.selected) {
    if (this.complete || this.puzzle.puzzle[row][col] !== null || this.grid[row][col] === value) return false
    this.history.push(copyGrid(this.grid))
    this.grid[row][col] = value
    if (this.complete && this.saves && this.done[this.id] === undefined) this.done[this.id] = this.seconds
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

  // Clears every garden: nothing finished, no tiles, no times.
  resetAll() {
    this.done = {}
    this.grids = {}
    this.selected = 0
    if (this.puzzle) this.start(this.puzzle)
    this.save()
  }

  save() {
    if (this.puzzle && this.saves) this.grids[this.id] = { grid: this.grid, history: this.history, seconds: this.seconds }
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, done: this.done, grids: this.grids }))
    } catch { /* Playing does not depend on storage access. */ }
  }
}
