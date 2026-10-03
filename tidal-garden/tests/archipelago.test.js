import test from 'node:test'
import assert from 'node:assert/strict'
import { ARCHIPELAGO_PUZZLES } from '../src/archipelagoPuzzles.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { censusHolds, islandAt } from '../src/census.js'
import { lighthousesHold } from '../src/lighthouses.js'
import { ferriesHold } from '../src/ferries.js'
import { pilgrimsHold } from '../src/pilgrims.js'
import { GardenGame, GARDENS, GARDEN_NAMES, chapterOf, findHint, copyGrid } from '../src/game.js'
import { ARCHIPELAGO_LEVELS, measureArchipelago, archipelagoDifficulty } from '../scripts/generate-archipelago.mjs'

const START = 180
const clues = (garden) => ({ signs: garden.signs ?? [], lights: garden.lights ?? [], ferries: garden.ferries ?? [], pilgrims: garden.pilgrims ?? [] })
const kinds = (garden) => Object.entries(clues(garden)).filter(([, list]) => list.length).map(([kind]) => kind)

test('the archipelago closes the game, every garden with a name', () => {
  assert.equal(ARCHIPELAGO_PUZZLES.length, 30)
  assert.equal(GARDENS.length, 210)
  assert.equal(GARDEN_NAMES.length, GARDENS.length)
  assert.equal(chapterOf(START).name, 'The Archipelago')
  assert.equal(chapterOf(GARDENS.length - 1).name, 'The Archipelago')
})

test('every archipelago garden mixes kinds of clue, and the chapter uses all four', () => {
  ARCHIPELAGO_PUZZLES.forEach((garden, i) => assert.ok(kinds(garden).length >= 2, `Garden ${START + i + 1} mixes clues`))
  assert.deepEqual(new Set(ARCHIPELAGO_PUZZLES.flatMap(kinds)), new Set(['signs', 'lights', 'ferries', 'pilgrims']))
  assert.ok(ARCHIPELAGO_PUZZLES.some((garden) => kinds(garden).length === 4), 'some gardens carry all four')
})

test('clues keep clear of each other, and village islands carry nothing else', () => {
  for (const [i, garden] of ARCHIPELAGO_PUZZLES.entries()) {
    const { signs, lights, ferries, pilgrims } = clues(garden)
    const others = [...lights.map((l) => l.cell), ...ferries.flatMap((f) => f.docks), ...pilgrims.flatMap((p) => p.shrines)]
    const all = [...signs.map((s) => s.cell), ...others]
    for (const [r, c] of all) assert.equal(garden.puzzle[r][c], 1, `Garden ${START + i + 1} clue starts on land`)
    assert.equal(new Set(all.map(String)).size, all.length, 'no two clues share a tile')
    for (const sign of signs) {
      const island = islandAt(garden.solution, ...sign.cell)
      for (const [r, c] of others) assert.ok(!island.keys.has(r * 10 + c), `Garden ${START + i + 1} village island stays clear`)
    }
  }
})

test('every archipelago garden holds all its clues in its answer, and is reached by sound deductions alone', () => {
  for (const [i, garden] of ARCHIPELAGO_PUZZLES.entries()) {
    const { signs, lights, ferries, pilgrims } = clues(garden)
    assert.ok(censusHolds(garden.solution, signs) && lighthousesHold(garden.solution, lights) && ferriesHold(garden.solution, ferries) && pilgrimsHold(garden.solution, pilgrims))
    const { solved, grid } = solveLikeAPlayer(garden.puzzle, undefined, clues(garden))
    assert.ok(solved, `Garden ${START + i + 1} stalls`)
    assert.deepEqual(grid, garden.solution)
    assert.equal(solveLikeAPlayer(garden.puzzle, ARCHIPELAGO_LEVELS[i].allowed).solved, false, `Garden ${START + i + 1} needs its clues`)
  }
})

test('every kind of clue pulls its weight, and the chapter grows harder', () => {
  const stats = ARCHIPELAGO_PUZZLES.map((garden) => measureArchipelago(garden.puzzle, clues(garden)))
  stats.forEach((s, i) => {
    for (const kind of kinds(ARCHIPELAGO_PUZZLES[i])) assert.ok(s[kind] >= 1, `Garden ${START + i + 1} uses its ${kind}`)
    assert.ok(s.bottlenecks <= Math.max(1, s.rounds * 0.2), `Garden ${START + i + 1} rarely stalls`)
  })
  stats.slice(1).forEach((s, i) => assert.ok(archipelagoDifficulty(s) > archipelagoDifficulty(stats[i]), `Garden ${START + i + 2} is harder than garden ${START + i + 1}`))
})

test('a mixed garden only counts as finished when every clue holds', () => {
  const index = ARCHIPELAGO_PUZZLES.findIndex((garden) => kinds(garden).length === 4)
  const game = new GardenGame(null)
  game.load(START + index)
  game.grid = copyGrid(game.puzzle.solution)
  assert.equal(game.complete, true)
  const sign = game.puzzle.signs[0]
  game.puzzle = { ...game.puzzle, signs: [{ ...sign, size: sign.size + 1 }, ...game.puzzle.signs.slice(1)] }
  assert.equal(game.complete, false)
})

test('hints walk every archipelago garden to its answer', () => {
  for (const garden of ARCHIPELAGO_PUZZLES) {
    const working = copyGrid(garden.puzzle)
    for (let move = findHint(working, garden.solution, clues(garden)); move; move = findHint(working, garden.solution, clues(garden))) working[move.row][move.col] = move.value
    assert.deepEqual(working, garden.solution)
  }
})
