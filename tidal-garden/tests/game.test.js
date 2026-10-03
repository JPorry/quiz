import test from 'node:test'
import assert from 'node:assert/strict'
import { GardenGame, GARDENS, GARDEN_NAMES, CHAPTERS, findHint, findViolations, copyGrid } from '../src/game.js'
import { PUZZLES } from '../src/puzzles.js'
import { countBinarySolutions, isValidBinarySolution } from '../src/binaryLogic.js'

function memoryStorage() {
  const items = new Map()
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) }
}

test('every garden is valid, unique, and consistent with its fixed terrain', () => {
  assert.equal(PUZZLES.length, 30)
  for (const level of PUZZLES) {
    assert.ok(isValidBinarySolution(level.solution))
    assert.equal(countBinarySolutions(level.puzzle, 2), 1)
    level.puzzle.forEach((row, r) => row.forEach((v, c) => {
      if (v !== null) assert.equal(v, level.solution[r][c])
    }))
  }
})

test('seven chapters of thirty gardens, each garden with its own name', () => {
  assert.equal(CHAPTERS.length, 7)
  assert.ok(CHAPTERS.every((chapter) => chapter.count === 30))
  assert.equal(GARDENS.length, 210)
  assert.equal(GARDEN_NAMES.length, GARDENS.length)
  assert.equal(new Set(GARDEN_NAMES).size, GARDEN_NAMES.length)
})

test('placement, erase, fixed clues, and one-step undo preserve the puzzle', () => {
  const game = new GardenGame(memoryStorage())
  const original = copyGrid(game.grid)
  const cells = original.flatMap((row, r) => row.map((value, c) => ({ r, c, value })))
  const fixed = cells.find((cell) => cell.value !== null)
  const [a, b] = cells.filter((cell) => cell.value === null)
  assert.equal(game.place(fixed.r, fixed.c, 1 - fixed.value), false)
  assert.equal(game.place(a.r, a.c, 1), true)
  assert.equal(game.place(a.r, a.c, 1), false)
  assert.equal(game.place(b.r, b.c, 0), true)
  assert.equal(game.place(a.r, a.c, null), true)
  assert.equal(game.undo(), true)
  assert.equal(game.grid[a.r][a.c], 1)
  game.undo()
  assert.equal(game.grid[b.r][b.c], null)
  game.undo()
  assert.deepEqual(game.grid, original)
})

test('progress restores on reload and reset restores the fixed terrain', () => {
  const storage = memoryStorage()
  const first = new GardenGame(storage)
  first.place(0, 0, 1)
  first.seconds = 35
  first.save()
  const restored = new GardenGame(storage)
  assert.equal(restored.grid[0][0], 1)
  assert.equal(restored.seconds, 35)
  assert.equal(restored.undo(), true)
  assert.equal(restored.grid[0][0], null)
  restored.reset()
  assert.deepEqual(restored.grid, restored.puzzle.puzzle)
  assert.equal(restored.seconds, 0)
})

test('balance, triples, and duplicate lines report terrain conflicts', () => {
  const grid = Array.from({ length: 10 }, () => Array(10).fill(null))
  grid[0] = [0, 0, 0, 0, 0, 0, null, null, null, null]
  const bad = findViolations(grid)
  assert.ok(bad.has('0:0'))
  assert.ok(bad.has('0:5'))
  const duplicate = copyGrid(PUZZLES[0].solution)
  duplicate[1] = [...duplicate[0]]
  assert.ok(findViolations(duplicate).has('1:9'))
})

test('hints are logical placements consistent with the unique solution', () => {
  const grid = copyGrid(PUZZLES[0].puzzle)
  const hint = findHint(grid, PUZZLES[0].solution)
  assert.ok(hint)
  assert.equal(hint.value, PUZZLES[0].solution[hint.row][hint.col])
  assert.ok(['pair', 'gap'].includes(hint.technique), 'The first garden opens with the simplest moves')
  for (const garden of PUZZLES) {
    const working = copyGrid(garden.puzzle)
    for (let move = findHint(working, garden.solution); move; move = findHint(working, garden.solution)) working[move.row][move.col] = move.value
    assert.deepEqual(working, garden.solution, 'Following hints alone solves every garden')
  }
})

test('completion is recorded and independent gardens retain their own progress', () => {
  const game = new GardenGame(memoryStorage())
  PUZZLES[0].solution.forEach((row, r) => row.forEach((v, c) => game.place(r, c, v)))
  assert.equal(game.complete, true)
  assert.deepEqual(game.completed, [0])
  game.load(1)
  assert.equal(game.complete, false)
  game.load(0)
  assert.equal(game.complete, true)
})
