import test from 'node:test'
import assert from 'node:assert/strict'
import { terrainNeighbors, connectedTerrain, findEnclosedRegions, chooseCompletionVariant, COMPLETION_VARIANTS, landMask, landOutline } from '../src/terrain.js'

test('land joins only cardinal neighbors and honors board edges', () => {
  const grid = [[1, 1, 0], [null, 0, 1], [1, 0, 1]]
  assert.deepEqual(connectedTerrain(grid, 0, 0), [{ row: 0, col: 0 }, { row: 0, col: 1 }])
  assert.equal(connectedTerrain(grid, 1, 2).length, 2)
  assert.deepEqual(connectedTerrain(grid, 1, 0), [])
  assert.deepEqual(connectedTerrain(grid, -1, 0), [])
  assert.deepEqual(terrainNeighbors(grid, 0, 0).map((neighbor) => neighbor.value), [undefined, 1, null, undefined])
})

test('placing terrain connects patches and removing it separates them', () => {
  const grid = [[0, null, 0], [1, 1, 1]]
  assert.equal(connectedTerrain(grid, 0, 0).length, 1)
  grid[0][1] = 0
  assert.equal(connectedTerrain(grid, 0, 0).length, 3)
  grid[0][1] = null
  assert.equal(connectedTerrain(grid, 0, 0).length, 1)
})

test('closed islands and lakes require a completely assigned perimeter', () => {
  for (const value of [0, 1]) {
    const grid = Array.from({ length: 5 }, () => Array(5).fill(1 - value))
    grid[2][2] = value
    grid[2][3] = value
    const [region] = findEnclosedRegions(grid)
    assert.equal(region.value, value)
    assert.deepEqual(region.cells, [{ row: 2, col: 2 }, { row: 2, col: 3 }])
    assert.deepEqual(findEnclosedRegions(grid), [region], 'Stable region identity')
    grid[1][2] = null
    assert.deepEqual(findEnclosedRegions(grid), [], 'Unresolved shoreline is not enclosed')
    grid[1][2] = 1 - value
    assert.deepEqual(findEnclosedRegions(grid), [region], 'Closing shoreline completes the patch')
    grid[1][2] = null
    assert.deepEqual(findEnclosedRegions(grid), [], 'Undo reopens the patch')
  }
})

test('regions reaching the board edge or exceeding the small-patch limit do not celebrate', () => {
  assert.deepEqual(findEnclosedRegions([[0, 0, 0], [1, 1, 0], [0, 0, 0]]), [])
  const grid = Array.from({ length: 6 }, () => Array(6).fill(0))
  grid[2][2] = grid[2][3] = grid[3][2] = 1
  assert.equal(findEnclosedRegions(grid, 3).length, 1)
  assert.equal(findEnclosedRegions(grid, 2).length, 0)
})

test('diagonal patches remain separate and corner gaps do not count as shoreline', () => {
  const grid = Array.from({ length: 5 }, () => Array(5).fill(0))
  grid[1][1] = grid[2][2] = 1
  grid[0][0] = null
  const regions = findEnclosedRegions(grid)
  assert.equal(regions.length, 2)
  assert.ok(regions.every((region) => region.cells.length === 1))
})

test('completion variants are varied, type-specific, and never immediately repeat', () => {
  for (const value of [0, 1]) {
    const choices = COMPLETION_VARIANTS[value]
    assert.equal(new Set([0, 0.4, 0.9].map((random) => chooseCompletionVariant(value, undefined, () => random))).size, 3)
    for (const previous of choices) for (const random of [0, 0.5, 0.99]) {
      const next = chooseCompletionVariant(value, previous, () => random)
      assert.ok(choices.includes(next))
      assert.notEqual(next, previous)
    }
  }
})

test('land masks record all eight neighbors that are land', () => {
  const grid = [[1, 0, 1], [1, 1, null], [0, 1, 1]]
  // north, east, south, west, then northeast, southeast, southwest, northwest
  assert.equal(landMask(grid, 1, 1), 0b10111100)
  assert.equal(landMask(grid, 0, 0), 0b00100100)
})

test('land outlines round off at the water and run flush into neighboring land', () => {
  const extent = (points) => [Math.min(...points.map(([x]) => x)), Math.max(...points.map(([x]) => x)), Math.min(...points.map(([, y]) => y)), Math.max(...points.map(([, y]) => y))]
  const lone = landOutline(0, 0.1, 0.2)
  assert.deepEqual(extent(lone).map((v) => +v.toFixed(6)), [-0.4, 0.4, -0.4, 0.4], 'A lone islet is inset on every side')
  assert.ok(lone.every(([x, y]) => Math.abs(x) < 0.4 + 1e-9 && Math.abs(y) < 0.4 + 1e-9))
  assert.ok(!lone.some(([x, y]) => Math.abs(x) > 0.39 && Math.abs(y) > 0.39), 'Outer corners are rounded')
  const east = landOutline(0b0010, 0.1, 0.2)
  assert.equal(Math.max(...east.map(([x]) => x)), 0.5, 'A land neighbor pulls the edge out to the tile boundary')
  assert.equal(east.filter(([x]) => x === 0.5).length, 2, 'The joined side is a straight seam')
  const notch = landOutline(0b0011, 0.1, 0.2)
  assert.ok(notch.some(([x, y]) => x < 0.5 && y < 0.5 && x > 0.4 && y > 0.4), 'An inner corner gets a concave fillet')
  const full = landOutline(0b11111111, 0.1, 0.2)
  assert.deepEqual(extent(full), [-0.5, 0.5, -0.5, 0.5])
  assert.equal(full.length, 4, 'Interior land is a plain square')
})
