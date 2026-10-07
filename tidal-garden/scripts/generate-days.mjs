// Builds Tidal Garden's daily gardens into src/days.js: every day has an easy, a medium and a
// hard garden, all on the same 10×10 board.
//
// - Easy gardens need only the balance rules: pairs, gaps and counting, never whole-line reasoning.
// - Medium gardens bring one kind of clue (village signs, lighthouses, ferry docks or pilgrims'
//   shrines, taking turns day by day) that the garden can't be finished without, still with no
//   whole-line reasoning.
// - Hard gardens mix two or more kinds of clue, start with few tiles, and need some whole-line
//   reasoning too.
//
// Each garden starts from a finished one, sets out its clues so they never crowd each other, then
// carves starting tiles away for as long as a player could still solve it by always taking the
// easiest move. Every garden is seeded by its day and difficulty, so adding more days never changes
// the ones already played.
//
//   node scripts/generate-days.mjs --days=400 --output=src/days.js
//   node scripts/generate-days.mjs --days=400 --tier=hard --json=hard.json   (one difficulty, for running side by side)
//   node scripts/generate-days.mjs --merge=easy.json,medium.json,hard.json --output=src/days.js
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs, random, shuffle, randomSolution, chooseClues, measure } from './garden-kit.mjs'
import { solveLikeAPlayer } from '../src/solver.js'
import { censusHolds } from '../src/census.js'
import { lighthousesHold } from '../src/lighthouses.js'
import { ferriesHold } from '../src/ferries.js'
import { pilgrimsHold } from '../src/pilgrims.js'
import { countBinarySolutions } from '../src/binaryLogic.js'

const args = parseArgs()
export const FIRST_DAY = '2026-10-07'
export const TIERS = ['easy', 'medium', 'hard']
const SIZE = 10

const BASIC = ['pair', 'gap', 'count']
const MOVES = { signs: ['seal', 'apart', 'grow'], lights: ['block', 'shine'], docks: ['channel'], shrines: ['trail'] }
const STAT = { signs: 'signs', lights: 'lights', docks: 'ferries', shrines: 'pilgrims' }
// Medium days take turns through the four kinds of clue; hard days through mixes of them.
export const MEDIUM_KINDS = [['signs'], ['lights'], ['docks'], ['shrines']]
export const HARD_KINDS = [['signs', 'lights'], ['docks', 'shrines'], ['signs', 'docks'], ['lights', 'shrines'], ['signs', 'shrines'], ['lights', 'docks'], ['signs', 'lights', 'docks', 'shrines']]
const COUNTS = { medium: { signs: 5, lights: 4, docks: 2, shrines: 2 }, hard: { signs: 3, lights: 3, docks: 2, shrines: 2 } }

// What a day's garden of each difficulty asks for.
export function plan(day, tier) {
  if (tier === 'easy') return { tier, kinds: [], allowed: BASIC, givens: 42 }
  const kinds = tier === 'medium' ? MEDIUM_KINDS[(day - 1) % MEDIUM_KINDS.length] : HARD_KINDS[(day - 1) % HARD_KINDS.length]
  const counts = Object.fromEntries(Object.keys(MOVES).map((kind) => [kind, kinds.includes(kind) ? COUNTS[tier][kind] : 0]))
  const allowed = [...kinds.flatMap((kind) => MOVES[kind]), ...BASIC, ...(tier === 'hard' ? ['line'] : [])]
  return { tier, kinds, allowed, givens: tier === 'medium' ? 26 : 14, ...counts }
}

// Takes tiles away one by one, keeping each removal only while the garden can still be solved
// with its techniques. Past its target it keeps carving only until its clues become necessary.
function carve(solution, level, clues, fixed, rng) {
  const puzzle = solution.map((row) => [...row])
  let remaining = SIZE * SIZE
  const hasClues = level.kinds.length > 0
  for (const index of shuffle([...Array(SIZE * SIZE).keys()], rng)) {
    if (remaining <= level.givens && (!hasClues || !solveLikeAPlayer(puzzle, level.allowed).solved)) break
    if (fixed.has(index)) continue
    const row = Math.floor(index / SIZE), col = index % SIZE
    const value = puzzle[row][col]
    puzzle[row][col] = null
    if (solveLikeAPlayer(puzzle, level.allowed, clues).solved) remaining--
    else puzzle[row][col] = value
  }
  return puzzle
}

function candidate(level, rng) {
  const solution = randomSolution(rng)
  const none = { signs: 0, lights: 0, docks: 0, shrines: 0 }
  const { taken, ...clues } = chooseClues(solution, { ...none, ...level }, rng)
  const fixed = new Set(taken.map(([r, c]) => r * SIZE + c))
  const puzzle = carve(solution, level, clues, fixed, rng)
  return { solution, puzzle, ...clues, stats: measure(puzzle, clues) }
}

