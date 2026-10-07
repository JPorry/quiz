import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BEDDING, TUBE, SEED, buildBoard, findHint, playerSolve, solve, status } from '../src/logic.js'
import { DAYS } from '../src/days.js'
import { TIERS, TUTORIAL, puzzle, dayOf, today, dateOf, LAST_DAY } from '../src/puzzles.js'

// The habitat from the first mock-up, '#' for tube:
const PICTURE = ['#3..###', '#####.#', '.#1#..#', '5.##4##', '..#.#2#', '###.#.#', '.2#3###']
const rooms = []
PICTURE.forEach((row, r) => [...row].forEach((ch, c) => { if (/\d/.test(ch)) rooms.push([r, c, Number(ch)]) }))
const LEVEL = { width: 7, height: 7, rooms }
const ANSWER = PICTURE.join('').split('').map((ch) => (ch === '#' ? TUBE : BEDDING))
const at = (r, c) => r * 7 + c

test('the solver finds exactly one way to lay the tubes', () => {
  const board = buildBoard(LEVEL)
  const found = solve(board, { limit: 2 })
  assert.equal(found.length, 1)
  assert.deepEqual(found[0], ANSWER)
})

test('a player who never guesses blindly can solve it', () => {
  const result = playerSolve(buildBoard(LEVEL))
  assert.ok(result.solved)
})

test('status: rooms finish when walled in at exactly their size', () => {
  const board = buildBoard(LEVEL)
  const s = status(board, ANSWER)
  assert.ok(s.complete)
  assert.ok(s.rooms.every((r) => r.done))
  const empty = status(board, ANSWER.map(() => BEDDING))
  assert.ok(!empty.complete)
  // with nothing marked, every room is one big open space
  assert.ok(empty.rooms.every((r) => !r.done))
})

test('status: a 2×2 block of tube is too wide', () => {
  const board = buildBoard(LEVEL)
  const cells = ANSWER.slice()
  cells[at(0, 3)] = TUBE // the 3's room, next to its number
  cells[at(0, 2)] = TUBE
  const s = status(board, cells)
  assert.ok(s.wide.includes(at(0, 2)), 'cells (0,2) (0,3) (1,2) (1,3) are all tube')
  assert.ok(!s.complete)
  assert.ok(s.cramped.includes(board.clueAt[1]), 'the 3 is walled into one cell')
})

test('status: seeds that join two numbers crowd both rooms', () => {
  const board = buildBoard({ width: 3, height: 1, rooms: [[0, 0, 1], [0, 2, 1]] })
  const s = status(board, [BEDDING, SEED, BEDDING])
  assert.deepEqual(s.crowded.sort(), [0, 1])
})

test('status: tubes walled off from the rest are split', () => {
  const board = buildBoard({ width: 3, height: 3, rooms: [[1, 1, 1]] })
  const cells = Array(9).fill(TUBE)
  cells[4] = BEDDING
  assert.ok(!status(board, cells).split)
  const apart = cells.slice()
  apart[1] = SEED
  apart[7] = SEED
  apart[3] = SEED
  apart[5] = SEED
  assert.ok(status(board, apart).split)
})

test('a hint always points at a cell the solution agrees with', () => {
  const board = buildBoard(LEVEL)
  const cells = ANSWER.map(() => BEDDING)
  for (let k = 0; k < 60; k++) {
    const hint = findHint(board, cells, ANSWER)
    if (!hint) break
    assert.equal(hint.value === TUBE ? TUBE : BEDDING, ANSWER[hint.cell])
    cells[hint.cell] = hint.value
  }
  assert.ok(status(board, cells.map((v) => (v === SEED ? BEDDING : v))).complete)
})

test('the tutorial habitat has one solution and needs no guessing', () => {
  const board = buildBoard(TUTORIAL)
  assert.equal(solve(board, { limit: 2 }).length, 1)
  const result = playerSolve(board)
  assert.ok(result.solved)
  assert.equal(result.used.trial, 0)
})

test('every day has an easy, a medium and a hard habitat', () => {
  assert.ok(DAYS.length >= 365)
  for (const day of [1, 2, 100, DAYS.length]) {
    for (const tier of TIERS) {
      const p = puzzle(day, tier)
      assert.equal(p.id, `${day}-${tier}`)
      assert.ok(p.rooms.length >= 2)
      assert.equal(p.names.length, p.rooms.length)
      assert.equal(new Set(p.names).size, p.names.length, 'every hamster has its own name')
      for (const [r, c, v] of p.rooms) assert.ok(r < p.height && c < p.width && v >= 1)
    }
  }
})

test('a sample of shipped habitats each have exactly one solution', () => {
  for (const day of [1, 2, 3, 50, 200, DAYS.length]) {
    for (const tier of TIERS) {
      const board = buildBoard(puzzle(day, tier))
      assert.equal(solve(board, { limit: 2 }).length, 1, `day ${day} ${tier}`)
    }
  }
})

test('days count from the first day in the player’s own calendar', () => {
  const first = dateOf(1)
  assert.equal(dayOf(new Date(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate())), 1)
  assert.equal(today(new Date(2000, 0, 1)), 1)
  assert.equal(today(new Date(2100, 0, 1)), LAST_DAY)
})
