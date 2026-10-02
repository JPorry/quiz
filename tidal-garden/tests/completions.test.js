import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { RegionCompletions } from '../src/completions.js'
import { COMPLETION_VARIANTS } from '../src/terrain.js'

function fixture(reducedMotion = false) {
  const material = new THREE.MeshBasicMaterial()
  const owner = {
    scene: new THREE.Scene(), time: 10, reducedMotion,
    cells: Array.from({ length: 100 }, () => ({ land: new THREE.Group(), plants: new THREE.Group() })),
    mesh(geometry, material, parent, x, y, z) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      parent.add(mesh)
      return mesh
    },
    addFlower(parent, x, y, z) { this.mesh(new THREE.SphereGeometry(0.03, 4, 3), material, parent, x, y, z) },
    mergeDetails() {},
  }
  return { owner, completions: new RegionCompletions(owner) }
}

test('finished details survive animation and reload but disappear on undo', () => {
  for (const value of [0, 1]) {
    const { owner, completions } = fixture()
    const grid = Array.from({ length: 5 }, () => Array(5).fill(1 - value))
    grid[2][2] = value
    grid[1][2] = null
    completions.update(grid, false)
    assert.equal(completions.regions.size, 0)
    grid[1][2] = 1 - value
    completions.update(grid, true)
    const [region] = completions.regions.values()
    const habitat = region.habitat.kind
    assert.equal(habitat, null, 'Single-cell landmarks keep decoration without animals')
    assert.deepEqual(region.habitat.actors, [])
    assert.ok(region.nodes.length > 0)
    assert.equal(completions.events.length, 1)
    assert.equal(completions.active.length, 1)
    completions.update(grid, true)
    assert.equal(completions.events.length, 1, 'Repeated UI renders must not retrigger')
    completions.animate(owner.time + 4)
    assert.equal(completions.active.length, 0)
    assert.equal(region.nodes[0].group.scale.x, 1)
    assert.ok(owner.scene.children.includes(region.group))
    grid[1][2] = null
    completions.update(grid, true)
    assert.equal(completions.regions.size, 0)
    assert.ok(!owner.scene.children.includes(region.group))
    grid[1][2] = 1 - value
    completions.clear()
    completions.update(grid, false)
    completions.animate(owner.time)
    assert.equal(completions.regions.size, 1)
    assert.equal([...completions.regions.values()][0].habitat.kind, habitat, 'Reload keeps single-cell landmarks animal-free')
    assert.deepEqual([...completions.regions.values()][0].habitat.actors, [])
    assert.equal(completions.active.length, 0, 'Reload restores detail, not the celebration')
    assert.equal(completions.events.length, 0)
    assert.ok([...completions.regions.values()][0].habitat.actors.every((actor) => actor.root.scale.x === actor.size))
    completions.clear()
    assert.equal(owner.scene.children.length, 0)
  }
})

test('all six effects animate within bounds and release their transient resources', () => {
  for (const value of [0, 1]) for (const variant of COMPLETION_VARIANTS[value]) {
    const { owner, completions } = fixture()
    const region = { id: `${value}:2,2`, value, cells: [{ row: 2, col: 2 }] }
    const effect = completions.makeEffect(region, variant)
    let disposed = 0
    effect.group.traverse((child) => child.material?.addEventListener('dispose', () => disposed++))
    completions.active.push(effect)
    completions.animate(owner.time + 0.8)
    assert.ok(effect.particles.some((particle) => particle.mesh.visible && particle.mesh.material.opacity > 0))
    for (const particle of effect.particles) {
      assert.ok(particle.mesh.position.toArray().every(Number.isFinite))
      assert.ok(particle.mesh.position.y > 0 && particle.mesh.position.y < 2)
    }
    assert.ok(effect.rings.length > 0, 'Each completion has a ground-level flourish')
    completions.animate(owner.time + 4)
    assert.equal(completions.active.length, 0)
    assert.equal(disposed, effect.particles.length + effect.rings.length)
    assert.equal(owner.scene.children.length, 0)
  }
})

test('reduced motion keeps the finished state without transient effects', () => {
  const { owner, completions } = fixture(true)
  const grid = [[0, 0, 0], [0, 1, 0], [0, 0, 0]]
  completions.update(grid, true)
  completions.animate(owner.time)
  assert.equal(completions.regions.size, 1)
  assert.equal(completions.active.length, 0)
  assert.equal([...completions.regions.values()][0].nodes[0].group.scale.x, 1)
})
