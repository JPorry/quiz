import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignFlowers, bedComplete, bedNeighbors, buildBoard, conflicts, countSolutions, isSolved, playerSolve } from '../src/logic.js'
import { DAYS, FIRST_DAY } from '../src/days.js'
import { TIERS, dateOf, dayOf, puzzle, today } from '../src/puzzles.js'
import { checkLevel } from '../scripts/check.mjs'

// A small garden:  A A B
//                  A C B
//                  D D B
const SMALL = { width: 3, height: 3, beds: ['AAB', 'ACB', 'DDB'] }

test('beds are read from their letters', () => {
  const board = buildBoard(SMALL)
  assert.equal(board.beds.length, 4)
  assert.deepEqual([...board.size], [3, 3, 3, 3, 1, 3, 2, 2, 3])
  assert.equal(board.around[4].length, 8)
  assert.equal(board.around[0].length, 3)
})

test('touching twins, repeats, and seeds too big for their bed are conflicts', () => {
  const board = buildBoard(SMALL)
  const values = new Int8Array(9)
  values[0] = 1
  values[4] = 1 // touches the corner cell diagonally
  assert.deepEqual([...conflicts(board, values)].sort(), [0, 4])
  values[4] = 0
  values[1] = 1 // same bed
  assert.deepEqual([...conflicts(board, values)].sort(), [0, 1])
  values[1] = 0
  values[4] = 2 // a one-cell bed only takes a 1
  assert.deepEqual([...conflicts(board, values)], [4])
})

test('a bed is complete once it holds 1 to N with no conflicts', () => {
  const board = buildBoard(SMALL)
  const values = new Int8Array(9)
  values[0] = 2; values[1] = 1; values[3] = 3
  assert.equal(bedComplete(board, values, 0), true)
  values[3] = 0
  assert.equal(bedComplete(board, values, 0), false)
})

test("the first day's easy garden has one solution, and the player finds it", () => {
  const board = buildBoard(puzzle(1, 'easy'))
  assert.equal(isSolved(board, board.solution), true)
  assert.equal(countSolutions(board), 1)
  const result = playerSolve(board)
  assert.equal(result.solved, true)
  assert.deepEqual([...result.values], [...board.solution])
  // with no seeds to start from, there are more
  assert.ok(countSolutions(board, new Int8Array(board.cells)) > 1)
})

test('the counter counts every way to fill two square beds side by side', () => {
  // each bed is any order of 1 to 4; the touching columns must swap sets
  const board = buildBoard({ width: 4, height: 2, beds: ['AABB', 'AABB'] })
  assert.equal(countSolutions(board, new Int8Array(8), 1000), 96)
})

test('neighbouring beds never grow the same flower, and lone cells grow sunflowers', () => {
  for (let day = 1; day <= 60; day++) {
    for (const tier of TIERS) {
      const level = puzzle(day, tier)
      const board = buildBoard(level)
      const flowers = assignFlowers(board, 3)
      const near = bedNeighbors(board)
      board.beds.forEach((bed, b) => {
        if (bed.length === 1) assert.equal(flowers[b], 'sunflower')
        for (const n of near[b]) if (flowers[b] !== 'sunflower') assert.notEqual(flowers[b], flowers[n], `${level.id} beds ${b} and ${n}`)
      })
    }
  }
})

test('every day has an easy, a medium and a hard garden, with unique ids', () => {
  assert.ok(DAYS.length >= 365)
  const ids = new Set()
  for (let day = 1; day <= DAYS.length; day++) {
    assert.equal(DAYS[day - 1].length, 3)
    for (const tier of TIERS) ids.add(puzzle(day, tier).id)
  }
  assert.equal(ids.size, DAYS.length * 3)
})

test('gardens grow with the difficulty', () => {
  for (let day = 1; day <= 30; day++) {
    const [easy, medium, hard] = TIERS.map((tier) => puzzle(day, tier).width * puzzle(day, tier).height)
    assert.ok(easy <= medium && medium <= hard, `day ${day}`)
  }
})

test('days count from the first day on the local calendar', () => {
  const [y, m, d] = FIRST_DAY.split('-').map(Number)
  assert.equal(dayOf(new Date(y, m - 1, d, 0, 5)), 1)
  assert.equal(dayOf(new Date(y, m - 1, d, 23, 55)), 1)
  assert.equal(dayOf(new Date(y, m - 1, d + 1)), 2)
  assert.equal(dayOf(new Date(y, m - 1, d + 40)), 41)
  assert.equal(today(new Date(y - 1, 0, 1)), 1)
  assert.equal(today(new Date(y + 5, 0, 1)), DAYS.length)
  assert.equal(dateOf(41).toISOString().slice(0, 10), new Date(Date.UTC(y, m - 1, d + 40)).toISOString().slice(0, 10))
})

// the whole calendar is checked by `npm run verify:levels`; the tests check the first weeks
for (const tier of TIERS) {
  test(`the first weeks' ${tier} gardens are sound, unique, and fit their difficulty`, () => {
    for (let day = 1; day <= 30; day++) assert.deepEqual(checkLevel(puzzle(day, tier), tier), [], `${day}-${tier}`)
  })
}

test('a finished bud and the first step of its bloom are the same shape, so opening never jumps', async () => {
  const { cellGeometry, GROW_STEPS, FLOWERS_ALL } = await import('../src/flowers.js')
  for (const type of FLOWERS_ALL) {
    for (const value of [1, 3, 6]) {
      const bud = cellGeometry(type, 'bud', value, false, GROW_STEPS).body.attributes
      const bloom = cellGeometry(type, 'bloom', value, false, 0).body.attributes
      assert.deepEqual([...bud.position.array], [...bloom.position.array], `${type} ${value}`)
      assert.deepEqual([...bud.color.array], [...bloom.color.array], `${type} ${value}`)
    }
  }
})
