// Builds the "Lighthouses" chapter: thirty gardens with lighthouses on some starting land tiles.
//
// A lighthouse's number counts the water tiles its light reaches straight up, down, left and right
// before land or the board's edge stops it. Each garden starts from a finished one, raises a few
// lighthouses, then carves starting tiles away for as long as a player could still solve it by
// always taking the easiest move, lighthouses included.
//
//   node scripts/generate-lighthouses.mjs [--seed=20261005] [--candidates=16] [--output=src/lighthousePuzzles.js]
import { writeFileSync } from 'node:fs'
import { random, shuffle, randomSolution } from './generate-gardens.mjs'
import { solveLikeAPlayer } from '../src/solver.js'
import { lighthouses, lighthousesHold } from '../src/lighthouses.js'
import { parseArgs, rampLevels, gather, climb, climbStart, encodeGrid } from './chapter.mjs'

const args = parseArgs()
const SEED = Number(args.seed ?? 20261005)
const CANDIDATES = Number(args.candidates ?? 16)
const SIZE = 10

const LIGHT = ['block', 'shine']
// Each garden's techniques, the fewest starting tiles it may keep, and how many lighthouses it raises.
export const LIGHT_LEVELS = rampLevels({ moves: LIGHT, clues: { lights: [5, 8] } })

export function measureLights(puzzle, lights) {
  const { solved, steps } = solveLikeAPlayer(puzzle, undefined, { flow: true, lights })
  const count = (technique) => steps.filter((step) => step.technique === technique).length
  const rounds = steps.length
  return {
    solved, rounds, lights: lights.length,
    givens: puzzle.flat().filter((value) => value !== null).length,
    block: count('block'), shine: count('shine'), pair: count('pair'), gap: count('gap'), count: count('count'), line: count('line'),
    bottlenecks: steps.filter((step) => step.options === 1).length,
    flow: steps.reduce((sum, step) => sum + Math.min(step.options, 6), 0) / Math.max(1, rounds),
  }
}

export const lightDifficulty = (stats) => stats.line * 10 + stats.count * 2 + (100 - stats.givens) * 0.5 - stats.lights * 0.5
export const lightMoves = (stats) => stats.block + stats.shine

// Lighthouses stand on land tiles that see a fair stretch of sea, spread around the garden.
function chooseLights(solution, count, rng) {
  const land = []
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (solution[row][col] === 1) land.push([row, col])
  const chosen = []
  for (const cell of shuffle(land, rng)) {
    if (chosen.length >= count) break
    const [state] = lighthouses(solution, [{ cell, sees: 0 }])
    if (state.seen < 2 || state.seen > 9) continue
    if (chosen.some(({ cell: [r, c] }) => Math.abs(r - cell[0]) + Math.abs(c - cell[1]) < 3)) continue
    chosen.push({ cell, sees: state.seen })
  }
  return chosen
}

function candidate(level, rng) {
  const solution = randomSolution(rng)
  const lights = chooseLights(solution, level.lights, rng)
  const towers = new Set(lights.map(({ cell: [r, c] }) => r * SIZE + c))
  const puzzle = solution.map((row) => [...row])
  let remaining = SIZE * SIZE
  for (const index of shuffle([...Array(SIZE * SIZE).keys()], rng)) {
    // Past its target, a garden keeps carving only until it can't be finished without its lighthouses.
    if (remaining <= level.givens && !solveLikeAPlayer(puzzle, level.allowed).solved) break
    // A lighthouse's own tile always starts in place: the tower stands on it.
    if (towers.has(index)) continue
    const row = Math.floor(index / SIZE), col = index % SIZE
    const value = puzzle[row][col]
    puzzle[row][col] = null
    if (solveLikeAPlayer(puzzle, level.allowed, { lights }).solved) remaining--
    else puzzle[row][col] = value
  }
  lights.sort((a, b) => a.cell[0] - b.cell[0] || a.cell[1] - b.cell[1])
  return { solution, puzzle, lights, stats: measureLights(puzzle, lights) }
}

const flowScore = (stats) => stats.flow - stats.bottlenecks * 0.35 + lightMoves(stats) * 0.06

function generate() {
  const rng = random(SEED)
  const pools = LIGHT_LEVELS.map((level, index) => {
    const pool = gather(() => candidate(level, rng), ({ puzzle, solution, lights, stats }) =>
      // The lighthouses must carry real weight, and the garden can't be finished without them.
      stats.solved && lightMoves(stats) >= 4 && stats.lights >= level.lights - 1 && lighthousesHold(solution, lights)
      && !solveLikeAPlayer(puzzle, level.allowed).solved && stats.bottlenecks <= Math.max(1, stats.rounds * 0.2), { size: CANDIDATES })
    if (!pool.length) throw new Error(`No garden met the targets for lighthouse garden ${index + 1}`)
    return pool
  })
  const gardens = climb(pools, ({ stats }) => lightDifficulty(stats), ({ stats }) => flowScore(stats), climbStart(LIGHT_LEVELS))
  gardens.forEach(({ stats: s }, index) => {
    console.log(`Lighthouses ${String(index + 1).padStart(2)}: ${s.givens} tiles, ${s.lights} lights, ${s.rounds} rounds (block ${s.block}, shine ${s.shine}, pair ${s.pair}, gap ${s.gap}, count ${s.count}, line ${s.line}), ${s.bottlenecks} bottlenecks, flow ${s.flow.toFixed(2)}, difficulty ${lightDifficulty(s).toFixed(1)}`)
  })
  return gardens
}

const encode = encodeGrid
const encodeLights = (lights) => `[\n${lights.map(({ cell, sees }) => `      { cell: [${cell.join(', ')}], sees: ${sees} },`).join('\n')}\n    ]`

if (import.meta.url === `file://${process.argv[1]}`) {
  const gardens = generate()
  const source = `// Generated by scripts/generate-lighthouses.mjs --seed=${SEED}. Do not edit by hand.
// Each garden is solvable by always taking the easiest move, lighthouses included.
export const LIGHTHOUSE_PUZZLES = [
${gardens.map(({ puzzle, solution, lights }, index) => `  {
    id: 'lighthouses-${String(index + 1).padStart(2, '0')}',
    puzzle: ${encode(puzzle)},
    solution: ${encode(solution)},
    lights: ${encodeLights(lights)},
  },`).join('\n')}
]
`
  if (args.output) writeFileSync(args.output, source)
  else console.log('\nDry run. Add --output=src/lighthousePuzzles.js to write the gardens.')
}
