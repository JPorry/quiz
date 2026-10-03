// Builds the "Pilgrims" and "Crossings" chapters: thirty gardens with pairs of matching shrines on
// starting land tiles, then thirty that mix shrines with the ferries' docks.
//
// Each pair of shrines must end up on the same island, so its pilgrim can walk between them; each
// pair of docks must end up joined by water. Each garden starts from a finished one, sets out its
// pairs along long, winding stretches of land (and water), then carves starting tiles away for as
// long as a player could still solve it by always taking the easiest move.
//
//   node scripts/generate-pilgrims.mjs [--seed=20261009] [--candidates=16] [--chapter=pilgrims|crossings] [--debug] [--output]
import { writeFileSync } from 'node:fs'
import { random, shuffle, randomSolution } from './generate-gardens.mjs'
import { chooseFerries } from './generate-ferries.mjs'
import { solveLikeAPlayer } from '../src/solver.js'
import { trail, pilgrimsHold } from '../src/pilgrims.js'
import { ferriesHold } from '../src/ferries.js'
import { parseArgs, rampLevels, gather, climb, climbStart, encodeGrid } from './chapter.mjs'

const args = parseArgs()
const SEED = Number(args.seed ?? 20261009)
const CANDIDATES = Number(args.candidates ?? 16)
const SIZE = 10
// Each pair of shrines has its own lantern color, apart from the ferries' roofs.
export const LANTERN_COLORS = Object.freeze(['rose', 'mint', 'amber', 'violet'])

// Each garden's techniques, the fewest starting tiles it may keep, and how many pairs of shrines
// (and of docks) it sets out.
export const PILGRIM_LEVELS = rampLevels({ moves: ['channel', 'trail'], clues: { shrines: [2, 3], docks: [0, 0] } })
export const CROSSING_LEVELS = rampLevels({ moves: ['channel', 'trail'], givens: [[30, 24], [24, 16], [16, 0]], clues: { shrines: [1, 2.6], docks: [1, 2.6] } })

export function measurePilgrims(puzzle, { pilgrims = [], ferries = [] }) {
  const { solved, steps } = solveLikeAPlayer(puzzle, undefined, { flow: true, pilgrims, ferries })
  const count = (technique) => steps.filter((step) => step.technique === technique).length
  const rounds = steps.length
  return {
    solved, rounds, pairs: pilgrims.length + ferries.length,
    givens: puzzle.flat().filter((value) => value !== null).length,
    trail: count('trail'), channel: count('channel'), pair: count('pair'), gap: count('gap'), count: count('count'), line: count('line'),
    bottlenecks: steps.filter((step) => step.options === 1).length,
    flow: steps.reduce((sum, step) => sum + Math.min(step.options, 6), 0) / Math.max(1, rounds),
  }
}

export const pilgrimDifficulty = (stats) => stats.line * 10 + stats.count * 2 + (100 - stats.givens) * 0.5 - stats.pairs

// Shrines stand on land tiles well apart from every other clue, and each pair is joined by a good
// long walk across its island.
export function chooseShrines(solution, count, rng, taken = []) {
  const land = []
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (solution[row][col] === 1) land.push([row, col])
  const apart = ([r, c]) => taken.every(([tr, tc]) => Math.max(Math.abs(tr - r), Math.abs(tc - c)) >= 2)
  const pilgrims = []
  for (const from of shuffle(land, rng)) {
    if (pilgrims.length >= count) break
    if (!apart(from)) continue
    let best = null
    for (const to of land) {
      if (!apart(to) || Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) < 3) continue
      const path = trail(solution, [from, to])
      if (!path || path.length < 5) continue
      const score = path.length + rng() * 4
      if (!best || score > best.score) best = { to, score }
    }
    if (!best) continue
    taken.push(from, best.to)
    pilgrims.push({ color: LANTERN_COLORS[pilgrims.length], shrines: [from, best.to] })
  }
  return pilgrims
}

export function candidate(level, rng) {
  const solution = randomSolution(rng)
  const taken = []
  const ferries = level.docks ? chooseFerries(solution, level.docks, rng, taken) : []
  const pilgrims = chooseShrines(solution, level.shrines, rng, taken)
  const fixed = new Set(taken.map(([r, c]) => r * SIZE + c))
  const clues = { pilgrims, ferries }
  const puzzle = solution.map((row) => [...row])
  let remaining = SIZE * SIZE
  for (const index of shuffle([...Array(SIZE * SIZE).keys()], rng)) {
    // Past its target, a garden keeps carving only until it can't be finished without its clues.
    if (remaining <= level.givens && !solveLikeAPlayer(puzzle, level.allowed).solved) break
    // A shrine's or a dock's own tile always starts in place: it stands on it.
    if (fixed.has(index)) continue
    const row = Math.floor(index / SIZE), col = index % SIZE
    const value = puzzle[row][col]
    puzzle[row][col] = null
    if (solveLikeAPlayer(puzzle, level.allowed, clues).solved) remaining--
    else puzzle[row][col] = value
  }
  return { solution, puzzle, pilgrims, ferries, stats: measurePilgrims(puzzle, clues) }
}

