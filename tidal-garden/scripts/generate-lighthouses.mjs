// Builds the "Lighthouses" chapter: ten gardens with lighthouses on some starting land tiles.
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

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')))
const SEED = Number(args.seed ?? 20261005)
const CANDIDATES = Number(args.candidates ?? 16)
const SIZE = 10

const LIGHT = ['block', 'shine']
const BASIC = [...LIGHT, 'pair', 'gap']
const COUNTING = [...BASIC, 'count']
const ALL = [...COUNTING, 'line']

// Each garden's techniques, the fewest starting tiles it may keep, and how many lighthouses it raises.
export const LIGHT_LEVELS = [
  { allowed: BASIC, givens: 30, lights: 5 },
  { allowed: BASIC, givens: 26, lights: 5 },
  { allowed: BASIC, givens: 22, lights: 6 },
  { allowed: COUNTING, givens: 20, lights: 6 },
  { allowed: COUNTING, givens: 16, lights: 6 },
  { allowed: ALL, givens: 14, lights: 7 },
  { allowed: ALL, givens: 10, lights: 7 },
  { allowed: ALL, givens: 6, lights: 7 },
  { allowed: ALL, givens: 3, lights: 7 },
  { allowed: ALL, givens: 0, lights: 8 },
]

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
    if (remaining <= level.givens) break
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
  const gardens = []
  LIGHT_LEVELS.forEach((level, index) => {
    let best = null
    for (let attempt = 0; attempt < CANDIDATES * 30 && (!best || attempt < CANDIDATES); attempt++) {
      const next = candidate(level, rng)
      const { stats } = next
      // The lighthouses must carry real weight in every garden of this chapter.
      if (!stats.solved || lightMoves(stats) < 4 || stats.lights < level.lights - 1) continue
      if (gardens.length && lightDifficulty(stats) <= lightDifficulty(gardens.at(-1).stats)) continue
      if (!best || flowScore(stats) > flowScore(best.stats)) best = next
    }
    if (!best) throw new Error(`No garden met the targets for lighthouse garden ${index + 1}`)
    if (!lighthousesHold(best.solution, best.lights)) throw new Error(`Lighthouse garden ${index + 1} breaks its own lighthouses`)
    gardens.push(best)
    const s = best.stats
    console.log(`Lighthouses ${String(index + 1).padStart(2)}: ${s.givens} tiles, ${s.lights} lights, ${s.rounds} rounds (block ${s.block}, shine ${s.shine}, pair ${s.pair}, gap ${s.gap}, count ${s.count}, line ${s.line}), ${s.bottlenecks} bottlenecks, flow ${s.flow.toFixed(2)}`)
  })
  return gardens
}

const encode = (grid) => `[\n${grid.map((row) => `      [${row.map((value) => value ?? 'null').join(', ')}],`).join('\n')}\n    ]`
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
