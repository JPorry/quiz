// Builds the "Villages" chapter: thirty gardens whose islands carry census signs.
//
// A sign on a starting land tile shows how many land tiles its island holds. Each garden starts
// from a finished one, signs a handful of its smaller islands, then carves starting tiles away for
// as long as a player could still solve it by always taking the easiest move, signs included.
//
//   node scripts/generate-villages.mjs [--seed=20261004] [--candidates=16] [--output=src/villagePuzzles.js]
import { writeFileSync } from 'node:fs'
import { random, shuffle, randomSolution } from './generate-gardens.mjs'
import { solveLikeAPlayer } from '../src/solver.js'
import { islandAt, censusHolds } from '../src/census.js'
import { parseArgs, rampLevels, gather, climb, climbStart, encodeGrid } from './chapter.mjs'

const args = parseArgs()
const SEED = Number(args.seed ?? 20261004)
const CANDIDATES = Number(args.candidates ?? 16)
const SIZE = 10

const VILLAGE = ['seal', 'apart', 'grow']
// Each garden's techniques, the fewest starting tiles it may keep, and how many islands it signs.
export const VILLAGE_LEVELS = rampLevels({ moves: VILLAGE, clues: { signs: [6, 9] } })

export function measureVillages(puzzle, signs) {
  const { solved, steps } = solveLikeAPlayer(puzzle, undefined, { flow: true, signs })
  const count = (technique) => steps.filter((step) => step.technique === technique).length
  const rounds = steps.length
  return {
    solved, rounds, signs: signs.length,
    givens: puzzle.flat().filter((value) => value !== null).length,
    seal: count('seal'), apart: count('apart'), grow: count('grow'), pair: count('pair'), gap: count('gap'), count: count('count'), line: count('line'),
    bottlenecks: steps.filter((step) => step.options === 1).length,
    flow: steps.reduce((sum, step) => sum + Math.min(step.options, 6), 0) / Math.max(1, rounds),
  }
}

// Sparser gardens that lean on whole-line reasoning rank harder; more signs make one easier.
export const villageDifficulty = (stats) => stats.line * 10 + stats.count * 2 + (100 - stats.givens) * 0.5 - stats.signs * 0.5
export const villageMoves = (stats) => stats.seal + stats.apart + stats.grow

// Signs go on smaller islands, one each, on a random tile of the island.
function chooseSigns(solution, count, rng) {
  const seen = new Set()
  const islands = []
  for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
    if (solution[row][col] !== 1 || seen.has(row * SIZE + col)) continue
    const island = islandAt(solution, row, col)
    island.keys.forEach((key) => seen.add(key))
    if (island.cells.length <= 7) islands.push(island.cells)
  }
  return shuffle(islands, rng).slice(0, count).map((cells) => ({ cell: cells[Math.floor(rng() * cells.length)], size: cells.length }))
}

function candidate(level, rng) {
  const solution = randomSolution(rng)
  const signs = chooseSigns(solution, level.signs, rng)
  const signed = new Set(signs.map(({ cell: [r, c] }) => r * SIZE + c))
  const puzzle = solution.map((row) => [...row])
  let remaining = SIZE * SIZE
  for (const index of shuffle([...Array(SIZE * SIZE).keys()], rng)) {
    // Past its target, a garden keeps carving only until it can't be finished without its signs.
    if (remaining <= level.givens && !solveLikeAPlayer(puzzle, level.allowed).solved) break
    // Signed tiles always start in place: the sign stands on them.
    if (signed.has(index)) continue
    const row = Math.floor(index / SIZE), col = index % SIZE
    const value = puzzle[row][col]
    puzzle[row][col] = null
    if (solveLikeAPlayer(puzzle, level.allowed, { signs }).solved) remaining--
    else puzzle[row][col] = value
  }
  signs.sort((a, b) => a.cell[0] - b.cell[0] || a.cell[1] - b.cell[1])
  return { solution, puzzle, signs, stats: measureVillages(puzzle, signs) }
}

const flowScore = (stats) => stats.flow - stats.bottlenecks * 0.35 + villageMoves(stats) * 0.06

function generate() {
  const rng = random(SEED)
  const pools = VILLAGE_LEVELS.map((level, index) => {
    const pool = gather(() => candidate(level, rng), ({ puzzle, solution, signs, stats }) =>
      // The signs must carry real weight, and the garden can't be finished without them.
      stats.solved && villageMoves(stats) >= 4 && stats.signs >= level.signs - 1 && censusHolds(solution, signs)
      && !solveLikeAPlayer(puzzle, level.allowed).solved && stats.bottlenecks <= Math.max(1, stats.rounds * 0.2), { size: CANDIDATES })
    if (!pool.length) throw new Error(`No garden met the targets for village garden ${index + 1}`)
    return pool
  })
  const gardens = climb(pools, ({ stats }) => villageDifficulty(stats), ({ stats }) => flowScore(stats), climbStart(VILLAGE_LEVELS))
  gardens.forEach(({ stats: s }, index) => {
    console.log(`Villages ${String(index + 1).padStart(2)}: ${s.givens} tiles, ${s.signs} signs, ${s.rounds} rounds (seal ${s.seal}, apart ${s.apart}, grow ${s.grow}, pair ${s.pair}, gap ${s.gap}, count ${s.count}, line ${s.line}), ${s.bottlenecks} bottlenecks, flow ${s.flow.toFixed(2)}, difficulty ${villageDifficulty(s).toFixed(1)}`)
  })
  return gardens
}

const encode = encodeGrid
const encodeSigns = (signs) => `[\n${signs.map(({ cell, size }) => `      { cell: [${cell.join(', ')}], size: ${size} },`).join('\n')}\n    ]`

if (import.meta.url === `file://${process.argv[1]}`) {
  const gardens = generate()
  const source = `// Generated by scripts/generate-villages.mjs --seed=${SEED}. Do not edit by hand.
// Each garden is solvable by always taking the easiest move, census signs included.
export const VILLAGE_PUZZLES = [
${gardens.map(({ puzzle, solution, signs }, index) => `  {
    id: 'villages-${String(index + 1).padStart(2, '0')}',
    puzzle: ${encode(puzzle)},
    solution: ${encode(solution)},
    signs: ${encodeSigns(signs)},
  },`).join('\n')}
]
`
  if (args.output) writeFileSync(args.output, source)
  else console.log('\nDry run. Add --output=src/villagePuzzles.js to write the gardens.')
}
