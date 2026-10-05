import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBoard, blockedBy, degrees, findHint, playerSolve, reachable, routeFrom, solve, status } from '../src/logic.js'
import { DAYS } from '../src/days.js'
import { TIERS, puzzle, dayOf, today, dateOf, LAST_DAY } from '../src/puzzles.js'

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

const PUZZLES = DAYS.flatMap((_, d) => TIERS.map((tier) => puzzle(d + 1, tier)))
const byTier = (tier) => PUZZLES.filter((p) => p.tier === tier)

test('fog hides a number but the solver still finds the one solution', () => {
  // the square with D's number (4) hidden: its neighbours still pin it down
  const foggy = { ...SQUARE, burrows: SQUARE.burrows.map((b, i) => (i === 3 ? [...b, 1] : b)) }
  const board = buildBoard(foggy)
  assert.equal(board.burrows[3].fog, true)
  assert.deepEqual([board.burrows[3].min, board.burrows[3].max], [1, 6])
  const solutions = solve(board, { limit: 3 })
  assert.equal(solutions.length, 1)
  assert.deepEqual(solutions[0], solve(buildBoard(SQUARE))[0])
  // a fog island never reports being over its number, and is settled by any bridge
  const s = status(board, solutions[0])
  assert.ok(s.complete)
  assert.deepEqual(s.over, [])
})

test('every day has an easy, a medium and a hard puzzle, for over a year', () => {
  assert.ok(LAST_DAY >= 365)
  for (const tier of TIERS) {
    const fog = byTier(tier).filter((p) => p.fog).length
    assert.ok(fog > LAST_DAY * 0.25 && fog < LAST_DAY * 0.6, `${tier} has fog on some days, not all`)
  }
})

test('days follow the calendar', () => {
  assert.equal(dayOf(dateOf(1)), 1)
  assert.equal(dayOf(new Date(2026, 9, 5)), 20, '5 October 2026 is day 20')
  assert.equal(dayOf(new Date(2026, 9, 6, 0, 30)), 21, 'a new day starts at local midnight')
  assert.equal(today(new Date(2020, 0, 1)), 1)
  assert.equal(today(new Date(2099, 0, 1)), LAST_DAY)
})

test('every puzzle has exactly one solution, reached by easy steps, with its numbers right', () => {
  const ids = new Set()
  for (const p of PUZZLES) {
    assert.ok(!ids.has(p.id), `${p.id} is unique`)
    ids.add(p.id)
    const board = buildBoard(p)
    const solutions = solve(board, { limit: 2 })
    assert.equal(solutions.length, 1, `${p.id} has one solution`)
    const [solution] = solutions
    assert.ok(status(board, solution).complete, `${p.id} solution completes the network`)
    const player = playerSolve(board)
    assert.ok(player.solved, `${p.id} can be solved step by step`)
    assert.deepEqual(player.counts, solution, `${p.id} step-by-step solve matches`)
    const d = degrees(board, solution)
    assert.ok(board.burrows.every((b) => d[b.index] === b.value), `${p.id} numbers, hidden or not, match the solution`)
  }
})

test('each difficulty asks for the techniques its name promises', () => {
  for (const p of byTier('easy')) {
    const { used } = playerSolve(buildBoard(p))
    assert.equal(used.isolation + used.trial, 0, `${p.id} needs only counting`)
  }
  for (const p of byTier('medium')) {
    const { used } = playerSolve(buildBoard(p))
    assert.ok(used.isolation + used.trial >= 1 && used.trial <= 2, `${p.id} needs a little more`)
  }
  for (const p of byTier('hard')) assert.ok(playerSolve(buildBoard(p)).used.trial >= 2, `${p.id} needs looking ahead`)
})

test('hints point at a mistake first, then at a path the player can be sure of', () => {
  const p = puzzle(5, 'medium')
  const level = { ...p, solution: solve(buildBoard(p))[0] }
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
