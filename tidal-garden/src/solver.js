import { getValidBinaryLines } from './binaryLogic.js'

// The deductions a player can make, easiest first. None of them needs the rule that rows or
// columns must differ: every garden is built to be solvable without it.
export const TECHNIQUES = Object.freeze(['pair', 'gap', 'count', 'line'])

function lines(grid) {
  const size = grid.length
  const result = []
  for (let row = 0; row < size; row++) result.push({ axis: 'row', index: row, cells: grid[row].map((_, col) => [row, col]) })
  for (let col = 0; col < size; col++) result.push({ axis: 'column', index: col, cells: grid.map((_, row) => [row, col]) })
  return result
}

function collect(found, grid, row, col, value, technique, line) {
  if (grid[row][col] !== null) return
  const key = row * grid.length + col
  if (!found.has(key)) found.set(key, { row, col, value, technique, line })
}

// Two equal neighbors force the tiles on either side, and a gap between two equal tiles is
// forced to the other kind.
function adjacency(grid, technique) {
  const found = new Map()
  for (const line of lines(grid)) {
    const values = line.cells.map(([r, c]) => grid[r][c])
    for (let i = 0; i < values.length - 1; i++) {
      if (technique === 'pair' && values[i] !== null && values[i] === values[i + 1]) {
        for (const j of [i - 1, i + 2]) if (j >= 0 && j < values.length) collect(found, grid, ...line.cells[j], 1 - values[i], 'pair', line)
      }
      if (technique === 'gap' && i < values.length - 2 && values[i] !== null && values[i] === values[i + 2] && values[i + 1] === null) {
        collect(found, grid, ...line.cells[i + 1], 1 - values[i], 'gap', line)
      }
    }
  }
  return [...found.values()]
}

// A line that already holds half of one kind takes the other kind everywhere else.
function counting(grid) {
  const found = new Map()
  const half = grid.length / 2
  for (const line of lines(grid)) {
    const values = line.cells.map(([r, c]) => grid[r][c])
    for (const value of [0, 1]) {
      if (values.filter((v) => v === value).length !== half) continue
      line.cells.forEach(([r, c]) => collect(found, grid, r, c, 1 - value, 'count', line))
    }
  }
  return [...found.values()]
}

// Every balanced, triple-free way to finish a line agrees on these tiles.
function lineLogic(grid) {
  const found = new Map()
  const valid = getValidBinaryLines(grid.length)
  for (const line of lines(grid)) {
    const values = line.cells.map(([r, c]) => grid[r][c])
    if (!values.includes(null)) continue
    const fits = valid.filter((candidate) => values.every((v, i) => v === null || v === candidate[i]))
    if (!fits.length) continue
    values.forEach((v, i) => {
      if (v !== null) return
      if (fits.every((candidate) => candidate[i] === fits[0][i])) collect(found, grid, ...line.cells[i], fits[0][i], 'line', line)
    })
  }
  return [...found.values()]
}

const FINDERS = { pair: (grid) => adjacency(grid, 'pair'), gap: (grid) => adjacency(grid, 'gap'), count: counting, line: lineLogic }

// The easiest kind of deduction available right now, with every placement it allows.
export function easiestDeductions(grid, allowed = TECHNIQUES) {
  for (const technique of TECHNIQUES) {
    if (!allowed.includes(technique)) continue
    const deductions = FINDERS[technique](grid)
    if (deductions.length) return { technique, deductions }
  }
  return null
}

// Every tile the player could fill in right now, by any allowed technique.
export function availableMoves(grid, allowed = TECHNIQUES) {
  const cells = new Set()
  for (const technique of allowed) for (const { row, col } of FINDERS[technique](grid)) cells.add(row * grid.length + col)
  return cells.size
}

// Plays the garden the way a person would: always reaching for the easiest move available.
// Reports whether it finished, and how the solve flowed; with `flow`, each step also counts
// how many tiles the player could have filled in at that moment.
export function solveLikeAPlayer(puzzle, allowed = TECHNIQUES, { flow = false } = {}) {
  const grid = puzzle.map((row) => [...row])
  const steps = []
  for (;;) {
    const next = easiestDeductions(grid, allowed)
    if (!next) break
    const options = flow ? availableMoves(grid, allowed) : next.deductions.length
    for (const { row, col, value } of next.deductions) grid[row][col] = value
    steps.push({ technique: next.technique, options })
  }
  const solved = grid.every((row) => row.every((value) => value !== null))
  return { solved, grid, steps }
}
