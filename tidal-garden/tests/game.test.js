import test from 'node:test'
import assert from 'node:assert/strict'
import { GardenGame, findHint, findViolations, copyGrid } from '../src/game.js'
import { PUZZLES } from '../src/puzzles.js'
import { countBinarySolutions, isValidBinarySolution } from '../src/binaryLogic.js'

function memoryStorage() {
  const items = new Map()
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) }
}

test('every garden is valid, unique, and consistent with its fixed terrain', () => {
  assert.equal(PUZZLES.length, 20)
  for (const level of PUZZLES) {
    assert.ok(isValidBinarySolution(level.solution))
    assert.equal(countBinarySolutions(level.puzzle, 2), 1)
    level.puzzle.forEach((row, r) => row.forEach((v, c) => {
      if (v !== null) assert.equal(v, level.solution[r][c])
    }))
  }
})

test('placement, erase, fixed clues, and one-step undo preserve the puzzle', () => {
  const game = new GardenGame(memoryStorage())
  const original = copyGrid(game.grid)
  assert.equal(game.place(0, 3, 1), false)
  assert.equal(game.place(0, 0, 1), true)
  assert.equal(game.place(0, 0, 1), false)
  assert.equal(game.place(0, 1, 0), true)
  assert.equal(game.place(0, 0, null), true)
  assert.equal(game.undo(), true)
  assert.equal(game.grid[0][0], 1)
  game.undo()
  assert.equal(game.grid[0][1], null)
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
  const hint = findHint(grid)
  assert.ok(hint)
  assert.equal(hint.value, PUZZLES[0].solution[hint.row][hint.col])
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
