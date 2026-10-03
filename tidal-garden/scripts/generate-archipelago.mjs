// Builds "The Archipelago": thirty gardens that mix everything before them. Each garden carries two to
// four kinds of clue: village signs, lighthouses, ferry docks, and pilgrims' shrines.
//
// Each garden starts from a finished one and sets out its clues so they never crowd each other: a
// signed island fills with huts, so it carries nothing else, and every other clue keeps a tile's
// distance from the rest. It then carves starting tiles away for as long as a player could still
// solve it by always taking the easiest move, and the chapter is picked to climb in difficulty.
//
//   node scripts/generate-archipelago.mjs [--seed=20261011] [--candidates=16] [--debug] [--output]
import { writeFileSync } from 'node:fs'
import { random, shuffle, randomSolution } from './generate-gardens.mjs'
import { FERRY_COLORS } from './generate-ferries.mjs'
import { LANTERN_COLORS } from './generate-pilgrims.mjs'
import { solveLikeAPlayer } from '../src/solver.js'
import { islandAt, censusHolds } from '../src/census.js'
import { lighthouses, lighthousesHold } from '../src/lighthouses.js'
import { passage, ferriesHold } from '../src/ferries.js'
import { trail, pilgrimsHold } from '../src/pilgrims.js'
import { parseArgs, rampLevels, gather, climb, encodeGrid } from './chapter.mjs'

const args = parseArgs()
const SEED = Number(args.seed ?? 20261011)
const CANDIDATES = Number(args.candidates ?? 16)
const SIZE = 10

// The chapter opens with gardens that pair up a few kinds of clue, cycling through the mixes, then
// carries all four at once, more of each as it climbs.
const MIXES = [['signs', 'lights'], ['lights', 'docks', 'shrines'], ['signs', 'docks', 'shrines'], ['signs', 'lights', 'docks'], ['signs', 'lights', 'shrines']]
const OPENING = 10

// Each garden's techniques, the fewest starting tiles it may keep, and how many of each clue it sets out.
export const ARCHIPELAGO_LEVELS = rampLevels({
  moves: ['seal', 'apart', 'grow', 'block', 'shine', 'channel', 'trail'],
  givens: [[30, 24], [24, 16], [16, 0]],
  clues: { signs: [2, 3.4], lights: [2, 3.4], docks: [1, 2], shrines: [1, 2] },
}).map((level, i) => {
  if (i >= OPENING) return level
  const mix = MIXES[i % MIXES.length]
  return { ...level, ...Object.fromEntries(['signs', 'lights', 'docks', 'shrines'].map((kind) => [kind, mix.includes(kind) ? level[kind] : 0])) }
})

const KINDS = { signs: ['seal', 'apart', 'grow'], lights: ['block', 'shine'], ferries: ['channel'], pilgrims: ['trail'] }

export function measureArchipelago(puzzle, clues) {
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

export const archipelagoDifficulty = (stats) => stats.line * 10 + stats.count * 2 + (100 - stats.givens) * 0.5 - stats.clues * 0.5

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
  }, 4, LANTERN_COLORS, 'shrines')
  return { signs, lights, ferries, pilgrims, taken }
}

export function candidate(level, rng) {
  const solution = randomSolution(rng)
  const { taken, ...clues } = chooseClues(solution, level, rng)
  const fixed = new Set(taken.map(([r, c]) => r * SIZE + c))
  const puzzle = solution.map((row) => [...row])
  let remaining = SIZE * SIZE
  for (const index of shuffle([...Array(SIZE * SIZE).keys()], rng)) {
    // Past its target, a garden keeps carving only until it can't be finished without its clues.
    if (remaining <= level.givens && !solveLikeAPlayer(puzzle, level.allowed).solved) break
    // Every clue stands on its own tile, which always starts in place.
    if (fixed.has(index)) continue
    const row = Math.floor(index / SIZE), col = index % SIZE
    const value = puzzle[row][col]
    puzzle[row][col] = null
    if (solveLikeAPlayer(puzzle, level.allowed, clues).solved) remaining--
    else puzzle[row][col] = value
  }
  return { solution, puzzle, ...clues, stats: measureArchipelago(puzzle, clues) }
}

const flowScore = (stats) => stats.flow - stats.bottlenecks * 0.35 + (stats.signs + stats.lights + stats.ferries + stats.pilgrims) * 0.06

