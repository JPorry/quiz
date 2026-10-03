import test from 'node:test'
import assert from 'node:assert/strict'
import { SHORE_PUZZLES } from '../src/shorePuzzles.js'
import { solveLikeAPlayer } from '../src/solver.js'
import { countSolutions, hintViolations, hintsHold, possibleHints } from '../src/hints.js'
import { GardenGame, GARDENS, CHAPTERS, GARDEN_NAMES, chapterOf, findHint, findViolations, copyGrid } from '../src/game.js'
import { measureHinted, hintedDifficulty } from '../scripts/generate-shores.mjs'

test('the chapter follows the first twenty gardens, every garden with a name', () => {
  assert.equal(SHORE_PUZZLES.length, 10)
  assert.equal(GARDENS.length, 30)
  assert.equal(GARDEN_NAMES.length, GARDENS.length)
  assert.deepEqual(CHAPTERS.map((chapter) => [chapter.start, chapter.count]), [[0, 20], [20, 10]])
  assert.equal(chapterOf(19).name, 'The Shallows')
  assert.equal(chapterOf(20).name, 'Bridges & Shorelines')
})

test('footbridges only join land, shorelines only run between land and water, and water beside water has no hint', () => {
  for (const [index, garden] of SHORE_PUZZLES.entries()) {
    for (const { kind, cells: [[r1, c1], [r2, c2]] } of garden.hints) {
      assert.equal(Math.abs(r1 - r2) + Math.abs(c1 - c2), 1, `Garden ${index + 21} hints join neighbors`)
      const a = garden.solution[r1][c1], b = garden.solution[r2][c2]
      if (kind === 'bridge') assert.ok(a === 1 && b === 1, `Garden ${index + 21} bridge joins land`)
      else assert.ok(a !== b, `Garden ${index + 21} shoreline runs between land and water`)
    }
    assert.ok(hintsHold(garden.solution, garden.hints))
  }
})

test('every shoreline garden has one answer, reachable by always taking the easiest move', () => {
  for (const [index, garden] of SHORE_PUZZLES.entries()) {
    assert.equal(countSolutions(garden.puzzle, garden.hints), 1, `Garden ${index + 21} has one answer`)
    const { solved, grid } = solveLikeAPlayer(garden.puzzle, undefined, { hints: garden.hints })
    assert.ok(solved, `Garden ${index + 21} stalls`)
    assert.deepEqual(grid, garden.solution)
  }
})

test('shorelines carry real weight, and the chapter grows harder with fewer hints', () => {
  const stats = SHORE_PUZZLES.map((garden) => measureHinted(garden.puzzle, garden.hints))
  stats.forEach((s, i) => {
    assert.ok(s.shore >= 4, `Garden ${i + 21} leans on shorelines`)
    assert.ok(s.bottlenecks <= Math.max(1, s.rounds * 0.2), `Garden ${i + 21} rarely stalls`)
  })
  stats.slice(1).forEach((s, i) => assert.ok(hintedDifficulty(s) > hintedDifficulty(stats[i]), `Garden ${i + 22} is harder than garden ${i + 21}`))
  assert.ok(stats[0].hints > stats.at(-1).hints, 'early gardens carry more hints')
  assert.ok(stats.slice(0, 3).every((s) => s.count + s.line === 0), 'the chapter opens gently')
})

test('without its hints a shoreline garden is not solvable, so the hints matter', () => {
  for (const garden of SHORE_PUZZLES) assert.equal(solveLikeAPlayer(garden.puzzle).solved, false)
})

test('broken footbridges and shorelines are marked, and a garden that breaks one is not finished', () => {
  const garden = SHORE_PUZZLES[0]
  const shore = garden.hints.find((hint) => hint.kind === 'shore')
  const grid = garden.puzzle.map((row) => row.map(() => null))
  const [[r1, c1], [r2, c2]] = shore.cells
  grid[r1][c1] = 1; grid[r2][c2] = 1
  assert.deepEqual([...hintViolations(grid, [shore])].sort(), [`${r1}:${c1}`, `${r2}:${c2}`].sort())
  assert.ok(findViolations(grid, garden.hints).has(`${r1}:${c1}`))
  const bridge = { kind: 'bridge', cells: [[0, 0], [0, 1]] }
  assert.equal(hintViolations([[0, null]], [bridge]).has('0:0'), true)
  const game = new GardenGame(null)
  game.load(20)
  game.grid = copyGrid(game.puzzle.solution)
  assert.equal(game.complete, true)
  game.puzzle = { ...game.puzzle, hints: [...game.puzzle.hints, { kind: 'shore', cells: possibleHints(game.puzzle.solution).find((hint) => hint.kind === 'bridge').cells }] }
  assert.equal(game.complete, false, 'a balanced garden that breaks a hint is not finished')
})

test('hints explain footbridges and shorelines and walk every garden to its answer', () => {
  for (const garden of SHORE_PUZZLES) {
    const working = copyGrid(garden.puzzle)
    const techniques = new Set()
    for (let move = findHint(working, garden.solution, garden.hints); move; move = findHint(working, garden.solution, garden.hints)) {
      working[move.row][move.col] = move.value
      techniques.add(move.technique)
    }
    assert.deepEqual(working, garden.solution)
    assert.ok(techniques.has('shore'))
  }
})
