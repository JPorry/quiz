import test from 'node:test'
import assert from 'node:assert/strict'
import { islandAt, villages, censusViolations, censusHolds } from '../src/census.js'

const empty = () => Array.from({ length: 10 }, () => Array(10).fill(null))

test('a village grows with its island, and is complete only when closed in at its number', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][1] = 1
  const sign = { cell: [0, 0], size: 3 }
  let [village] = villages(grid, [sign])
  assert.equal(village.cells.length, 2)
  assert.equal(village.complete, false)
  grid[1][1] = 1
  ;[village] = villages(grid, [sign])
  assert.equal(village.cells.length, 3)
  assert.equal(village.complete, false, 'still open to the sea of undecided tiles')
  grid[1][0] = 0; grid[0][2] = 0; grid[1][2] = 0; grid[2][1] = 0
  ;[village] = villages(grid, [sign])
  assert.equal(village.complete, true)
  assert.ok(censusHolds(grid, [sign]))
})

test('an island that outgrows its sign, or is closed in too small, is marked', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][1] = 1; grid[0][2] = 1
  assert.deepEqual([...censusViolations(grid, [{ cell: [0, 0], size: 2 }])].sort(), ['0:0', '0:1', '0:2'])
  const small = empty()
  small[0][0] = 1; small[0][1] = 0; small[1][0] = 0
  assert.ok(censusViolations(small, [{ cell: [0, 0], size: 3 }]).has('0:0'))
  assert.equal(censusViolations(small, [{ cell: [0, 0], size: 1 }]).size, 0)
  assert.equal(islandAt(small, 0, 0).sealed, true)
})
