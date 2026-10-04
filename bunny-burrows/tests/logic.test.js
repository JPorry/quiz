import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBoard, blockedBy, degrees, findHint, playerSolve, reachable, routeFrom, solve, status } from '../src/logic.js'
import { LEVELS } from '../src/levels.js'

// A small warren:   A . B
//                   . . .
//                   C . D     with a lone E below D.
const SQUARE = { width: 3, height: 5, source: 0, burrows: [[0, 0, 2], [0, 2, 2], [2, 0, 2], [2, 2, 4], [4, 2, 2]] }

test('paths only join burrows that see each other in a straight line', () => {
  const board = buildBoard(SQUARE)
  const pairs = board.edges.map((e) => [e.a, e.b].sort().join('-')).sort()
  assert.deepEqual(pairs, ['0-1', '0-2', '1-3', '2-3', '3-4'])
  assert.equal(board.neighbors[3].down, board.edges.find((e) => e.a === 3 && e.b === 4).index)
})

test('crossing paths block each other', () => {
  // A plus shape: a horizontal and a vertical path that cross in the middle.
  const board = buildBoard({ width: 3, height: 3, source: 0, burrows: [[1, 0, 1], [1, 2, 1], [0, 1, 1], [2, 1, 1]] })
  const horizontal = board.edges.find((e) => e.horizontal).index
  const vertical = board.edges.find((e) => !e.horizontal).index
  const counts = board.edges.map(() => 0)
  counts[horizontal] = 1
  assert.equal(blockedBy(board, counts, vertical), horizontal)
  assert.equal(blockedBy(board, counts, horizontal), undefined)
})

test('carrots reach only the burrows joined to Grandma', () => {
  const board = buildBoard(SQUARE)
  const counts = board.edges.map(() => 0)
  const edge = (a, b) => board.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)).index
  counts[edge(0, 1)] = 2
  counts[edge(3, 4)] = 2
  const fed = reachable(board, counts, board.source)
  assert.deepEqual([...fed.keys()].sort(), [0, 1])
  assert.equal(fed.get(1), 1)
  assert.deepEqual(routeFrom(board, counts, 0, 1), [0, 1])
  assert.equal(routeFrom(board, counts, 0, 4), null)
})

test('status reports overfull burrows and groups closed off from Grandma', () => {
  const board = buildBoard(SQUARE)
  const counts = board.edges.map(() => 0)
  const edge = (a, b) => board.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)).index
  counts[edge(3, 4)] = 2
  counts[edge(2, 3)] = 1
  counts[edge(0, 2)] = 2
  let s = status(board, counts)
  assert.deepEqual(s.over, [2])
  counts[edge(0, 2)] = 0
  counts[edge(2, 3)] = 0
  counts[edge(3, 4)] = 2
  s = status(board, counts)
  assert.equal(s.closed.length, 0, 'D still needs a path, so the group is not closed')
  assert.equal(degrees(board, counts)[4], 2)
})

test('the solved square is complete and unique', () => {
  const board = buildBoard(SQUARE)
  const solutions = solve(board, { limit: 3 })
  assert.equal(solutions.length, 1)
  const s = status(board, solutions[0])
  assert.ok(s.complete)
})

test('every shipped level is uniquely solvable by easy steps, and its solution is right', () => {
  assert.equal(LEVELS.length, 30)
  const ids = new Set()
  for (const level of LEVELS) {
    assert.ok(!ids.has(level.id), `${level.id} is unique`)
    ids.add(level.id)
    const board = buildBoard(level)
    assert.equal(level.solution.length, board.edges.length, `${level.id} solution covers every path`)
    assert.ok(status(board, level.solution).complete, `${level.id} solution completes the garden`)
    assert.ok(board.edges.every((e) => !(level.solution[e.index] && blockedBy(board, level.solution, e.index) !== undefined)), `${level.id} solution has no crossings`)
    const player = playerSolve(board)
    assert.ok(player.solved, `${level.id} can be solved step by step`)
    assert.deepEqual(player.counts, level.solution, `${level.id} step-by-step solve matches`)
    assert.equal(solve(board, { limit: 2 }).length, 1, `${level.id} has one solution`)
  }
})

test('levels grow from small meadows to big ones', () => {
  const sizes = LEVELS.map((l) => l.burrows.length)
  assert.ok(sizes[0] <= 5)
  assert.ok(sizes.at(-1) >= 15)
})

test('hints point at a mistake first, then at a path the player can be sure of', () => {
  const level = LEVELS[4]
  const board = buildBoard(level)
  const counts = board.edges.map(() => 0)
  const wrong = level.solution.findIndex((n) => n === 0)
  if (wrong >= 0 && blockedBy(board, counts, wrong) === undefined) {
    counts[wrong] = 1
    const hint = findHint(board, counts, level.solution)
    assert.equal(hint.kind, 'remove')
    assert.equal(hint.edge, wrong)
    counts[wrong] = 0
  }
  const hint = findHint(board, counts, level.solution)
  assert.equal(hint.kind, 'add')
  assert.ok(level.solution[hint.edge] > counts[hint.edge], 'the hinted path belongs in the solution')
  assert.equal(findHint(board, level.solution.slice(), level.solution), null)
})