// Every kind of clue a garden sets out has to pull its weight in the solve.
function carries(level, garden) {
  const { stats } = garden
  const wanted = { signs: level.signs, lights: level.lights, ferries: level.docks, pilgrims: level.shrines }
  return Object.entries(wanted).every(([kind, count]) => garden[kind].length === count && (!count || stats[kind] >= 1))
    && stats.signs + stats.lights + stats.ferries + stats.pilgrims >= 4
}

function generate(levels, rng) {
  const pools = levels.map((level, index) => {
    const pool = gather(() => candidate(level, rng), (next) => {
      const { stats } = next
      if (!stats.solved || !carries(level, next)) return false
      if (solveLikeAPlayer(next.puzzle, level.allowed).solved) return false
      // A garden that keeps leaving the player with a single move to find is a slog, not a puzzle.
      if (stats.bottlenecks > Math.max(1, stats.rounds * 0.2)) return false
      if (!censusHolds(next.solution, next.signs) || !lighthousesHold(next.solution, next.lights) || !ferriesHold(next.solution, next.ferries) || !pilgrimsHold(next.solution, next.pilgrims)) {
        throw new Error(`Archipelago garden ${index + 1} breaks its own clues`)
      }
      return true
    }, { size: CANDIDATES })
    if (args.debug) console.log('Archipelago', index + 1, pool.length, pool.map((g) => archipelagoDifficulty(g.stats).toFixed(0)).sort((a, b) => a - b).join(' '))
    if (!pool.length) throw new Error(`No garden met the targets for archipelago garden ${index + 1}`)
    return pool
  })
  const gardens = climb(pools, ({ stats }) => archipelagoDifficulty(stats), ({ stats }) => flowScore(stats))
  gardens.forEach((garden, index) => {
    const s = garden.stats
    console.log(`Archipelago ${String(index + 1).padStart(2)}: ${s.givens} tiles, ${garden.signs.length} signs, ${garden.lights.length} lights, ${garden.ferries.length} docks, ${garden.pilgrims.length} shrines, ${s.rounds} rounds (signs ${s.signs}, lights ${s.lights}, ferries ${s.ferries}, pilgrims ${s.pilgrims}, pair ${s.pair}, gap ${s.gap}, count ${s.count}, line ${s.line}), ${s.bottlenecks} bottlenecks, flow ${s.flow.toFixed(2)}, difficulty ${archipelagoDifficulty(s).toFixed(1)}`)
  })
  return gardens
}

const encode = encodeGrid
const cell = ([r, c]) => `[${r}, ${c}]`
const list = (items, format) => `[\n${items.map((item) => `      ${format(item)},`).join('\n')}\n    ]`

if (import.meta.url === `file://${process.argv[1]}`) {
  const gardens = generate(ARCHIPELAGO_LEVELS, random(SEED))
  const source = `// Generated by scripts/generate-archipelago.mjs --seed=${SEED}. Do not edit by hand.
// Each garden is solvable by always taking the easiest move, every kind of clue included.
export const ARCHIPELAGO_PUZZLES = [
${gardens.map(({ puzzle, solution, signs, lights, ferries, pilgrims }, index) => `  {
    id: 'archipelago-${String(index + 1).padStart(2, '0')}',
    puzzle: ${encode(puzzle)},
    solution: ${encode(solution)},${signs.length ? `\n    signs: ${list(signs, ({ cell: c, size }) => `{ cell: ${cell(c)}, size: ${size} }`)},` : ''}${lights.length ? `\n    lights: ${list(lights, ({ cell: c, sees }) => `{ cell: ${cell(c)}, sees: ${sees} }`)},` : ''}${ferries.length ? `\n    ferries: ${list(ferries, ({ color, docks }) => `{ color: '${color}', docks: [${docks.map(cell).join(', ')}] }`)},` : ''}${pilgrims.length ? `\n    pilgrims: ${list(pilgrims, ({ color, shrines }) => `{ color: '${color}', shrines: [${shrines.map(cell).join(', ')}] }`)},` : ''}
  },`).join('\n')}
]
`
  if (args.output) writeFileSync('src/archipelagoPuzzles.js', source)
  else console.log('\nDry run. Add --output to write src/archipelagoPuzzles.js.')
}
