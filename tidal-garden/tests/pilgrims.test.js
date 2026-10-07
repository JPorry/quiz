import test from 'node:test'
import assert from 'node:assert/strict'
import { trail, pilgrimages, pilgrimViolations, pilgrimsHold, footpaths } from '../src/pilgrims.js'

const empty = () => Array.from({ length: 10 }, () => Array(10).fill(null))

test('a trail walks over land from one shrine to the other', () => {
  const grid = empty()
  for (let c = 0; c <= 4; c++) grid[2][c] = 1
  assert.deepEqual(trail(grid, [[2, 0], [2, 4]]), [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]])
  grid[2][2] = 0
  assert.equal(trail(grid, [[2, 0], [2, 4]]), null)
})

test('shrines are joined only by land, parted once water cuts every way, and footpaths are forced', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][2] = 1; grid[0][1] = 0; grid[1][1] = 0
  const pair = { color: 'rose', shrines: [[0, 0], [0, 2]] }
  const [state] = pilgrimages(grid, [pair])
  assert.equal(state.complete, false)
  assert.equal(state.parted, false)
  // From the corner shrine the only way on is down through (1, 0) and (2, 0).
  assert.deepEqual(footpaths(grid, [pair]).map(String).sort(), ['1,0', '2,0'])
  grid[2][0] = 0
  assert.ok(pilgrimViolations(grid, [pair]).has('0:0'))
  assert.ok(pilgrimViolations(grid, [pair]).has('0:2'))
  grid[2][0] = 1; grid[1][0] = 1; grid[2][1] = 1; grid[2][2] = 1; grid[1][2] = 1
  assert.ok(pilgrimsHold(grid, [pair]))
})
