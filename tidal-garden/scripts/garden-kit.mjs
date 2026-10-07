// The building blocks of Tidal Garden's garden generator (scripts/generate-days.mjs): a seeded
// random source, a random finished garden, setting out clues on it, and measuring how a player
// would solve it.
import { getValidBinaryLines, canAppendBinaryRow, isValidBinarySolution } from '../src/binaryLogic.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { islandAt } from '../src/census.js'
import { lighthouses } from '../src/lighthouses.js'
import { passage, FERRY_COLORS } from '../src/ferries.js'
import { trail, PILGRIM_COLORS } from '../src/pilgrims.js'

const SIZE = 10

// Flags without a value, like --output, are simply switched on.
export const parseArgs = (argv = process.argv.slice(2)) => Object.fromEntries(argv.map((arg) => {
  const [key, value = true] = arg.replace(/^--/, '').split('=')
  return [key, value]
}))

export function random(seed) {
  let state = seed >>> 0
  return () => {
    state = state + 0x6d2b79f5 >>> 0
    let t = state
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function shuffle(items, rng) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function randomSolution(rng) {
  const lines = getValidBinaryLines(SIZE)
  for (;;) {
    const rows = []
    const fill = () => {
      if (rows.length === SIZE) return isValidBinarySolution(rows)
      for (const line of shuffle(lines, rng).slice(0, 40)) {
        if (!canAppendBinaryRow(rows, line, SIZE)) continue
        rows.push(line)
        if (fill()) return true
        rows.pop()
      }
      return false
    }
    if (fill()) return rows.map((row) => [...row])
  }
}

const KINDS = { signs: ['seal', 'apart', 'grow'], lights: ['block', 'shine'], ferries: ['channel'], pilgrims: ['trail'] }

export function measure(puzzle, clues) {
  const { solved, steps } = solveLikeAPlayer(puzzle, undefined, { flow: true, ...clues })
  const count = (techniques) => steps.filter((step) => techniques.includes(step.technique)).length
  const rounds = steps.length
  return {
    solved, rounds,
    clues: clues.signs.length + clues.lights.length + clues.ferries.length + clues.pilgrims.length,
    givens: puzzle.flat().filter((value) => value !== null).length,
    signs: count(KINDS.signs), lights: count(KINDS.lights), ferries: count(KINDS.ferries), pilgrims: count(KINDS.pilgrims),
    pair: count(['pair']), gap: count(['gap']), count: count(['count']), line: count(['line']),
    bottlenecks: steps.filter((step) => step.options === 1).length,
    flow: steps.reduce((sum, step) => sum + Math.min(step.options, 6), 0) / Math.max(1, rounds),
  }
}

// Sets out a garden's clues on its finished answer, each kind keeping clear of the others.
export function chooseClues(solution, level, rng) {
  const taken = []
  const village = new Set()
  const clear = ([r, c]) => !village.has(r * SIZE + c) && taken.every(([tr, tc]) => Math.max(Math.abs(tr - r), Math.abs(tc - c)) >= 2)
  const land = []
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (solution[row][col] === 1) land.push([row, col])
  // Villages first: small islands, each wholly given over to its huts.
  const seen = new Set()
  const islands = []
  for (const [row, col] of land) {
    if (seen.has(row * SIZE + col)) continue
    const island = islandAt(solution, row, col)
    island.keys.forEach((key) => seen.add(key))
    if (island.cells.length >= 2 && island.cells.length <= 6) islands.push(island)
  }
  const signs = shuffle(islands, rng).slice(0, level.signs).map((island) => {
    island.keys.forEach((key) => village.add(key))
    const cell = island.cells[Math.floor(rng() * island.cells.length)]
    taken.push(cell)
    return { cell, size: island.cells.length }
  })
  // Lighthouses on land that sees a fair stretch of sea.
  const lights = []
  for (const cell of shuffle(land, rng)) {
    if (lights.length >= level.lights) break
    if (!clear(cell)) continue
    const [state] = lighthouses(solution, [{ cell, sees: 0 }])
    if (state.seen < 2 || state.seen > 8) continue
    taken.push(cell)
    lights.push({ cell, sees: state.seen })
  }
  // Pairs joined by a good long crossing of water (docks) or walk over land (shrines).
  const pairUp = (count, joined, minimum, colors, key) => {
    const pairs = []
    for (const from of shuffle(land, rng)) {
      if (pairs.length >= count) break
      if (!clear(from)) continue
      let best = null
      for (const to of land) {
        if (!clear(to) || Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) < 3) continue
        const path = joined(from, to)
        if (!path || path.length < minimum) continue
        const score = path.length + rng() * 4
        if (!best || score > best.score) best = { to, score }
      }
      if (!best) continue
      taken.push(from, best.to)
      pairs.push({ color: colors[pairs.length], [key]: [from, best.to] })
    }
    return pairs
  }
  const ferries = pairUp(level.docks, (from, to) => passage(solution, [from, to]), 4, FERRY_COLORS, 'docks')
  const pilgrims = pairUp(level.shrines, (from, to) => {
    const path = trail(solution, [from, to])
    return path && path.every(([r, c]) => !village.has(r * SIZE + c)) ? path : null
  }, 4, PILGRIM_COLORS, 'shrines')
  return { signs, lights, ferries, pilgrims, taken }
}