const flowScore = (stats) => stats.flow - stats.bottlenecks * 0.35 + (stats.trail + stats.channel) * 0.08

// The pairs must carry real weight: shrines in every garden, and docks as well where there are any.
const carries = (level, stats) => stats.trail >= (level.docks ? 2 : 3) && (!level.docks || stats.channel >= 2)

// Gathers a pool of good gardens for every level, then picks one per level so that each is harder
// than the last while flowing as well as possible overall.
function generate(levels, label, rng) {
  const pools = levels.map((level, index) => {
    const pool = gather(() => candidate(level, rng), (next) => {
      const { stats } = next
      if (!stats.solved || !carries(level, stats) || next.pilgrims.length < level.shrines || next.ferries.length < level.docks) return false
      if (solveLikeAPlayer(next.puzzle, level.allowed).solved) return false
      // A garden that keeps leaving the player with a single move to find is a slog, not a puzzle.
      if (stats.bottlenecks > Math.max(1, stats.rounds * 0.2)) return false
      if (!pilgrimsHold(next.solution, next.pilgrims) || !ferriesHold(next.solution, next.ferries)) throw new Error(`${label} garden ${index + 1} breaks its own clues`)
      return true
    }, { size: CANDIDATES })
    if (args.debug) console.log(label, index + 1, pool.length, pool.map((g) => pilgrimDifficulty(g.stats).toFixed(0)).sort((a, b) => a - b).join(' '))
    if (!pool.length) throw new Error(`No garden met the targets for ${label} garden ${index + 1}`)
    return pool
  })
  const gardens = climb(pools, ({ stats }) => pilgrimDifficulty(stats), ({ stats }) => flowScore(stats), climbStart(levels))
  gardens.forEach((garden, index) => {
    const s = garden.stats
    console.log(`${label} ${String(index + 1).padStart(2)}: ${s.givens} tiles, ${garden.pilgrims.length} shrines, ${garden.ferries.length} docks, ${s.rounds} rounds (trail ${s.trail}, channel ${s.channel}, pair ${s.pair}, gap ${s.gap}, count ${s.count}, line ${s.line}), ${s.bottlenecks} bottlenecks, flow ${s.flow.toFixed(2)}, difficulty ${pilgrimDifficulty(s).toFixed(1)}`)
  })
  return gardens
}

const encode = encodeGrid
const encodePairs = (pairs, key) => `[\n${pairs.map((pair) => `      { color: '${pair.color}', ${key}: [${pair[key].map((cell) => `[${cell.join(', ')}]`).join(', ')}] },`).join('\n')}\n    ]`

function source(name, prefix, gardens) {
  return `// Generated by scripts/generate-pilgrims.mjs --seed=${SEED}. Do not edit by hand.
// Each garden is solvable by always taking the easiest move, shrines and docks included.
export const ${name} = [
${gardens.map(({ puzzle, solution, pilgrims, ferries }, index) => `  {
    id: '${prefix}-${String(index + 1).padStart(2, '0')}',
    puzzle: ${encode(puzzle)},
    solution: ${encode(solution)},
    pilgrims: ${encodePairs(pilgrims, 'shrines')},${ferries.length ? `\n    ferries: ${encodePairs(ferries, 'docks')},` : ''}
  },`).join('\n')}
]
`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Each chapter has its own seed, so either can be rebuilt on its own (--chapter=pilgrims|crossings).
  const chapters = [
    { name: 'pilgrims', levels: PILGRIM_LEVELS, label: 'Pilgrims', constant: 'PILGRIM_PUZZLES', file: 'src/pilgrimPuzzles.js', seed: SEED },
    { name: 'crossings', levels: CROSSING_LEVELS, label: 'Crossings', constant: 'CROSSING_PUZZLES', file: 'src/crossingPuzzles.js', seed: SEED + 1 },
  ].filter((chapter) => !args.chapter || chapter.name === args.chapter)
  for (const chapter of chapters) {
    const gardens = generate(chapter.levels, chapter.label, random(chapter.seed))
    if (args.output) writeFileSync(chapter.file, source(chapter.constant, chapter.name, gardens))
  }
  if (!args.output) console.log('\nDry run. Add --output to write src/pilgrimPuzzles.js and src/crossingPuzzles.js.')
}
