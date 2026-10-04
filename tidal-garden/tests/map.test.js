import test from 'node:test'
import assert from 'node:assert/strict'
import { mapLayout, mapMarkup, NODE_GAP } from '../src/map.js'
import { CHAPTERS, GARDENS, GARDEN_NAMES, GardenGame } from '../src/game.js'

test('the map climbs from the first garden at the bottom to the last at the top', () => {
  for (const width of [320, 390, 560]) {
    const layout = mapLayout(CHAPTERS, width)
    assert.equal(layout.nodes.length, GARDENS.length)
    layout.nodes.forEach((node, i) => {
      assert.ok(node.x >= 40 && node.x <= width - 40, `garden ${i + 1} stays on the map`)
      assert.ok(node.y > 0 && node.y < layout.height)
      if (i) assert.ok(layout.nodes[i - 1].y - node.y >= NODE_GAP, `garden ${i + 1} sits above garden ${i}`)
    })
    assert.match(layout.path, /^M[\d.]+ [\d.]+( C[\d. -]+)+$/)
  }
})

test('every chapter has its own region, banner, and a few illustrations', () => {
  const layout = mapLayout(CHAPTERS, 390)
  assert.equal(layout.regions.length, CHAPTERS.length)
  layout.regions.forEach((region, i) => {
    assert.ok(region.top < region.bottom)
    if (i) assert.equal(region.bottom, layout.regions[i - 1].top, 'regions meet without a gap')
    for (let level = region.start; level < region.start + region.count; level++) {
      const { y } = layout.nodes[level]
      assert.ok(y > region.top && y < region.bottom, `garden ${level + 1} lies inside its chapter`)
    }
    assert.ok(layout.decorations.filter((item) => item.chapter === i).length >= 3)
  })
  assert.equal(layout.banners.length, CHAPTERS.length)
})

test('the map marks finished, open, and locked gardens, and the marker stands at the frontier', () => {
  const layout = mapLayout(CHAPTERS, 390)
  const completed = [0, 1, 2]
  const html = mapMarkup(layout, CHAPTERS, { completed, isUnlocked: (level) => level <= 3, frontier: 3, names: GARDEN_NAMES })
  assert.equal((html.match(/class="map-node done/g) ?? []).length, 3)
  assert.equal((html.match(/class="map-node open frontier/g) ?? []).length, 1)
  assert.equal((html.match(/class="map-node locked/g) ?? []).length, GARDENS.length - 4)
  assert.ok(html.includes(`left:${layout.nodes[3].x}px;top:${layout.nodes[3].y}px" aria-hidden="true"><span><i data-lucide="sprout">`))
})

test('gardens open one after another', () => {
  const game = new GardenGame(null)
  assert.ok(game.isUnlocked(0))
  assert.ok(!game.isUnlocked(1))
  assert.equal(game.frontier, 0)
  game.completed.push(0, 1)
  assert.ok(game.isUnlocked(2))
  assert.ok(!game.isUnlocked(3))
  assert.equal(game.frontier, 2)
  game.completed = Array.from({ length: GARDENS.length }, (_, i) => i)
  assert.equal(game.frontier, GARDENS.length - 1)
})

test('the hidden developer switch opens every garden without moving the frontier', () => {
  const memory = new Map()
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) }
  const game = new GardenGame(storage)
  game.unlockAll = true
  assert.ok(game.isUnlocked(150))
  assert.equal(game.frontier, 0)
  assert.ok(new GardenGame(storage).unlockAll, 'the switch is remembered')
  game.unlockAll = false
  assert.ok(!game.isUnlocked(150))
})
