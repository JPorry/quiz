import test from 'node:test'
import assert from 'node:assert/strict'
import { screenTilt, leanFor, MAX_LEAN, DeviceTilt } from '../src/tilt.js'

test('tilt follows the screen, whichever way it is turned', () => {
  assert.deepEqual(screenTilt(10, 5, 0), { side: 5, front: 10 })
  assert.deepEqual(screenTilt(10, 5, 90), { side: 10, front: -5 })
  assert.deepEqual(screenTilt(10, 5, -90), { side: -10, front: 5 })
  assert.deepEqual(screenTilt(10, 5, 180), { side: -5, front: -10 })
})

test('the board leans only a little, and never past its limit', () => {
  assert.equal(leanFor(0), 0)
  assert.ok(leanFor(5) > 0 && leanFor(5) < MAX_LEAN)
  assert.ok(Math.abs(leanFor(90) - MAX_LEAN) < 1e-12)
  assert.ok(Math.abs(leanFor(-90) + MAX_LEAN) < 1e-12)
  assert.ok(MAX_LEAN <= 10 * Math.PI / 180, 'a gentle lean, not a spin')
})

test('the board leans as the phone turns, then settles back to level however it is held', () => {
  const tilt = new DeviceTilt({ storage: null })
  tilt.enabled = true
  // Held at a comfortable reading angle: that becomes level.
  tilt.reading = { side: 0, front: 40 }
  tilt.level = { side: 0, front: 40 }
  for (let i = 0; i < 30; i++) tilt.update(1 / 30)
  assert.equal(tilt.front, 0)
  // Dipping the right edge leans the board right, smoothly.
  tilt.reading = { side: 12, front: 40 }
  const first = tilt.update(1 / 30).side
  for (let i = 0; i < 15; i++) tilt.update(1 / 30)
  assert.ok(first > 0 && tilt.side > first, 'eases toward the lean')
  // Held still in the new position, it drifts back to level.
  for (let i = 0; i < 30 * 40; i++) tilt.update(1 / 30)
  assert.ok(Math.abs(tilt.side) < 0.002, `settled at ${tilt.side}`)
})
