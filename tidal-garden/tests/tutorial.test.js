import test from 'node:test'
import assert from 'node:assert/strict'
import { GARDENS, CHAPTERS, GardenGame, copyGrid } from '../src/game.js'
import { Tutorial, TUTORIAL_LEVEL, findLesson, guideFor } from '../src/tutorial.js'

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
  assert.equal(tutorial.card(5, grid, 0, false), null, 'only the first garden is guided')
  assert.equal(tutorial.card(TUTORIAL_LEVEL, grid, 0, false).step, 'welcome')
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
  assert.ok(new Tutorial(storage).isFinished('basics'), 'finishing is remembered')
})

test('skipping or finishing the first garden ends the tutorial', () => {
  const skipped = new Tutorial(memoryStorage())
  skipped.card(TUTORIAL_LEVEL, copyGrid(garden.puzzle), 0, false)
  skipped.finish()
  assert.equal(skipped.card(TUTORIAL_LEVEL, copyGrid(garden.puzzle), 0, false), null)
  const finished = new Tutorial(memoryStorage())
  assert.equal(finished.card(TUTORIAL_LEVEL, copyGrid(garden.solution), 0, true), null)
  assert.ok(finished.isFinished('basics'))
})

test('an earlier finished tutorial is remembered', () => {
  const storage = memoryStorage()
  storage.setItem('tidal-garden.tutorial', 'done')
  assert.ok(new Tutorial(storage).isFinished('basics'))
})

test('the first garden of every later chapter has a guide that shows its new clue at work', () => {
  const ids = CHAPTERS.slice(1).map((chapter) => guideFor(chapter.start))
  assert.deepEqual(ids, ['villages', 'lighthouses', 'ferries', 'pilgrims', 'crossings', 'archipelago'])
  assert.equal(guideFor(CHAPTERS[1].start + 1), null, 'only the first garden of a chapter is guided')
  for (const chapter of CHAPTERS.slice(1)) {
    const puzzle = GARDENS[chapter.start]
    const tutorial = new Tutorial(memoryStorage())
    const grid = copyGrid(puzzle.puzzle)
    assert.equal(tutorial.card(chapter.start, grid, 0, false, puzzle).step, 'welcome')
    tutorial.next()
    // Play the solution, a tile at a time, until the guide's lesson appears and is placed.
    let card = tutorial.card(chapter.start, grid, 0, false, puzzle)
    const order = puzzle.solution.flatMap((row, r) => row.map((_, c) => [r, c])).filter(([r, c]) => grid[r][c] === null)
    while (card.step === 'practice') {
      assert.ok(card.because.length, `${chapter.name}: the clues to watch are ringed`)
      const [r, c] = order.shift()
      grid[r][c] = puzzle.solution[r][c]
      card = tutorial.card(chapter.start, grid, 0, false, puzzle)
    }
    assert.equal(card.step, 'lesson', chapter.name)
    const { row, col } = card.target
    assert.equal(grid[row][col], null)
    assert.ok(card.because.length, `${chapter.name}: the deciding clue is ringed`)
    grid[row][col] = puzzle.solution[row][col]
    assert.equal(tutorial.card(chapter.start, grid, 0, false, puzzle).step, 'outro')
    tutorial.next()
    assert.equal(tutorial.card(chapter.start, grid, 0, false, puzzle), null)
  }
})

test('replaying brings every guide back', () => {
  const storage = memoryStorage()
  const tutorial = new Tutorial(storage)
  tutorial.card(TUTORIAL_LEVEL, copyGrid(garden.puzzle), 0, false)
  tutorial.finish()
  tutorial.card(CHAPTERS[1].start, copyGrid(GARDENS[CHAPTERS[1].start].puzzle), 0, false, GARDENS[CHAPTERS[1].start])
  tutorial.finish()
  tutorial.restart()
  const again = new Tutorial(storage)
  assert.ok(!again.isFinished('basics') && !again.isFinished('villages'))
})

test('resetting all progress clears every garden', () => {
  const game = new GardenGame(memoryStorage())
  game.completed.push(0, 1, 2)
  game.load(3)
  game.place(...GARDENS[3].puzzle.flatMap((row, r) => row.map((v, c) => [r, c, v])).find(([, , v]) => v === null).slice(0, 2), 0)
  game.resetAll()
  assert.deepEqual(game.completed, [])
  assert.equal(game.level, 0)
  assert.deepEqual(Object.keys(game.grids), ['0'])
  assert.equal(game.history.length, 0)
})
