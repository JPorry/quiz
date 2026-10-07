import test from 'node:test'
import assert from 'node:assert/strict'
import { copyGrid } from '../src/game.js'
import { Tutorial, findLesson, guideFor } from '../src/tutorial.js'
import { TUTORIAL } from '../src/tutorialGarden.js'
import { puzzle as daily } from '../src/daily.js'

const memoryStorage = () => {
  const memory = new Map()
  return { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) }
}
const garden = TUTORIAL
// The first medium garden with each kind of clue.
const firstWith = (kind) => { for (let day = 1; ; day++) if (daily(day, 'medium').kinds.includes(kind)) return daily(day, 'medium') }

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
  assert.equal(tutorial.card(daily(1, 'easy'), grid, 0, false), null, 'an easy daily garden has no guide')
  assert.equal(tutorial.card(garden, grid, 0, false).step, 'welcome')
  tutorial.next()
  for (const rule of ['pair', 'gap', 'count']) {
    let card = tutorial.card(garden, grid, null, false)
    assert.equal(card.step, rule)
    const { row, col } = card.target
    const value = garden.solution[row][col]
    assert.equal(card.pick, value, 'it asks for the right piece first')
    card = tutorial.card(garden, grid, value, false)
    assert.equal(card.instruction, 'Now tap the glowing tile.')
    grid[row][col] = 1 - value
    assert.match(tutorial.card(garden, grid, value, false).instruction, /Undo/)
    grid[row][col] = value
  }
  assert.equal(tutorial.card(garden, grid, 0, false).step, 'outro')
  tutorial.next()
  assert.equal(tutorial.card(garden, grid, 0, false), null)
  assert.ok(new Tutorial(storage).isFinished('basics'), 'finishing is remembered')
})

test('skipping or finishing the first garden ends the tutorial', () => {
  const skipped = new Tutorial(memoryStorage())
  skipped.card(garden, copyGrid(garden.puzzle), 0, false)
  skipped.finish()
  assert.equal(skipped.card(garden, copyGrid(garden.puzzle), 0, false), null)
  const finished = new Tutorial(memoryStorage())
  finished.card(garden, copyGrid(garden.puzzle), 0, false)
  finished.next()
  assert.equal(finished.card(garden, copyGrid(garden.solution), 0, true), null)
  assert.ok(finished.isFinished('basics'))
})

test('an earlier finished tutorial is remembered', () => {
  const storage = memoryStorage()
  storage.setItem('tidal-garden.tutorial', 'done')
  assert.ok(new Tutorial(storage).isFinished('basics'))
})

test('the first daily garden with each kind of clue has a guide that shows the clue at work', () => {
  assert.equal(guideFor(garden), 'basics')
  for (const kind of ['villages', 'lighthouses', 'ferries', 'pilgrims']) {
    const puzzle = firstWith(kind)
    assert.equal(guideFor(puzzle), kind)
    assert.equal(guideFor(puzzle, new Set([kind])), null, 'once seen, a clue needs no guide')
    const tutorial = new Tutorial(memoryStorage())
    const grid = copyGrid(puzzle.puzzle)
    assert.equal(tutorial.card(puzzle, grid, 0, false).step, 'welcome')
    tutorial.next()
    // Play the solution, a tile at a time, until the guide's lesson appears and is placed.
    let card = tutorial.card(puzzle, grid, 0, false)
    const order = puzzle.solution.flatMap((row, r) => row.map((_, c) => [r, c])).filter(([r, c]) => grid[r][c] === null)
    while (card.step === 'practice') {
      assert.ok(card.because.length, `${kind}: the clues to watch are ringed`)
      const [r, c] = order.shift()
      grid[r][c] = puzzle.solution[r][c]
      card = tutorial.card(puzzle, grid, 0, false)
    }
    assert.equal(card.step, 'lesson', kind)
    const { row, col } = card.target
    assert.equal(grid[row][col], null)
    assert.ok(card.because.length, `${kind}: the deciding clue is ringed`)
    grid[row][col] = puzzle.solution[row][col]
    assert.equal(tutorial.card(puzzle, grid, 0, false).step, 'outro')
    tutorial.next()
    assert.equal(tutorial.card(puzzle, grid, 0, false), null)
    assert.ok(tutorial.isFinished(kind))
  }
})

test('a hard garden shows the guide for a clue not seen yet, and only one per garden', () => {
  const hard = daily(1, 'hard')
  const tutorial = new Tutorial(memoryStorage())
  tutorial.finished.add(hard.kinds[0])
  assert.equal(guideFor(hard, tutorial.finished), hard.kinds[1])
  tutorial.card(hard, copyGrid(hard.puzzle), 0, false)
  tutorial.finish()
  assert.equal(tutorial.card(hard, copyGrid(hard.puzzle), 0, false), null, 'no second guide in the same garden')
})

test('opening a garden already finished leaves its guide waiting', () => {
  const puzzle = firstWith('villages')
  const tutorial = new Tutorial(memoryStorage())
  assert.equal(tutorial.card(puzzle, copyGrid(puzzle.solution), 0, true), null)
  assert.ok(!tutorial.isFinished('villages'))
})

test('replaying brings every guide back', () => {
  const storage = memoryStorage()
  const tutorial = new Tutorial(storage)
  tutorial.card(garden, copyGrid(garden.puzzle), 0, false)
  tutorial.finish()
  const villages = firstWith('villages')
  tutorial.card(villages, copyGrid(villages.puzzle), 0, false)
  tutorial.finish()
  tutorial.restart()
  const again = new Tutorial(storage)
  assert.ok(!again.isFinished('basics') && !again.isFinished('villages'))
})
