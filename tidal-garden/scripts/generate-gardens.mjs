// Builds the thirty gardens of the Shallows as a gentle difficulty ramp.
//
// Every garden is solvable by always taking the easiest available move, without ever needing
// the rule that rows and columns must differ. Early gardens only need pairs and gaps; later
// ones need counting and, increasingly, reasoning about how a whole line can be finished.
//
//   node scripts/generate-gardens.mjs [--seed=20261002] [--candidates=24] [--output=src/puzzles.js]
import { writeFileSync } from 'node:fs'
import { getValidBinaryLines, canAppendBinaryRow, isValidBinarySolution, countBinarySolutions } from '../src/binaryLogic.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { parseArgs, rampLevels, gather, climb, encodeGrid } from './chapter.mjs'

const args = parseArgs()
const SEED = Number(args.seed ?? 20261002)
const CANDIDATES = Number(args.candidates ?? 24)
const SIZE = 10

// What each garden may ask of the player: the techniques it can rely on and how many tiles it
// starts with at least. Gardens that allow whole-line reasoning must actually need it.
export const LEVELS = rampLevels({ gentle: 8, middle: 7, givens: [[58, 46], [46, 36], [38, 0]] })
// Across the long climb, each garden needs a little more whole-line reasoning, up to eight rounds.
const leastLines = (level) => (level.allowed.includes('line') ? 1 + Math.round(level.stretch * 7) : 0)

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
  const pools = LEVELS.map((level, index) => {
    const lines = level.allowed.includes('line')
    const pool = gather(() => candidate(level, rng), ({ stats }) =>
      stats.solved && (lines ? stats.line >= leastLines(level) : stats.line === 0) && stats.bottlenecks <= Math.max(1, stats.rounds * 0.2) && stats.flow >= 2.5, { size: CANDIDATES })
    if (!pool.length) throw new Error(`No garden met the targets for level ${index + 1}`)
    return pool
  })
  const gardens = climb(pools, ({ stats }) => difficulty(stats), ({ stats }) => flowScore(stats))
  gardens.forEach((garden, index) => {
    report(index, garden)
    if (countBinarySolutions(garden.puzzle) !== 1) throw new Error(`Level ${index + 1} is not unique`)
  })
  return gardens
}

const encode = encodeGrid

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
