import test from 'node:test'
import assert from 'node:assert/strict'
import { findLakes, createRimField, terrainIsSolid, RIM } from '../src/ocean.js'

const islandGrid = () => {
  const grid = Array.from({ length: 10 }, () => Array(10).fill(0))
  for (let row = 2; row < 8; row++) for (let col = 2; col < 8; col++) grid[row][col] = 1
  return grid
}

function sampler(field) {
  const at = (x, z, channel) => {
    const col = Math.floor((x + RIM.extent / 2) / RIM.extent * RIM.resolution)
    const row = Math.floor((z + RIM.extent / 2) / RIM.extent * RIM.resolution)
    return field[(row * RIM.resolution + col) * 4 + channel]
  }
  return { distance: (x, z) => at(x, z, 0) / 255 * (RIM.max - RIM.min) + RIM.min, lake: (x, z) => at(x, z, 1) }
}

test('water sealed inside land is a lake; water with a channel to the rim is not', () => {
  const grid = islandGrid()
  grid[4][4] = 0
  grid[3][2] = 0
  grid[3][3] = 0
  const lakes = findLakes(grid)
  assert.equal(lakes[4][4], true, 'Enclosed pool')
  assert.equal(lakes[3][3], false, 'Inlet open to the sea')
  assert.equal(lakes[0][0], false)
  grid[5][5] = 0
  assert.equal(findLakes(grid)[5][5], true, 'A diagonal touch does not join water bodies')
  grid[2][4] = null
  grid[3][4] = null
  assert.equal(findLakes(grid)[4][4], false, 'Undecided tiles never seal a lake')
})

test('rim field measures distance to the rounded, merged coastline', () => {
  const { distance, lake } = sampler(createRimField(islandGrid(), { inset: 0.06, radius: 0.24 }))
  const east = 3 - 0.06
  assert.ok(Math.abs(distance(east + 0.1, 0.04) - 0.1) < 0.05, 'Water just off the east shore')
  assert.ok(distance(0.04, 0.04) <= RIM.min + 0.01, 'Land interior is negative')
  assert.ok(distance(east - 0.1, 0.04) < 0, 'Seams between joined tiles are land, not foam')
  const corner = 3 - 0.06
  assert.ok(distance(corner - 0.02, corner - 0.02) > 0.05, 'Rounded corners leave open water where a square tile would be')
  assert.ok(distance(5.8, 5.8) > 1.5, 'Open water far from land saturates')
  assert.equal(lake(0.04, 0.04), 0)
})

test('terrain occupancy separates water from land and undecided tiles', () => {
  const terrain = new Uint8Array(16 * 16 * 4)
  terrain[(8 * 16 + 8) * 4] = 180
  assert.equal(terrainIsSolid(terrain, 0.5, 0.5), true)
  assert.equal(terrainIsSolid(terrain, 1.5, 0.5), false)
  assert.equal(terrainIsSolid(terrain, 40, 0.5), false)
})
