import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignFlowers, bedComplete, bedNeighbors, buildBoard, conflicts, countSolutions, isSolved, playerSolve } from '../src/logic.js'
import { POOLS } from '../src/levels.js'
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

test('the first easy level has one solution, and the player finds it', () => {
  const board = buildBoard(POOLS.easy[0])
  assert.equal(isSolved(board, board.solution), true)
  assert.equal(countSolutions(board), 1)
  const result = playerSolve(board)
  assert.equal(result.solved, true)
  assert.deepEqual([...result.values], [...board.solution])
  // with no seeds to start from, there are many
  assert.equal(countSolutions(board, new Int8Array(board.cells)), 2)
})

test('the counter counts every way to fill two square beds side by side', () => {
  // each bed is any order of 1 to 4; the touching columns must swap sets
  const board = buildBoard({ width: 4, height: 2, beds: ['AABB', 'AABB'] })
  assert.equal(countSolutions(board, new Int8Array(8), 1000), 96)
})

test('neighbouring beds never grow the same flower, and lone cells grow sunflowers', () => {
  for (const levels of Object.values(POOLS)) {
    for (const level of levels) {
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

test('there are twenty levels in each pool, with unique ids', () => {
  const ids = new Set()
  for (const levels of Object.values(POOLS)) {
    assert.equal(levels.length, 20)
    for (const level of levels) ids.add(level.id)
  }
  assert.equal(ids.size, 60)
})

for (const [pool, levels] of Object.entries(POOLS)) {
  test(`every ${pool} level is sound, unique, and fits its pool`, () => {
    for (const level of levels) assert.deepEqual(checkLevel(level, pool), [], level.id)
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
