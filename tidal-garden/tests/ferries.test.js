import test from 'node:test'
import assert from 'node:assert/strict'
import { passage, ferries, ferryViolations, ferriesHold, channels } from '../src/ferries.js'

const empty = () => Array.from({ length: 10 }, () => Array(10).fill(null))

test('a passage runs by water from beside one dock to beside the other', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][4] = 1
  grid[1][0] = 0; grid[1][1] = 0; grid[1][2] = 0; grid[1][3] = 0; grid[1][4] = 0
  assert.deepEqual(passage(grid, [[0, 0], [0, 4]]), [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]])
  grid[1][2] = 1
  assert.equal(passage(grid, [[0, 0], [0, 4]]), null)
})

test('docks are joined only by water, stranded once land cuts every way, and channels are forced', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][1] = 1; grid[0][2] = 1; grid[1][1] = 1
  const route = { color: 'coral', docks: [[0, 0], [0, 2]] }
  const [state] = ferries(grid, [route])
  assert.equal(state.complete, false)
  assert.equal(state.stranded, false)
  // From the corner dock the only way out is down through (1, 0) and (2, 0).
  assert.deepEqual(channels(grid, [route]).map(String).sort(), ['1,0', '2,0'].sort())
  grid[2][0] = 1
  assert.ok(ferryViolations(grid, [route]).has('0:0'))
  assert.ok(ferryViolations(grid, [route]).has('0:2'))
  grid[2][0] = 0; grid[1][0] = 0; grid[2][1] = 0; grid[2][2] = 0; grid[1][2] = 0
  assert.ok(ferriesHold(grid, [route]))
})
