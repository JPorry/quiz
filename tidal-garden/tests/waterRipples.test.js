import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { WaterRipples, clearWaterPath } from '../src/waterRipples.js'
import { terrainIsSolid } from '../src/ocean.js'

test('ripples leave their source tile but cannot pass through another land cell', () => {
  const terrain = new Uint8Array(16 * 16 * 4)
  terrain[(8 * 16 + 8) * 4] = 180
  assert.equal(clearWaterPath(terrain, 0.5, 0.5, -1.5, 0.5), true)
  terrain[(8 * 16 + 9) * 4] = 180
  assert.equal(clearWaterPath(terrain, 0.5, 0.5, 2.5, 0.5), false)
  assert.equal(clearWaterPath(terrain, 0.5, 0.5, 1.5, 0.5), false)
})

test('placement rings are visible, bounded, water-only, and expire without new geometry', () => {
  const terrain = new Uint8Array(16 * 16 * 4)
  terrain[(8 * 16 + 8) * 4] = 180
  const ripples = new WaterRipples(terrain)
  const geometry = ripples.mesh.geometry
  const events = [new THREE.Vector4(0.5, 0.5, 10, 0)]
  ripples.animate(10.4, events)
  assert.equal(ripples.active, 1)
  assert.equal(ripples.mesh.visible, true)
  assert.ok(geometry.attributes.position.count < 3000)
  const positions = geometry.attributes.position, colors = geometry.attributes.color
  let visible = 0
  for (let index = 0; index < positions.count; index++) {
    if (colors.getW(index) <= 0) continue
    visible++
    assert.equal(terrainIsSolid(terrain, positions.getX(index), positions.getZ(index)), false)
  }
  assert.ok(visible > 0)
  ripples.animate(13, events)
  assert.equal(ripples.mesh.visible, false)
  assert.equal(ripples.mesh.geometry, geometry)
  assert.equal(geometry.drawRange.count, 0)
})

test('ripples cannot leak diagonally through touching land corners', () => {
  const terrain = new Uint8Array(16 * 16 * 4)
  assert.equal(clearWaterPath(terrain, 0.5, 0.5, 1.5, 1.5), true)
  assert.equal(clearWaterPath(terrain, 0.5, 0.5, -1, 2), true)
  terrain[(8 * 16 + 9) * 4] = 180
  terrain[(9 * 16 + 8) * 4] = 180
  assert.equal(clearWaterPath(terrain, 0.5, 0.5, 1.5, 1.5), false)
  assert.equal(clearWaterPath(terrain, 1.5, 1.5, 0.5, 0.5), false)
})

test('reduced motion suppresses placement rings', () => {
  const ripples = new WaterRipples(new Uint8Array(16 * 16 * 4), true)
  ripples.animate(10.4, [new THREE.Vector4(0.5, 0.5, 10, 1)])
  assert.equal(ripples.active, 0)
  assert.equal(ripples.mesh.visible, false)
})
