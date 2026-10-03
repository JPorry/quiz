// Builds the "Ferries" chapter: ten gardens with pairs of matching docks on starting land tiles.
//
// Each pair of docks must end up joined by water, so its ferry can sail between them. Each garden
// starts from a finished one, sets out a few pairs of docks along long, winding stretches of water,
// then carves starting tiles away for as long as a player could still solve it by always taking
// the easiest move, ferries included.
//
//   node scripts/generate-ferries.mjs [--seed=20261007] [--candidates=16] [--output=src/ferryPuzzles.js]
import { writeFileSync } from 'node:fs'
import { random, shuffle, randomSolution } from './generate-gardens.mjs'
import { solveLikeAPlayer } from '../src/solver.js'
import { passage, ferriesHold } from '../src/ferries.js'

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')))
const SEED = Number(args.seed ?? 20261007)
const CANDIDATES = Number(args.candidates ?? 16)
const SIZE = 10
// Each pair of docks has its own roof color.
export const FERRY_COLORS = Object.freeze(['coral', 'sun', 'sky', 'lilac'])

const FERRY = ['channel']
const BASIC = [...FERRY, 'pair', 'gap']
const COUNTING = [...BASIC, 'count']
const ALL = [...COUNTING, 'line']

// Each garden's techniques, the fewest starting tiles it may keep, and how many pairs of docks it sets out.
export const FERRY_LEVELS = [
  { allowed: BASIC, givens: 30, pairs: 2 },
  { allowed: BASIC, givens: 26, pairs: 2 },
  { allowed: BASIC, givens: 22, pairs: 3 },
  { allowed: COUNTING, givens: 20, pairs: 3 },
  { allowed: COUNTING, givens: 16, pairs: 3 },
  { allowed: ALL, givens: 14, pairs: 3 },
  { allowed: ALL, givens: 10, pairs: 3 },
  { allowed: ALL, givens: 6, pairs: 4 },
  { allowed: ALL, givens: 3, pairs: 4 },
  { allowed: ALL, givens: 0, pairs: 4 },
]

export function measureFerries(puzzle, ferries) {
  const { solved, steps } = solveLikeAPlayer(puzzle, undefined, { flow: true, ferries })
  const count = (technique) => steps.filter((step) => step.technique === technique).length
  const rounds = steps.length
  return {
    solved, rounds, pairs: ferries.length,
    givens: puzzle.flat().filter((value) => value !== null).length,
    channel: count('channel'), pair: count('pair'), gap: count('gap'), count: count('count'), line: count('line'),
    bottlenecks: steps.filter((step) => step.options === 1).length,
    flow: steps.reduce((sum, step) => sum + Math.min(step.options, 6), 0) / Math.max(1, rounds),
  }
}

export const ferryDifficulty = (stats) => stats.line * 10 + stats.count * 2 + (100 - stats.givens) * 0.5 - stats.pairs
export const ferryMoves = (stats) => stats.channel

// Docks stand on land tiles by the water, well apart from each other, and each pair is joined by a
// good long crossing.
export function chooseFerries(solution, count, rng, taken = []) {
  const shore = []
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
    if (solution[row][col] !== 1) continue
    if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => solution[row + dr]?.[col + dc] === 0)) shore.push([row, col])
  }
  // Other clues already set out in the garden (shared, so they keep their distance too).
  const docks = taken
  const apart = ([r, c]) => docks.every(([dr, dc]) => Math.max(Math.abs(dr - r), Math.abs(dc - c)) >= 2)
  const ferries = []
  for (const from of shuffle(shore, rng)) {
    if (ferries.length >= count) break
    if (!apart(from)) continue
    let best = null
    for (const to of shore) {
      if (!apart(to) || Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) < 4) continue
      const path = passage(solution, [from, to])
      if (!path || path.length < 4) continue
      const score = path.length + rng() * 4
      if (!best || score > best.score) best = { to, score }
    }
    if (!best) continue
    docks.push(from, best.to)
    ferries.push({ color: FERRY_COLORS[ferries.length], docks: [from, best.to] })
  }
  return ferries
}

