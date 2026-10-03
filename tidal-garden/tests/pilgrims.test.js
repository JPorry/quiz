import test from 'node:test'
import assert from 'node:assert/strict'
import { PILGRIM_PUZZLES } from '../src/pilgrimPuzzles.js'
import { CROSSING_PUZZLES } from '../src/crossingPuzzles.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { trail, pilgrimages, pilgrimViolations, pilgrimsHold, footpaths } from '../src/pilgrims.js'
import { ferriesHold } from '../src/ferries.js'
import { GardenGame, GARDENS, CHAPTERS, GARDEN_NAMES, chapterOf, findHint, copyGrid } from '../src/game.js'
import { PILGRIM_LEVELS, CROSSING_LEVELS, measurePilgrims, pilgrimDifficulty } from '../scripts/generate-pilgrims.mjs'

const empty = () => Array.from({ length: 10 }, () => Array(10).fill(null))
const CHAPTER_GARDENS = [
  { name: 'The Pilgrims', start: 50, gardens: PILGRIM_PUZZLES, levels: PILGRIM_LEVELS },
  { name: 'The Crossings', start: 60, gardens: CROSSING_PUZZLES, levels: CROSSING_LEVELS },
]

test('the pilgrim chapter follows the ferries, then the crossings mix both, every garden with a name', () => {
  assert.equal(PILGRIM_PUZZLES.length, 10)
  assert.equal(CROSSING_PUZZLES.length, 10)
  assert.equal(GARDENS.length, 80)
  assert.equal(GARDEN_NAMES.length, GARDENS.length)
  assert.equal(chapterOf(40).name, 'The Ferries')
  assert.equal(chapterOf(50).name, 'The Pilgrims')
  assert.equal(chapterOf(60).name, 'The Crossings')
  assert.ok(CHAPTERS[5].intro && CHAPTERS[6].intro)
  assert.ok(PILGRIM_PUZZLES.every((garden) => !garden.ferries?.length), 'the pilgrim chapter has no docks')
  assert.ok(CROSSING_PUZZLES.every((garden) => garden.ferries.length && garden.pilgrims.length), 'every crossing garden has both')
})

test('a trail walks over land from one shrine to the other', () => {
  const grid = empty()
  for (let c = 0; c <= 4; c++) grid[2][c] = 1
  assert.deepEqual(trail(grid, [[2, 0], [2, 4]]), [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]])
  grid[2][2] = 0
  assert.equal(trail(grid, [[2, 0], [2, 4]]), null)
})

test('shrines are joined only by land, parted once water cuts every way, and footpaths are forced', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][2] = 1; grid[0][1] = 0; grid[1][1] = 0
  const pair = { color: 'rose', shrines: [[0, 0], [0, 2]] }
  const [state] = pilgrimages(grid, [pair])
  assert.equal(state.complete, false)
  assert.equal(state.parted, false)
  // From the corner shrine the only way on is down through (1, 0) and (2, 0).
  assert.deepEqual(footpaths(grid, [pair]).map(String).sort(), ['1,0', '2,0'])
  grid[2][0] = 0
  assert.ok(pilgrimViolations(grid, [pair]).has('0:0'))
  assert.ok(pilgrimViolations(grid, [pair]).has('0:2'))
  grid[2][0] = 1; grid[1][0] = 1; grid[2][1] = 1; grid[2][2] = 1; grid[1][2] = 1
  assert.ok(pilgrimsHold(grid, [pair]))
})

test('every shrine and dock stands on starting land, and every pair is joined in the answer', () => {
  for (const { start, gardens } of CHAPTER_GARDENS) {
    for (const [index, garden] of gardens.entries()) {
      const clues = [...garden.pilgrims.flatMap((pair) => pair.shrines), ...(garden.ferries ?? []).flatMap((pair) => pair.docks)]
      for (const [r, c] of clues) assert.equal(garden.puzzle[r][c], 1, `Garden ${start + index + 1} clue starts on land`)
      assert.equal(new Set(clues.map(String)).size, clues.length, 'no two clues share a tile')
      assert.ok(pilgrimsHold(garden.solution, garden.pilgrims))
      assert.ok(ferriesHold(garden.solution, garden.ferries ?? []))
    }
  }
})

test('every pilgrim and crossing garden is reached by sound deductions alone, and needs its clues', () => {
  for (const { start, gardens, levels } of CHAPTER_GARDENS) {
    for (const [index, garden] of gardens.entries()) {
      const { solved, grid } = solveLikeAPlayer(garden.puzzle, undefined, garden)
      assert.ok(solved, `Garden ${start + index + 1} stalls`)
      assert.deepEqual(grid, garden.solution)
      assert.equal(solveLikeAPlayer(garden.puzzle, levels[index].allowed).solved, false, `Garden ${start + index + 1} needs its clues`)
    }
  }
})

test('shrines (and docks) carry real weight, and each chapter grows harder', () => {
  for (const { start, gardens } of CHAPTER_GARDENS) {
    const stats = gardens.map((garden) => measurePilgrims(garden.puzzle, garden))
    stats.forEach((s, i) => {
      assert.ok(s.trail >= 2, `Garden ${start + i + 1} leans on its shrines`)
      if (gardens[i].ferries?.length) assert.ok(s.channel >= 2, `Garden ${start + i + 1} leans on its docks`)
      assert.ok(s.bottlenecks <= Math.max(1, s.rounds * 0.2), `Garden ${start + i + 1} rarely stalls`)
    })
    stats.slice(1).forEach((s, i) => assert.ok(pilgrimDifficulty(s) > pilgrimDifficulty(stats[i]), `Garden ${start + i + 2} is harder than garden ${start + i + 1}`))
    assert.ok(stats.slice(0, 2).every((s) => s.count + s.line === 0), 'each chapter opens gently')
  }
})

test('a garden only counts as finished when every pair of shrines shares an island', () => {
  const game = new GardenGame(null)
  game.load(50)
  game.grid = copyGrid(game.puzzle.solution)
  assert.equal(game.complete, true)
  game.puzzle = { ...game.puzzle, pilgrims: [{ color: 'rose', shrines: [[-5, -5], [-5, -5]] }] }
  assert.equal(game.complete, false)
})

test('hints explain the footpath move and walk every garden to its answer', () => {
  for (const { gardens } of CHAPTER_GARDENS) {
    for (const garden of gardens) {
      const working = copyGrid(garden.puzzle)
      const techniques = new Set()
      for (let move = findHint(working, garden.solution, garden); move; move = findHint(working, garden.solution, garden)) {
        working[move.row][move.col] = move.value
        techniques.add(move.technique)
      }
      assert.deepEqual(working, garden.solution)
      assert.ok(techniques.has('trail'))
      if (garden.ferries?.length) assert.ok(techniques.has('channel'))
    }
  }
})
