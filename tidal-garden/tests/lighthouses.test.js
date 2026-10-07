import test from 'node:test'
import assert from 'node:assert/strict'
import { beam, lighthouses, lighthouseViolations, lighthousesHold } from '../src/lighthouses.js'

const empty = () => Array.from({ length: 10 }, () => Array(10).fill(null))

test('a beam counts water until land or the edge stops it, and waits at undecided tiles', () => {
  const grid = empty()
  grid[5][5] = 1
  grid[5][6] = 0; grid[5][7] = 0; grid[5][8] = 1
  const east = beam(grid, [5, 5], [0, 1])
  assert.equal(east.lit.length, 2)
  assert.equal(east.open, null)
  assert.equal(east.reach, 2)
  grid[4][5] = 0
  const north = beam(grid, [5, 5], [-1, 0])
  assert.equal(north.lit.length, 1)
  assert.deepEqual(north.open, [3, 5])
  assert.equal(north.reach, 5, 'could see to the edge if the rest is water')
})

test('a lighthouse is lit only when every beam is settled at exactly its number', () => {
  const grid = empty()
  grid[0][0] = 1; grid[0][1] = 0; grid[0][2] = 1; grid[1][0] = 0; grid[2][0] = 0; grid[3][0] = 1
  const light = { cell: [0, 0], sees: 3 }
  assert.ok(lighthousesHold(grid, [light]))
  assert.equal(lighthouseViolations(grid, [{ ...light, sees: 2 }]).has('0:0'), true, 'sees too much')
  assert.equal(lighthouseViolations(grid, [{ ...light, sees: 4 }]).has('0:0'), true, 'can no longer see enough')
  grid[3][0] = null
  const [state] = lighthouses(grid, [light])
  assert.equal(state.complete, false, 'an open beam is not settled')
})
