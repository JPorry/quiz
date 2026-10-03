import test from 'node:test'
import assert from 'node:assert/strict'
import { FERRY_PUZZLES } from '../src/ferryPuzzles.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { passage, ferries, ferryViolations, ferriesHold, channels } from '../src/ferries.js'
import { GardenGame, GARDENS, CHAPTERS, GARDEN_NAMES, chapterOf, findHint, copyGrid } from '../src/game.js'
import { FERRY_LEVELS, measureFerries, ferryDifficulty, ferryMoves } from '../scripts/generate-ferries.mjs'

const empty = () => Array.from({ length: 10 }, () => Array(10).fill(null))

test('the ferry chapter follows the lighthouses, every garden with a name', () => {
  assert.equal(FERRY_PUZZLES.length, 30)
  assert.equal(GARDENS.length, 210)
  assert.equal(GARDEN_NAMES.length, GARDENS.length)
  assert.equal(chapterOf(90).name, 'The Ferries')
  assert.ok(CHAPTERS[4].intro)
})

test('a passage runs by water from beside one dock to beside the other', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][4] = 1
  grid[1][0] = 0; grid[1][1] = 0; grid[1][2] = 0; grid[1][3] = 0; grid[1][4] = 0
  assert.deepEqual(passage(grid, [[0, 0], [0, 4]]), [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]])
  grid[1][2] = 1
  assert.equal(passage(grid, [[0, 0], [0, 4]]), null)
})

test('docks are joined only by water, stranded once land cuts every way, and channels are forced', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][1] = 1; grid[0][2] = 1; grid[1][1] = 1
  const route = { color: 'coral', docks: [[0, 0], [0, 2]] }
  const [state] = ferries(grid, [route])
  assert.equal(state.complete, false)
  assert.equal(state.stranded, false)
  // From the corner dock the only way out is down through (1, 0) and (2, 0).
  assert.deepEqual(channels(grid, [route]).map(String).sort(), ['1,0', '2,0'].sort())
  grid[2][0] = 1
  assert.ok(ferryViolations(grid, [route]).has('0:0'))
  assert.ok(ferryViolations(grid, [route]).has('0:2'))
  grid[2][0] = 0; grid[1][0] = 0; grid[2][1] = 0; grid[2][2] = 0; grid[1][2] = 0
  assert.ok(ferriesHold(grid, [route]))
})

test('every dock stands on starting land, and each pair is joined in the answer', () => {
  for (const [index, garden] of FERRY_PUZZLES.entries()) {
    for (const { docks } of garden.ferries) for (const [r, c] of docks) assert.equal(garden.puzzle[r][c], 1, `Garden ${index + 91} dock starts on land`)
    assert.ok(ferriesHold(garden.solution, garden.ferries))
    assert.equal(new Set(garden.ferries.map(({ color }) => color)).size, garden.ferries.length, 'each pair has its own color')
  }
})

test('every ferry garden is reached by sound deductions alone, and needs its ferries', () => {
  for (const [index, garden] of FERRY_PUZZLES.entries()) {
    const { solved, grid } = solveLikeAPlayer(garden.puzzle, undefined, { ferries: garden.ferries })
    assert.ok(solved, `Garden ${index + 91} stalls`)
    assert.deepEqual(grid, garden.solution)
    // Played with the moves the garden is built around, it can't be finished without its ferries.
    assert.equal(solveLikeAPlayer(garden.puzzle, FERRY_LEVELS[index].allowed).solved, false, `Garden ${index + 91} needs its ferries`)
  }
})

test('ferries carry real weight, and the chapter grows harder', () => {
  const stats = FERRY_PUZZLES.map((garden) => measureFerries(garden.puzzle, garden.ferries))
  stats.forEach((s, i) => {
    assert.ok(ferryMoves(s) >= 3, `Garden ${i + 91} leans on its ferries`)
    assert.ok(s.bottlenecks <= Math.max(1, s.rounds * 0.2), `Garden ${i + 91} rarely stalls`)
  })
  stats.slice(1).forEach((s, i) => assert.ok(ferryDifficulty(s) > ferryDifficulty(stats[i]), `Garden ${i + 92} is harder than garden ${i + 91}`))
  assert.ok(stats.slice(0, 3).every((s) => s.count + s.line === 0), 'the chapter opens gently')
})

test('a garden only counts as finished when every pair of docks is joined', () => {
  const game = new GardenGame(null)
  game.load(90)
  game.grid = copyGrid(game.puzzle.solution)
  assert.equal(game.complete, true)
  // Docks with no water around them at all can never be joined.
  game.puzzle = { ...game.puzzle, ferries: [{ color: 'coral', docks: [[-5, -5], [-5, -5]] }] }
  assert.equal(game.complete, false)
})

test('hints explain the ferry move and walk every garden to its answer', () => {
  for (const garden of FERRY_PUZZLES) {
    const working = copyGrid(garden.puzzle)
    const techniques = new Set()
    for (let move = findHint(working, garden.solution, garden); move; move = findHint(working, garden.solution, garden)) {
      working[move.row][move.col] = move.value
      techniques.add(move.technique)
    }
    assert.deepEqual(working, garden.solution)
    assert.ok(techniques.has('channel'))
  }
})
