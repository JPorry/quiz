// Builds the "Villages" chapter: ten gardens whose islands carry census signs.
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

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')))
const SEED = Number(args.seed ?? 20261004)
const CANDIDATES = Number(args.candidates ?? 16)
const SIZE = 10

const VILLAGE = ['seal', 'apart', 'grow']
const BASIC = [...VILLAGE, 'pair', 'gap']
const COUNTING = [...BASIC, 'count']
const ALL = [...COUNTING, 'line']

// Each garden's techniques, the fewest starting tiles it may keep, and how many islands it signs.
export const VILLAGE_LEVELS = [
  { allowed: BASIC, givens: 30, signs: 6 },
  { allowed: BASIC, givens: 26, signs: 6 },
  { allowed: BASIC, givens: 22, signs: 7 },
  { allowed: COUNTING, givens: 20, signs: 7 },
  { allowed: COUNTING, givens: 16, signs: 7 },
  { allowed: ALL, givens: 14, signs: 8 },
  { allowed: ALL, givens: 10, signs: 8 },
  { allowed: ALL, givens: 6, signs: 8 },
  { allowed: ALL, givens: 3, signs: 8 },
  { allowed: ALL, givens: 0, signs: 9 },
]

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
    if (remaining <= level.givens) break
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
  const gardens = []
  VILLAGE_LEVELS.forEach((level, index) => {
    let best = null
    for (let attempt = 0; attempt < CANDIDATES * 30 && (!best || attempt < CANDIDATES); attempt++) {
      const next = candidate(level, rng)
      const { stats } = next
      // The signs must carry real weight in every garden of this chapter.
      if (!stats.solved || villageMoves(stats) < 4 || stats.signs < level.signs - 1) continue
      if (gardens.length && villageDifficulty(stats) <= villageDifficulty(gardens.at(-1).stats)) continue
      if (!best || flowScore(stats) > flowScore(best.stats)) best = next
    }
    if (!best) throw new Error(`No garden met the targets for village garden ${index + 1}`)
    if (!censusHolds(best.solution, best.signs)) throw new Error(`Village garden ${index + 1} breaks its own signs`)
    gardens.push(best)
    const s = best.stats
    console.log(`Villages ${String(index + 1).padStart(2)}: ${s.givens} tiles, ${s.signs} signs, ${s.rounds} rounds (seal ${s.seal}, apart ${s.apart}, grow ${s.grow}, pair ${s.pair}, gap ${s.gap}, count ${s.count}, line ${s.line}), ${s.bottlenecks} bottlenecks, flow ${s.flow.toFixed(2)}`)
  })
  return gardens
}

const encode = (grid) => `[\n${grid.map((row) => `      [${row.map((value) => value ?? 'null').join(', ')}],`).join('\n')}\n    ]`
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
