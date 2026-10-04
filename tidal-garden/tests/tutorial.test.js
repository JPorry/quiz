import test from 'node:test'
import assert from 'node:assert/strict'
import { GARDENS, copyGrid } from '../src/game.js'
import { Tutorial, TUTORIAL_LEVEL, findLesson } from '../src/tutorial.js'

const memoryStorage = () => {
  const memory = new Map()
  return { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) }
}
const garden = GARDENS[TUTORIAL_LEVEL]

test('each lesson picks a tile its rule decides, matching the solution, near the front of the board', () => {
  for (const rule of ['pair', 'gap', 'count']) {
    const move = findLesson(garden.puzzle, rule)
    assert.ok(move, `the first garden shows the ${rule} rule`)
    assert.equal(garden.puzzle[move.row][move.col], null)
    assert.equal(garden.solution[move.row][move.col], move.value)
    for (const [r, c] of move.because) assert.equal(garden.puzzle[r][c], 1 - move.value)
    assert.ok(move.row >= 7, `the ${rule} lesson sits near the front`)
  }
})

test('the coach welcomes, teaches each rule on its tile, and hands over', () => {
  const storage = memoryStorage()
  const tutorial = new Tutorial(storage)
  const grid = copyGrid(garden.puzzle)
  assert.equal(tutorial.card(TUTORIAL_LEVEL, grid, 0, false).step, 'welcome')
  assert.equal(tutorial.card(5, grid, 0, false), null, 'only the first garden is guided')
  tutorial.next()
  for (const rule of ['pair', 'gap', 'count']) {
    let card = tutorial.card(TUTORIAL_LEVEL, grid, null, false)
    assert.equal(card.step, rule)
    const { row, col } = card.target
    const value = garden.solution[row][col]
    assert.equal(card.pick, value, 'it asks for the right piece first')
    card = tutorial.card(TUTORIAL_LEVEL, grid, value, false)
    assert.equal(card.instruction, 'Now tap the glowing tile.')
    grid[row][col] = 1 - value
    assert.match(tutorial.card(TUTORIAL_LEVEL, grid, value, false).instruction, /Undo/)
    grid[row][col] = value
  }
  assert.equal(tutorial.card(TUTORIAL_LEVEL, grid, 0, false).step, 'outro')
  tutorial.next()
  assert.equal(tutorial.card(TUTORIAL_LEVEL, grid, 0, false), null)
  assert.equal(new Tutorial(storage).active, false, 'finishing is remembered')
})

test('skipping or finishing the first garden ends the tutorial', () => {
  const skipped = new Tutorial(memoryStorage())
  skipped.finish()
  assert.equal(skipped.card(TUTORIAL_LEVEL, copyGrid(garden.puzzle), 0, false), null)
  const finished = new Tutorial(memoryStorage())
  assert.equal(finished.card(TUTORIAL_LEVEL, copyGrid(garden.solution), 0, true), null)
  assert.equal(finished.active, false)
})
