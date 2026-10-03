import test from 'node:test'
import assert from 'node:assert/strict'
import { VILLAGE_PUZZLES } from '../src/villagePuzzles.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { islandAt, villages, censusViolations, censusHolds } from '../src/census.js'
import { GardenGame, GARDENS, CHAPTERS, GARDEN_NAMES, chapterOf, findHint, copyGrid } from '../src/game.js'
import { measureVillages, villageDifficulty, villageMoves } from '../scripts/generate-villages.mjs'

const empty = () => Array.from({ length: 10 }, () => Array(10).fill(null))

test('the village chapter follows the first twenty gardens, every garden with a name', () => {
  assert.equal(VILLAGE_PUZZLES.length, 10)
  assert.equal(GARDENS.length, 30)
  assert.equal(GARDEN_NAMES.length, GARDENS.length)
  assert.deepEqual(CHAPTERS.map((chapter) => [chapter.start, chapter.count]), [[0, 20], [20, 10]])
  assert.equal(chapterOf(20).name, 'The Villages')
})

test('a village grows with its island, and is complete only when closed in at its number', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][1] = 1
  const sign = { cell: [0, 0], size: 3 }
  let [village] = villages(grid, [sign])
  assert.equal(village.cells.length, 2)
  assert.equal(village.complete, false)
  grid[1][1] = 1
  ;[village] = villages(grid, [sign])
  assert.equal(village.cells.length, 3)
  assert.equal(village.complete, false, 'still open to the sea of undecided tiles')
  grid[1][0] = 0; grid[0][2] = 0; grid[1][2] = 0; grid[2][1] = 0
  ;[village] = villages(grid, [sign])
  assert.equal(village.complete, true)
  assert.ok(censusHolds(grid, [sign]))
})

test('an island that outgrows its sign, or is closed in too small, is marked', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][1] = 1; grid[0][2] = 1
  assert.deepEqual([...censusViolations(grid, [{ cell: [0, 0], size: 2 }])].sort(), ['0:0', '0:1', '0:2'])
  const small = empty()
  small[0][0] = 1; small[0][1] = 0; small[1][0] = 0
  assert.ok(censusViolations(small, [{ cell: [0, 0], size: 3 }]).has('0:0'))
  assert.equal(censusViolations(small, [{ cell: [0, 0], size: 1 }]).size, 0)
  assert.equal(islandAt(small, 0, 0).sealed, true)
})

test('every sign stands on land and counts its island in the answer', () => {
  for (const [index, garden] of VILLAGE_PUZZLES.entries()) {
    for (const { cell: [r, c], size } of garden.signs) {
      assert.equal(garden.puzzle[r][c], 1, `Garden ${index + 21} sign starts on land`)
      assert.equal(islandAt(garden.solution, r, c).cells.length, size, `Garden ${index + 21} sign counts its island`)
    }
    assert.ok(censusHolds(garden.solution, garden.signs))
  }
})

test('every village garden is reached by sound deductions alone, so it has one answer', () => {
  for (const [index, garden] of VILLAGE_PUZZLES.entries()) {
    const { solved, grid } = solveLikeAPlayer(garden.puzzle, undefined, { signs: garden.signs })
    assert.ok(solved, `Garden ${index + 21} stalls`)
    assert.deepEqual(grid, garden.solution)
    assert.equal(solveLikeAPlayer(garden.puzzle).solved, false, `Garden ${index + 21} needs its signs`)
  }
})

test('signs carry real weight, and the chapter grows harder', () => {
  const stats = VILLAGE_PUZZLES.map((garden) => measureVillages(garden.puzzle, garden.signs))
  stats.forEach((s, i) => {
    assert.ok(villageMoves(s) >= 4, `Garden ${i + 21} leans on its signs`)
    assert.ok(s.bottlenecks <= Math.max(1, s.rounds * 0.2), `Garden ${i + 21} rarely stalls`)
  })
  stats.slice(1).forEach((s, i) => assert.ok(villageDifficulty(s) > villageDifficulty(stats[i]), `Garden ${i + 22} is harder than garden ${i + 21}`))
  assert.ok(stats.slice(0, 3).every((s) => s.count + s.line === 0), 'the chapter opens gently')
})

test('a garden only counts as finished when every village matches its sign', () => {
  const game = new GardenGame(null)
  game.load(20)
  game.grid = copyGrid(game.puzzle.solution)
  assert.equal(game.complete, true)
  const sign = game.puzzle.signs[0]
  game.puzzle = { ...game.puzzle, signs: [{ ...sign, size: sign.size + 1 }] }
  assert.equal(game.complete, false)
})

test('hints explain the village moves and walk every garden to its answer', () => {
  for (const garden of VILLAGE_PUZZLES) {
    const working = copyGrid(garden.puzzle)
    const techniques = new Set()
    for (let move = findHint(working, garden.solution, garden.signs); move; move = findHint(working, garden.solution, garden.signs)) {
      working[move.row][move.col] = move.value
      techniques.add(move.technique)
    }
    assert.deepEqual(working, garden.solution)
    assert.ok(['seal', 'grow', 'apart'].some((technique) => techniques.has(technique)))
  }
})
