import { getValidBinaryLines } from './binaryLogic.js'
import { villages } from './census.js'
import { lighthouses } from './lighthouses.js'

// The deductions a player can make, easiest first. None of them needs the rule that rows or
// columns must differ: every garden is built to be solvable without it. The village moves only
// apply to gardens whose islands carry census signs.
export const TECHNIQUES = Object.freeze(['seal', 'apart', 'grow', 'block', 'shine', 'pair', 'gap', 'count', 'line'])
export const VILLAGE_TECHNIQUES = Object.freeze(['seal', 'apart', 'grow'])
export const LIGHT_TECHNIQUES = Object.freeze(['block', 'shine'])

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

// A village that already holds its number is closed in by water on every open side.
function seal(grid, { signs = [] }) {
  const found = new Map()
  for (const village of villages(grid, signs)) {
    if (village.over || village.cells.length !== village.sign.size) continue
    for (const [r, c] of village.frontier) collect(found, grid, r, c, 0, 'seal', { axis: 'village', index: 0 })
  }
  return [...found.values()]
}

// A village still short of its number with only one way out has to grow through it.
function grow(grid, { signs = [] }) {
  const found = new Map()
  for (const village of villages(grid, signs)) {
    if (village.over || village.cells.length >= village.sign.size || village.frontier.length !== 1) continue
    const [r, c] = village.frontier[0]
    collect(found, grid, r, c, 1, 'grow', { axis: 'village', index: 0 })
  }
  return [...found.values()]
}

// A gap that would join a village to other land, and so push it past its number (or join two
// villages with different numbers), must be water.
function apart(grid, { signs = [] }) {
  const found = new Map()
  if (!signs.length) return []
  const size = grid.length
  const label = new Map()
  const islands = []
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    if (grid[row][col] !== 1 || label.has(row * size + col)) continue
    const id = islands.length
    const island = { size: 0, numbers: new Set() }
    const queue = [[row, col]]
    label.set(row * size + col, id)
    while (queue.length) {
      const [r, c] = queue.shift()
      island.size++
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc
        if (grid[nr]?.[nc] !== 1 || label.has(nr * size + nc)) continue
        label.set(nr * size + nc, id)
        queue.push([nr, nc])
      }
    }
    islands.push(island)
  }
  for (const sign of signs) {
    const id = label.get(sign.cell[0] * size + sign.cell[1])
    if (id !== undefined) islands[id].numbers.add(sign.size)
  }
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    if (grid[row][col] !== null) continue
    const touching = new Set()
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = row + dr, c = col + dc
      if (r >= 0 && c >= 0 && r < size && c < size && label.has(r * size + c)) touching.add(label.get(r * size + c))
    }
    if (touching.size < 2) continue
    const numbers = new Set([...touching].flatMap((id) => [...islands[id].numbers]))
    if (!numbers.size) continue
    const total = 1 + [...touching].reduce((sum, id) => sum + islands[id].size, 0)
    if (numbers.size > 1 || total > [...numbers][0]) collect(found, grid, row, col, 0, 'apart', { axis: 'village', index: 0 })
  }
  return [...found.values()]
}

// A lighthouse that already sees its number has land at the end of every beam still open.
function block(grid, { lights = [] }) {
  const found = new Map()
  for (const state of lighthouses(grid, lights)) {
    if (state.seen !== state.light.sees) continue
    for (const { open } of state.beams) if (open) collect(found, grid, open[0], open[1], 1, 'block', { axis: 'light', index: 0 })
  }
  return [...found.values()]
}

// If the other beams can't make up a lighthouse's number, this beam must carry the rest:
// the tiles it has to cross to get there are water.
function shine(grid, { lights = [] }) {
  const found = new Map()
  for (const state of lighthouses(grid, lights)) {
    for (const b of state.beams) {
      const needed = state.light.sees - (state.most - b.reach)
      if (needed <= b.lit.length) continue
      const [row, col] = state.light.cell, [dr, dc] = b.direction
      for (let step = b.lit.length + 1; step <= Math.min(needed, b.reach); step++) collect(found, grid, row + dr * step, col + dc * step, 0, 'shine', { axis: 'light', index: 0 })
    }
  }
  return [...found.values()]
}

const FINDERS = { seal, apart, grow, block, shine, pair: (grid) => adjacency(grid, 'pair'), gap: (grid) => adjacency(grid, 'gap'), count: counting, line: lineLogic }

// The easiest kind of deduction available right now, with every placement it allows.
export function easiestDeductions(grid, allowed = TECHNIQUES, context = {}) {
  for (const technique of TECHNIQUES) {
    if (!allowed.includes(technique)) continue
    const deductions = FINDERS[technique](grid, context)
    if (deductions.length) return { technique, deductions }
  }
  return null
}

// Every tile the player could fill in right now, by any allowed technique.
export function availableMoves(grid, allowed = TECHNIQUES, context = {}) {
  const cells = new Set()
  for (const technique of allowed) for (const { row, col } of FINDERS[technique](grid, context)) cells.add(row * grid.length + col)
  return cells.size
}

// Plays the garden the way a person would: always reaching for the easiest move available.
// Reports whether it finished, and how the solve flowed; with `flow`, each step also counts
// how many tiles the player could have filled in at that moment.
export function solveLikeAPlayer(puzzle, allowed = TECHNIQUES, { flow = false, signs = [], lights = [] } = {}) {
  const grid = puzzle.map((row) => [...row])
  const steps = []
  const context = { signs, lights }
  for (;;) {
    const next = easiestDeductions(grid, allowed, context)
    if (!next) break
    const options = flow ? availableMoves(grid, allowed, context) : next.deductions.length
    for (const { row, col, value } of next.deductions) grid[row][col] = value
    steps.push({ technique: next.technique, options })
  }
  const solved = grid.every((row) => row.every((value) => value !== null))
  return { solved, grid, steps }
}
