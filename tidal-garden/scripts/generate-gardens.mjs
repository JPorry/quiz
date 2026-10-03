// Builds the twenty gardens as a gentle difficulty ramp.
//
// Every garden is solvable by always taking the easiest available move, without ever needing
// the rule that rows and columns must differ. Early gardens only need pairs and gaps; later
// ones need counting and, increasingly, reasoning about how a whole line can be finished.
//
//   node scripts/generate-gardens.mjs [--seed=20261002] [--candidates=24] [--output=src/puzzles.js]
import { writeFileSync } from 'node:fs'
import { getValidBinaryLines, canAppendBinaryRow, isValidBinarySolution, countBinarySolutions } from '../src/binaryLogic.js'
import { solveLikeAPlayer } from '../src/solver.js'

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')))
const SEED = Number(args.seed ?? 20261002)
const CANDIDATES = Number(args.candidates ?? 24)
const SIZE = 10

const BASIC = ['pair', 'gap']
const COUNTING = ['pair', 'gap', 'count']
const ALL = ['pair', 'gap', 'count', 'line']

// What each garden may ask of the player: the techniques it can rely on, how many tiles it
// starts with at least, and how many rounds need whole-line reasoning.
export const LEVELS = [
  { allowed: BASIC, givens: 56, line: [0, 0] },
  { allowed: BASIC, givens: 50, line: [0, 0] },
  { allowed: BASIC, givens: 46, line: [0, 0] },
  { allowed: COUNTING, givens: 44, line: [0, 0] },
  { allowed: COUNTING, givens: 41, line: [0, 0] },
  { allowed: COUNTING, givens: 38, line: [0, 0] },
  { allowed: COUNTING, givens: 36, line: [0, 0] },
  { allowed: ALL, givens: 38, line: [1, 1] },
  { allowed: ALL, givens: 36, line: [1, 2] },
  { allowed: ALL, givens: 34, line: [2, 3] },
  { allowed: ALL, givens: 33, line: [3, 4] },
  { allowed: ALL, givens: 32, line: [3, 5] },
  { allowed: ALL, givens: 31, line: [4, 6] },
  { allowed: ALL, givens: 30, line: [5, 7] },
  { allowed: ALL, givens: 0, line: [6, 8] },
  { allowed: ALL, givens: 0, line: [7, 9] },
  { allowed: ALL, givens: 0, line: [7, 10] },
  { allowed: ALL, givens: 0, line: [8, 99] },
  { allowed: ALL, givens: 0, line: [9, 99] },
  { allowed: ALL, givens: 0, line: [10, 99] },
]

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

// Takes tiles away one by one, keeping each removal only if the garden stays solvable
// with the techniques this level allows.
function carve(solution, { allowed, givens }, rng) {
  const puzzle = solution.map((row) => [...row])
  let remaining = SIZE * SIZE
  for (const index of shuffle([...Array(SIZE * SIZE).keys()], rng)) {
    if (remaining <= givens) break
    const row = Math.floor(index / SIZE), col = index % SIZE
    const value = puzzle[row][col]
    puzzle[row][col] = null
    if (solveLikeAPlayer(puzzle, allowed).solved) remaining--
    else puzzle[row][col] = value
  }
  return puzzle
}

export function measure(puzzle) {
  const { solved, steps } = solveLikeAPlayer(puzzle, undefined, { flow: true })
  const givens = puzzle.flat().filter((value) => value !== null).length
  const rounds = steps.length
  const count = (technique) => steps.filter((step) => step.technique === technique).length
  // A round with a single possible move is a bottleneck; plenty of options keeps the chain flowing.
  const bottlenecks = steps.filter((step) => step.options === 1).length
  const flow = steps.reduce((sum, step) => sum + Math.min(step.options, 6), 0) / Math.max(1, rounds)
  return { solved, givens, rounds, pair: count('pair'), gap: count('gap'), count: count('count'), line: count('line'), bottlenecks, flow }
}

