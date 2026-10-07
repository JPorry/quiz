import test from 'node:test'
import assert from 'node:assert/strict'
import { GardenGame, findHint, findViolations, copyGrid } from '../src/game.js'
import { TUTORIAL } from '../src/tutorialGarden.js'
import { puzzle } from '../src/daily.js'
import { countBinarySolutions, isValidBinarySolution } from '../src/binaryLogic.js'

function memoryStorage() {
  const items = new Map()
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) }
}

test('the tutorial garden is valid, unique, and consistent with its fixed terrain', () => {
  assert.ok(isValidBinarySolution(TUTORIAL.solution))
  assert.equal(countBinarySolutions(TUTORIAL.puzzle, 2), 1)
  TUTORIAL.puzzle.forEach((row, r) => row.forEach((v, c) => { if (v !== null) assert.equal(v, TUTORIAL.solution[r][c]) }))
})

test('placement, erase, fixed clues, and one-step undo preserve the puzzle', () => {
  const game = new GardenGame(memoryStorage())
  game.start(puzzle(1, 'easy'))
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

test('a daily garden keeps its progress by id, and reset restores the fixed terrain', () => {
  const storage = memoryStorage()
  const first = new GardenGame(storage)
  const garden = puzzle(2, 'medium')
  first.start(garden)
  const [r, c] = garden.puzzle.flatMap((row, i) => row.map((v, j) => (v === null ? [i, j] : null))).find(Boolean)
  first.place(r, c, 1)
  first.seconds = 35
  first.save()
  const restored = new GardenGame(storage)
  assert.equal(restored.state(garden.id), 'started')
  restored.start(puzzle(2, 'medium'))
  assert.equal(restored.grid[r][c], 1)
  assert.equal(restored.seconds, 35)
  assert.equal(restored.undo(), true)
  assert.equal(restored.grid[r][c], null)
  restored.reset()
  assert.deepEqual(restored.grid, restored.puzzle.puzzle)
  assert.equal(restored.seconds, 0)
  assert.equal(restored.state(puzzle(2, 'easy').id), 'new')
})

test('balance, triples, and duplicate lines report terrain conflicts', () => {
  const grid = Array.from({ length: 10 }, () => Array(10).fill(null))
  grid[0] = [0, 0, 0, 0, 0, 0, null, null, null, null]
  const bad = findViolations(grid)
  assert.ok(bad.has('0:0'))
  assert.ok(bad.has('0:5'))
  const duplicate = copyGrid(TUTORIAL.solution)
  duplicate[1] = [...duplicate[0]]
  assert.ok(findViolations(duplicate).has('1:9'))
})

test('hints follow sound deductions all the way to the answer', () => {
  const hint = findHint(copyGrid(TUTORIAL.puzzle), TUTORIAL.solution)
  assert.ok(['pair', 'gap'].includes(hint.technique), 'The tutorial opens with the simplest moves')
  for (const garden of [TUTORIAL, puzzle(1, 'easy'), puzzle(1, 'medium'), puzzle(1, 'hard')]) {
    const working = copyGrid(garden.puzzle)
    for (let move = findHint(working, garden.solution, garden); move; move = findHint(working, garden.solution, garden)) working[move.row][move.col] = move.value
    assert.deepEqual(working, garden.solution, 'Following hints alone solves the garden')
  }
})

test('finishing a garden records its time; the tutorial is never saved', () => {
  const storage = memoryStorage()
  const game = new GardenGame(storage)
  game.start(TUTORIAL)
  TUTORIAL.solution.forEach((row, r) => row.forEach((v, c) => game.place(r, c, v)))
  assert.equal(game.complete, true)
  assert.deepEqual(game.done, {})
  assert.equal(game.grids.tutorial, undefined)
  const garden = puzzle(3, 'easy')
  game.start(garden)
  game.seconds = 90
  garden.solution.forEach((row, r) => row.forEach((v, c) => game.place(r, c, v)))
  assert.equal(game.done[garden.id], 90)
  assert.equal(new GardenGame(storage).state(garden.id), 'done')
  game.resetAll()
  assert.deepEqual(game.done, {})
  assert.equal(new GardenGame(storage).state(garden.id), 'new')
})
