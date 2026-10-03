// Builds the "Bridges & Shorelines" chapter: ten gardens whose edges carry hints.
//
// A footbridge joins two land tiles; a shoreline runs between land and water. Each garden starts
// from a finished one, scatters a set of those hints, then carves starting tiles away for as long
// as a player could still solve it by always taking the easiest move, hints included.
//
//   node scripts/generate-shores.mjs [--seed=20261003] [--candidates=16] [--output=src/shorePuzzles.js]
import { writeFileSync } from 'node:fs'
import { random, shuffle, randomSolution } from './generate-gardens.mjs'
import { solveLikeAPlayer } from '../src/solver.js'
import { possibleHints, countSolutions } from '../src/hints.js'

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')))
const SEED = Number(args.seed ?? 20261003)
const CANDIDATES = Number(args.candidates ?? 16)
const SIZE = 10

const HINTED = ['bridge', 'shore']
const BASIC = [...HINTED, 'pair', 'gap']
const COUNTING = [...BASIC, 'count']
const ALL = [...COUNTING, 'line']

// Each garden's techniques, the fewest starting tiles it may keep, and how many hints it scatters.
export const SHORE_LEVELS = [
  { allowed: BASIC, givens: 30, shores: 24, bridges: 5 },
  { allowed: BASIC, givens: 26, shores: 22, bridges: 5 },
  { allowed: BASIC, givens: 22, shores: 21, bridges: 4 },
  { allowed: COUNTING, givens: 20, shores: 20, bridges: 4 },
  { allowed: COUNTING, givens: 16, shores: 19, bridges: 4 },
  { allowed: ALL, givens: 14, shores: 18, bridges: 3 },
  { allowed: ALL, givens: 10, shores: 18, bridges: 3 },
  { allowed: ALL, givens: 6, shores: 17, bridges: 3 },
  { allowed: ALL, givens: 3, shores: 16, bridges: 2 },
  { allowed: ALL, givens: 0, shores: 16, bridges: 2 },
]

export function measureHinted(puzzle, hints) {
  const { solved, steps } = solveLikeAPlayer(puzzle, undefined, { flow: true, hints })
  const count = (technique) => steps.filter((step) => step.technique === technique).length
  const rounds = steps.length
  return {
    solved, rounds, hints: hints.length,
    givens: puzzle.flat().filter((value) => value !== null).length,
    bridge: count('bridge'), shore: count('shore'), pair: count('pair'), gap: count('gap'), count: count('count'), line: count('line'),
    bottlenecks: steps.filter((step) => step.options === 1).length,
    flow: steps.reduce((sum, step) => sum + Math.min(step.options, 6), 0) / Math.max(1, rounds),
  }
}

// Sparser gardens that lean on whole-line reasoning rank harder.
export const hintedDifficulty = (stats) => stats.line * 10 + stats.count * 2 + (100 - stats.givens) * 0.5 - stats.hints * 0.4

function candidate(level, rng) {
  const solution = randomSolution(rng)
  const pool = shuffle(possibleHints(solution), rng)
  const hints = [...pool.filter((hint) => hint.kind === 'shore').slice(0, level.shores), ...pool.filter((hint) => hint.kind === 'bridge').slice(0, level.bridges)]
  const puzzle = solution.map((row) => [...row])
  let remaining = SIZE * SIZE
  for (const index of shuffle([...Array(SIZE * SIZE).keys()], rng)) {
    if (remaining <= level.givens) break
    const row = Math.floor(index / SIZE), col = index % SIZE
    const value = puzzle[row][col]
    puzzle[row][col] = null
    if (solveLikeAPlayer(puzzle, level.allowed, { hints }).solved) remaining--
    else puzzle[row][col] = value
  }
  // Tiles under a footbridge never need to start in place: the bridge already says they are land.
  for (const hint of hints) if (hint.kind === 'bridge') for (const [r, c] of hint.cells) puzzle[r][c] = null
  hints.sort((a, b) => a.cells[0][0] - b.cells[0][0] || a.cells[0][1] - b.cells[0][1] || a.cells[1][0] - b.cells[1][0])
  return { solution, puzzle, hints, stats: measureHinted(puzzle, hints) }
}

const flowScore = (stats) => stats.flow - stats.bottlenecks * 0.35 + stats.shore * 0.08

function generate() {
  const rng = random(SEED)
  const gardens = []
  SHORE_LEVELS.forEach((level, index) => {
    let best = null
    for (let attempt = 0; attempt < CANDIDATES * 30 && (!best || attempt < CANDIDATES); attempt++) {
      const next = candidate(level, rng)
      const { stats } = next
      // Shorelines must carry real weight in every garden of this chapter.
      if (!stats.solved || stats.shore < 4) continue
      if (level.allowed.includes('line') && index >= 7 && stats.line < 1) continue
      if (gardens.length && hintedDifficulty(stats) <= hintedDifficulty(gardens.at(-1).stats)) continue
      if (!best || flowScore(stats) > flowScore(best.stats)) best = next
    }
    if (!best) throw new Error(`No garden met the targets for shoreline garden ${index + 1}`)
    if (countSolutions(best.puzzle, best.hints) !== 1) throw new Error(`Shoreline garden ${index + 1} is not unique`)
    gardens.push(best)
    const s = best.stats
    console.log(`Shores ${String(index + 1).padStart(2)}: ${s.givens} tiles, ${s.hints} hints, ${s.rounds} rounds (bridge ${s.bridge}, shore ${s.shore}, pair ${s.pair}, gap ${s.gap}, count ${s.count}, line ${s.line}), ${s.bottlenecks} bottlenecks, flow ${s.flow.toFixed(2)}`)
  })
  return gardens
}

const encode = (grid) => `[\n${grid.map((row) => `      [${row.map((value) => value ?? 'null').join(', ')}],`).join('\n')}\n    ]`
const encodeHints = (hints) => `[\n${hints.map(({ kind, cells }) => `      { kind: '${kind}', cells: [[${cells[0].join(', ')}], [${cells[1].join(', ')}]] },`).join('\n')}\n    ]`

if (import.meta.url === `file://${process.argv[1]}`) {
  const gardens = generate()
  const source = `// Generated by scripts/generate-shores.mjs --seed=${SEED}. Do not edit by hand.
// Each garden is solvable by always taking the easiest move, footbridges and shorelines included.
export const SHORE_PUZZLES = [
${gardens.map(({ puzzle, solution, hints }, index) => `  {
    id: 'shores-${String(index + 1).padStart(2, '0')}',
    puzzle: ${encode(puzzle)},
    solution: ${encode(solution)},
    hints: ${encodeHints(hints)},
  },`).join('\n')}
]
`
  if (args.output) writeFileSync(args.output, source)
  else console.log('\nDry run. Add --output=src/shorePuzzles.js to write the gardens.')
}
