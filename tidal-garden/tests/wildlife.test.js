import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { HABITATS, chooseHabitat, habitatSeed, habitatRoute, habitatArea, HabitatWildlife } from '../src/wildlife.js'

function owner(reducedMotion = false) {
  return {
    reducedMotion,
    cells: Array.from({ length: 100 }, () => ({ land: new THREE.Group(), plants: new THREE.Group() })),
    mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      parent.add(mesh)
      return mesh
    },
    mergeDetails() {},
  }
}

function regionFor(kind) {
  const value = HABITATS[0].includes(kind) ? 0 : 1
  for (let row = 1; row < 9; row++) for (let col = 1; col < 8; col++) {
    const region = { id: `${value}:${row},${col};${row},${col + 1}`, value, cells: [{ row, col }, { row, col: col + 1 }] }
    if (chooseHabitat(region) === kind) return region
  }
  throw new Error(`No fixture for ${kind}`)
}

test('each terrain has four habitats with stable but varied residents', () => {
  for (const value of [0, 1]) {
    const seen = new Set()
    for (let row = 1; row < 9; row++) for (let col = 1; col < 9; col++) {
      const region = { id: `${value}:${row},${col}`, value }
      const kind = chooseHabitat(region)
      assert.ok(HABITATS[value].includes(kind))
      assert.equal(chooseHabitat(region), kind)
      assert.equal(habitatSeed(region), habitatSeed(region))
      seen.add(kind)
    }
    assert.equal(seen.size, 4)
  }
})

test('swimming routes are closed cardinal walks contained within the habitat', () => {
  const cells = [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 3, col: 3 }, { row: 3, col: 4 }]
  const route = habitatRoute(cells)
  assert.deepEqual(route[0], route.at(-1))
  assert.equal(new Set(route.map((cell) => `${cell.row}:${cell.col}`)).size, cells.length)
  route.slice(1).forEach((cell, index) => assert.equal(Math.abs(cell.row - route[index].row) + Math.abs(cell.col - route[index].col), 1))
})

test('habitat areas keep a margin from foreign shores but open between their own cells', () => {
  const inside = habitatArea([{ row: 2, col: 2 }, { row: 2, col: 3 }], 0.2)
  assert.equal(inside(-2.5, -2.5), true)
  assert.equal(inside(-2.0, -2.5), true, 'The seam between two habitat cells is open')
  assert.equal(inside(-2.9, -2.5), false, 'Too close to the western shore')
  assert.equal(inside(-2.5, -2.1), false, 'Too close to the southern shore')
  assert.equal(inside(-0.5, -2.5), false, 'Outside the habitat')
})

test('residents wander their whole habitat without bumping into each other', () => {
  const cells = [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 4 }]
  for (const kind of Object.values(HABITATS).flat()) {
    const value = HABITATS[0].includes(kind) ? 0 : 1
    let region
    for (let i = 0; i < 400 && !region; i++) {
      const candidate = { id: `${value}:${i}`, value, cells }
      if (chooseHabitat(candidate) === kind) region = candidate
    }
    const wildlife = new HabitatWildlife(owner())
    const habitat = wildlife.create(region, new THREE.Group(), 0)
    let closest = Infinity
    const visited = new Set()
    for (let time = 0; time <= 60; time += 1 / 30) {
      wildlife.animate(habitat, time)
      for (const actor of habitat.actors) {
        const position = actor.root.position
        const col = Math.floor(position.x + 5), row = Math.floor(position.z + 5)
        assert.ok(cells.some((cell) => cell.row === row && cell.col === col), `${kind} left its habitat`)
        visited.add(`${row}:${col}`)
      }
      if (time > 3) for (const a of habitat.actors) for (const b of habitat.actors) {
        if (a !== b) closest = Math.min(closest, Math.hypot(a.root.position.x - b.root.position.x, a.root.position.z - b.root.position.z))
      }
    }
    assert.ok(closest > 0.08, `${kind} residents collide: ${closest.toFixed(3)}`)
    if (!['frogs', 'songbirds'].includes(kind)) assert.ok(visited.size >= 3, `${kind} should roam beyond its starting cells`)
  }
})

test('single-cell islands and lakes never add wildlife', () => {
  for (const value of [0, 1]) for (const reducedMotion of [false, true]) {
    const wildlife = new HabitatWildlife(owner(reducedMotion))
    const parent = new THREE.Group()
    const habitat = wildlife.create({ id: `${value}:2,2`, value, cells: [{ row: 2, col: 2 }] }, parent, 10)
    assert.equal(habitat.kind, null)
    assert.deepEqual(habitat.actors, [])
    assert.equal(habitat.group.children.length, 0)
    wildlife.animate(habitat, 10)
    wildlife.animate(habitat, 14)
    assert.equal(habitat.group.children.length, 0)
  }
})

test('all eight habitats arrive, remain alive, and use bounded detailed models', () => {
  for (const kind of Object.values(HABITATS).flat()) {
    const garden = owner(), wildlife = new HabitatWildlife(garden), parent = new THREE.Group()
    const region = regionFor(kind)
    const habitat = wildlife.create(region, parent, 10)
    assert.equal(habitat.kind, kind)
    assert.ok(habitat.actors.length >= 2 && habitat.actors.length <= 3)
    wildlife.animate(habitat, 10)
    assert.ok(habitat.actors[0].root.scale.x < 0.01)
    wildlife.animate(habitat, 14)
    assert.equal(habitat.actors[0].root.scale.x, habitat.actors[0].size)
    const poses = () => habitat.actors.flatMap((actor) => {
      const values = []
      actor.root.traverse((part) => values.push(...part.position.toArray(), part.rotation.x, part.rotation.y, part.rotation.z))
      return values
    })
    const before = poses()
    wildlife.animate(habitat, 16)
    assert.notDeepEqual(poses(), before, `${kind} should feel alive`)
    for (const actor of habitat.actors) {
      const position = actor.root.position
      assert.ok(position.toArray().every(Number.isFinite))
      assert.ok(position.y > 0 && position.y < 2)
      assert.ok(region.cells.some((cell) => Math.abs(position.x - (cell.col - 4.5)) <= 0.5 && Math.abs(position.z - (cell.row - 4.5)) <= 0.5), 'Residents stay within their habitat')
      let meshes = 0
      actor.root.traverse((child) => { if (child.isMesh) meshes++ })
      assert.ok(meshes >= 7, `${kind} needs readable anatomical detail`)
    }
  }
})

test('reduced motion preserves residents and freezes all idle animation', () => {
  for (const kind of Object.values(HABITATS).flat()) {
    const garden = owner(true), wildlife = new HabitatWildlife(garden)
    const habitat = wildlife.create(regionFor(kind), new THREE.Group(), 10)
    const matrices = () => {
      habitat.group.updateMatrixWorld(true)
      const values = []
      habitat.group.traverse((part) => values.push(...part.matrixWorld.elements))
      return values
    }
    wildlife.animate(habitat, 10)
    const before = matrices()
    wildlife.animate(habitat, 50)
    assert.deepEqual(matrices(), before, `${kind} must respect reduced motion`)
  }
})