// Whether a candidate is the garden this day asked for.
function accept(level, garden) {
  const { stats } = garden
  if (!stats.solved) return false
  if (stats.bottlenecks > Math.max(1, stats.rounds * 0.25)) return false
  if (level.tier === 'easy') return stats.line === 0 && stats.flow >= 2.5
  // Every kind of clue set out must be there in full and pull its weight.
  for (const kind of level.kinds) {
    const placed = garden[STAT[kind]].length
    if (placed !== level[kind] || stats[STAT[kind]] < (level.tier === 'medium' ? 2 : 1)) return false
  }
  // The garden can't be finished without its clues, not even with whole-line reasoning.
  if (solveLikeAPlayer(garden.puzzle, [...BASIC, 'line']).solved) return false
  if (level.tier === 'medium') return stats.line === 0
  return stats.line >= 2
}

export function makeGarden(day, tier) {
  const level = plan(day, tier)
  const rng = random(day * 7919 + TIERS.indexOf(tier) * 104729 + 20261007)
  for (let attempt = 1; ; attempt++) {
    const garden = candidate(level, rng)
    if (!accept(level, garden)) continue
    if (!censusHolds(garden.solution, garden.signs) || !lighthousesHold(garden.solution, garden.lights) || !ferriesHold(garden.solution, garden.ferries) || !pilgrimsHold(garden.solution, garden.pilgrims)) {
      throw new Error(`Day ${day} ${tier} breaks its own clues`)
    }
    if (!level.kinds.length && countBinarySolutions(garden.puzzle) !== 1) continue
    return { ...garden, attempts: attempt }
  }
}

// A garden packed small: its starting tiles as 100 characters (. for empty), then its clues as
// row-column digits: signs and lighthouses with their number, docks and shrines as pairs.
export function pack(garden) {
  const tiles = garden.puzzle.flat().map((value) => (value === null ? '.' : value)).join('')
  const out = { t: tiles }
  if (garden.signs.length) out.v = garden.signs.map(({ cell, size }) => `${cell[0]}${cell[1]}${size}`).join(' ')
  if (garden.lights.length) out.l = garden.lights.map(({ cell, sees }) => `${cell[0]}${cell[1]}${sees}`).join(' ')
  if (garden.ferries.length) out.f = garden.ferries.map(({ docks }) => docks.map(([r, c]) => `${r}${c}`).join('')).join(' ')
  if (garden.pilgrims.length) out.p = garden.pilgrims.map(({ shrines }) => shrines.map(([r, c]) => `${r}${c}`).join('')).join(' ')
  return out
}

function build(days, tiers) {
  const out = {}
  for (const tier of tiers) {
    out[tier] = []
    const started = Date.now()
    for (let day = 1; day <= days; day++) {
      const garden = makeGarden(day, tier)
      out[tier].push(pack(garden))
      if (args.verbose || day % 25 === 0) {
        const s = garden.stats
        console.log(`${tier} day ${day}: ${s.givens} tiles, ${s.clues} clues, ${s.rounds} rounds (line ${s.line}), ${garden.attempts} tries, ${((Date.now() - started) / day / 1000).toFixed(2)}s a garden`)
      }
    }
  }
  return out
}

function source(days) {
  const count = days.easy.length
  const rows = []
  for (let d = 0; d < count; d++) rows.push(`  [${TIERS.map((tier) => JSON.stringify(days[tier][d])).join(', ')}],`)
  return `// Generated by scripts/generate-days.mjs. Regenerate with \`npm run generate:days\`.
// Day 1 is FIRST_DAY. Each day has an easy, a medium and a hard garden: t is the starting tiles
// (100 characters, . for empty); v village signs and l lighthouses as row, column and number;
// f ferry docks and p pilgrims' shrines as pairs of row-column cells.
export const FIRST_DAY = '${FIRST_DAY}'
export const DAYS = [
${rows.join('\n')}
]
`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let days
  if (args.merge) {
    days = {}
    for (const file of String(args.merge).split(',')) Object.assign(days, JSON.parse(readFileSync(file, 'utf8')))
  } else {
    days = build(Number(args.days ?? 400), args.tier ? [args.tier] : TIERS)
  }
  if (args.json) writeFileSync(args.json, JSON.stringify(days))
  else if (args.output) writeFileSync(args.output, source(days))
  else console.log('\nDry run. Add --output=src/days.js to write the days.')
}