// Harder puzzles get a higher score, so gardens can be checked to only ever ramp up.
export const difficulty = (stats) => stats.line * 10 + stats.count * 2 + (100 - stats.givens) * 0.5

function candidate(level, rng) {
  const solution = randomSolution(rng)
  const puzzle = carve(solution, level, rng)
  return { solution, puzzle, stats: measure(puzzle) }
}

// Prefer gardens whose next move is usually easy to spot and never stalls for long.
const flowScore = (stats) => stats.flow - stats.bottlenecks * 0.35

function report(index, { stats }) {
  console.log(`Level ${String(index + 1).padStart(2)}: ${stats.givens} tiles, ${stats.rounds} rounds (pair ${stats.pair}, gap ${stats.gap}, count ${stats.count}, line ${stats.line}), ${stats.bottlenecks} bottlenecks, flow ${stats.flow.toFixed(2)}`)
}

function generate() {
  const rng = random(SEED)
  const gardens = []
  const finale = LEVELS.filter((level) => level.givens === 0)
  // Gentle and middle gardens are picked one by one, each a little harder than the last.
  LEVELS.slice(0, LEVELS.length - finale.length).forEach((level, index) => {
    let best = null
    for (let attempt = 0; attempt < CANDIDATES * 40 && (!best || attempt < CANDIDATES); attempt++) {
      const next = candidate(level, rng)
      const { stats } = next
      if (!stats.solved || stats.line < level.line[0] || stats.line > level.line[1]) continue
      if (gardens.length && difficulty(stats) <= difficulty(gardens.at(-1).stats)) continue
      if (!best || flowScore(stats) > flowScore(best.stats)) best = next
    }
    if (!best) throw new Error(`No garden met the targets for level ${index + 1}`)
    gardens.push(best)
    report(index, best)
  })
  // The finale draws from a pool of the sparsest gardens, climbing evenly through its harder half.
  const floor = difficulty(gardens.at(-1).stats)
  const pool = Array.from({ length: CANDIDATES * 12 }, () => candidate(finale[0], rng))
    .filter(({ stats }) => stats.solved && stats.line >= finale[0].line[0] && difficulty(stats) > floor)
    .sort((a, b) => difficulty(a.stats) - difficulty(b.stats))
  if (pool.length < finale.length * 3) throw new Error('Not enough sparse gardens for the finale')
  const half = pool.slice(Math.floor(pool.length / 2))
  finale.forEach((_, i) => {
    const center = Math.round((i + 1) / finale.length * (half.length - 1))
    const window = half.slice(Math.max(0, center - 2), center + 1).filter((garden) => difficulty(garden.stats) > difficulty(gardens.at(-1).stats))
    const best = (window.length ? window : half.filter((garden) => difficulty(garden.stats) > difficulty(gardens.at(-1).stats)))
      .reduce((a, b) => (flowScore(b.stats) > flowScore(a.stats) ? b : a))
    gardens.push(best)
    report(gardens.length - 1, best)
  })
  gardens.forEach(({ puzzle }, index) => {
    if (countBinarySolutions(puzzle) !== 1) throw new Error(`Level ${index + 1} is not unique`)
  })
  return gardens
}

const encode = (grid) => `[\n${grid.map((row) => `      [${row.map((value) => value ?? 'null').join(', ')}],`).join('\n')}\n    ]`

if (import.meta.url === `file://${process.argv[1]}`) {
  const gardens = generate()
  const source = `// Generated by scripts/generate-gardens.mjs --seed=${SEED}. Do not edit by hand.
// Each garden is solvable by always taking the easiest move, and they grow harder in order.
export const SIZE = ${SIZE}

export const PUZZLES = [
${gardens.map(({ puzzle, solution }, index) => `  {
    id: 'level-${String(index + 1).padStart(2, '0')}',
    name: 'Level ${index + 1}',
    puzzle: ${encode(puzzle)},
    solution: ${encode(solution)},
  },`).join('\n')}
]
`
  if (args.output) writeFileSync(args.output, source)
  else console.log(`\nDry run. Add --output=src/puzzles.js to write the gardens.`)
}
