import test from 'node:test'
import assert from 'node:assert/strict'
import { showerStrength } from '../src/rain.js'
import { makeCloud } from '../src/clouds.js'

test('a shower builds as its cloud drifts over the tray and eases off as it leaves', () => {
  const reach = 5.3, size = 2.5
  assert.equal(showerStrength({ x: 0, z: 0 }, size, reach), 1, 'full strength overhead')
  assert.equal(showerStrength({ x: 20, z: 0 }, size, reach), 0, 'dry far away')
  const edge = showerStrength({ x: reach + 0.5, z: 0 }, size, reach)
  assert.ok(edge > 0 && edge < 1, 'light rain near the edge')
})

test('about a third of clouds bring rain, and rain clouds are darker', () => {
  let state = 3
  const random = () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296
  const clouds = Array.from({ length: 400 }, () => makeCloud(random, 5.3, 0))
  const rainy = clouds.filter((cloud) => cloud.rain)
  assert.ok(rainy.length > 100 && rainy.length < 180, `${rainy.length} of 400 rained`)
  const mean = (list) => list.reduce((sum, cloud) => sum + cloud.strength, 0) / list.length
  assert.ok(mean(rainy) > mean(clouds.filter((cloud) => !cloud.rain)) + 0.05)
})
