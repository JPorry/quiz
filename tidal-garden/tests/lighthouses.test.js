import test from 'node:test'
import assert from 'node:assert/strict'
import { LIGHTHOUSE_PUZZLES } from '../src/lighthousePuzzles.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { beam, lighthouses, lighthouseViolations, lighthousesHold } from '../src/lighthouses.js'
import { GardenGame, GARDENS, CHAPTERS, GARDEN_NAMES, chapterOf, findHint, copyGrid } from '../src/game.js'
import { measureLights, lightDifficulty, lightMoves } from '../scripts/generate-lighthouses.mjs'

const empty = () => Array.from({ length: 10 }, () => Array(10).fill(null))

test('the lighthouse chapter follows the villages, every garden with a name', () => {
  assert.equal(LIGHTHOUSE_PUZZLES.length, 10)
  assert.equal(GARDENS.length, 40)
  assert.equal(GARDEN_NAMES.length, GARDENS.length)
  assert.equal(chapterOf(30).name, 'The Lighthouses')
  assert.ok(CHAPTERS.at(-1).intro)
})

test('a beam counts water until land or the edge stops it, and waits at undecided tiles', () => {
  const grid = empty()
  grid[5][5] = 1
  grid[5][6] = 0; grid[5][7] = 0; grid[5][8] = 1
  const east = beam(grid, [5, 5], [0, 1])
  assert.equal(east.lit.length, 2)
  assert.equal(east.open, null)
  assert.equal(east.reach, 2)
  grid[4][5] = 0
  const north = beam(grid, [5, 5], [-1, 0])
  assert.equal(north.lit.length, 1)
  assert.deepEqual(north.open, [3, 5])
  assert.equal(north.reach, 5, 'could see to the edge if the rest is water')
})

test('a lighthouse is lit only when every beam is settled at exactly its number', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][1] = 0; grid[0][2] = 1; grid[1][0] = 0; grid[2][0] = 0; grid[3][0] = 1
  const light = { cell: [0, 0], sees: 3 }
  assert.ok(lighthousesHold(grid, [light]))
  assert.equal(lighthouseViolations(grid, [{ ...light, sees: 2 }]).has('0:0'), true, 'sees too much')
  assert.equal(lighthouseViolations(grid, [{ ...light, sees: 4 }]).has('0:0'), true, 'can no longer see enough')
  grid[3][0] = null
  const [state] = lighthouses(grid, [light])
  assert.equal(state.complete, false, 'an open beam is not settled')
})

test('every lighthouse stands on land and counts its water in the answer', () => {
  for (const [index, garden] of LIGHTHOUSE_PUZZLES.entries()) {
    for (const light of garden.lights) assert.equal(garden.puzzle[light.cell[0]][light.cell[1]], 1, `Garden ${index + 31} lighthouse starts on land`)
    assert.ok(lighthousesHold(garden.solution, garden.lights))
  }
})

test('every lighthouse garden is reached by sound deductions alone, and needs its lighthouses', () => {
  for (const [index, garden] of LIGHTHOUSE_PUZZLES.entries()) {
    const { solved, grid } = solveLikeAPlayer(garden.puzzle, undefined, { lights: garden.lights })
    assert.ok(solved, `Garden ${index + 31} stalls`)
    assert.deepEqual(grid, garden.solution)
    assert.equal(solveLikeAPlayer(garden.puzzle).solved, false, `Garden ${index + 31} needs its lighthouses`)
  }
})

test('lighthouses carry real weight, and the chapter grows harder', () => {
  const stats = LIGHTHOUSE_PUZZLES.map((garden) => measureLights(garden.puzzle, garden.lights))
  stats.forEach((s, i) => {
    assert.ok(lightMoves(s) >= 4, `Garden ${i + 31} leans on its lighthouses`)
    assert.ok(s.bottlenecks <= Math.max(1, s.rounds * 0.2), `Garden ${i + 31} rarely stalls`)
  })
  stats.slice(1).forEach((s, i) => assert.ok(lightDifficulty(s) > lightDifficulty(stats[i]), `Garden ${i + 32} is harder than garden ${i + 31}`))
  assert.ok(stats.slice(0, 3).every((s) => s.count + s.line === 0), 'the chapter opens gently')
})

test('a garden only counts as finished when every lighthouse matches its number', () => {
  const game = new GardenGame(null)
  game.load(30)
  game.grid = copyGrid(game.puzzle.solution)
  assert.equal(game.complete, true)
  const light = game.puzzle.lights[0]
  game.puzzle = { ...game.puzzle, lights: [{ ...light, sees: light.sees + 1 }] }
  assert.equal(game.complete, false)
})

test('hints explain the lighthouse moves and walk every garden to its answer', () => {
  for (const garden of LIGHTHOUSE_PUZZLES) {
    const working = copyGrid(garden.puzzle)
    const techniques = new Set()
    for (let move = findHint(working, garden.solution, garden); move; move = findHint(working, garden.solution, garden)) {
      working[move.row][move.col] = move.value
      techniques.add(move.technique)
    }
    assert.deepEqual(working, garden.solution)
    assert.ok(techniques.has('block') || techniques.has('shine'))
  }
})