export function candidate(level, rng) {
  const solution = randomSolution(rng)
  const ferries = chooseFerries(solution, level.pairs, rng)
  const docks = new Set(ferries.flatMap(({ docks }) => docks.map(([r, c]) => r * SIZE + c)))
  const puzzle = solution.map((row) => [...row])
  let remaining = SIZE * SIZE
  for (const index of shuffle([...Array(SIZE * SIZE).keys()], rng)) {
    // Past its target, a garden keeps carving only until it can't be finished without its ferries.
    if (remaining <= level.givens && !solveLikeAPlayer(puzzle, level.allowed).solved) break
    // A dock's own tile always starts in place: the dock stands on it.
    if (docks.has(index)) continue
    const row = Math.floor(index / SIZE), col = index % SIZE
    const value = puzzle[row][col]
    puzzle[row][col] = null
    if (solveLikeAPlayer(puzzle, level.allowed, { ferries }).solved) remaining--
    else puzzle[row][col] = value
  }
  return { solution, puzzle, ferries, stats: measureFerries(puzzle, ferries) }
}

const flowScore = (stats) => stats.flow - stats.bottlenecks * 0.35 + ferryMoves(stats) * 0.08

function generate() {
  const rng = random(SEED)
  const gardens = []
  FERRY_LEVELS.forEach((level, index) => {
    let best = null
    for (let attempt = 0; attempt < CANDIDATES * 30 && (!best || attempt < CANDIDATES); attempt++) {
      const next = candidate(level, rng)
      const { stats } = next
      // The ferries must carry real weight in every garden of this chapter.
      if (!stats.solved || ferryMoves(stats) < 3 || stats.pairs < level.pairs) continue
      if (solveLikeAPlayer(next.puzzle, level.allowed).solved) continue
      if (gardens.length && ferryDifficulty(stats) <= ferryDifficulty(gardens.at(-1).stats)) continue
      if (!best || flowScore(stats) > flowScore(best.stats)) best = next
    }
    if (!best) throw new Error(`No garden met the targets for ferry garden ${index + 1}`)
    if (!ferriesHold(best.solution, best.ferries)) throw new Error(`Ferry garden ${index + 1} strands its own ferries`)
    gardens.push(best)
    const s = best.stats
    console.log(`Ferries ${String(index + 1).padStart(2)}: ${s.givens} tiles, ${s.pairs} pairs, ${s.rounds} rounds (channel ${s.channel}, pair ${s.pair}, gap ${s.gap}, count ${s.count}, line ${s.line}), ${s.bottlenecks} bottlenecks, flow ${s.flow.toFixed(2)}`)
  })
  return gardens
}

const encode = (grid) => `[\n${grid.map((row) => `      [${row.map((value) => value ?? 'null').join(', ')}],`).join('\n')}\n    ]`
const encodeFerries = (ferries) => `[\n${ferries.map(({ color, docks }) => `      { color: '${color}', docks: [${docks.map((cell) => `[${cell.join(', ')}]`).join(', ')}] },`).join('\n')}\n    ]`

if (import.meta.url === `file://${process.argv[1]}`) {
  const gardens = generate()
  const source = `// Generated by scripts/generate-ferries.mjs --seed=${SEED}. Do not edit by hand.
// Each garden is solvable by always taking the easiest move, ferries included.
export const FERRY_PUZZLES = [
${gardens.map(({ puzzle, solution, ferries }, index) => `  {
    id: 'ferries-${String(index + 1).padStart(2, '0')}',
    puzzle: ${encode(puzzle)},
    solution: ${encode(solution)},
    ferries: ${encodeFerries(ferries)},
  },`).join('\n')}
]
`
  if (args.output) writeFileSync(args.output, source)
  else console.log('\nDry run. Add --output=src/ferryPuzzles.js to write the gardens.')
}
