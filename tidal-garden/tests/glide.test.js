import test from 'node:test'
import assert from 'node:assert/strict'
import { glide } from '../src/glide.js'

function run(seconds, state = { value: 0, velocity: 0 }, target = 1) {
  for (let i = 0; i < Math.round(seconds * 30); i++) state = glide(state.value, target, state.velocity, 2.6, 1 / 30)
  return state
}

test('light eases out of rest instead of lurching when a tile lands', () => {
  assert.ok(run(0.5).value < 0.08, 'barely moves in the first half second')
  assert.ok(run(3).value > 0.6 && run(3).value < 0.75, 'well underway after a few seconds')
  assert.ok(run(9).value > 0.98, 'settles within several seconds')
})

test('never overshoots, and a new target mid-glide keeps its speed', () => {
  let state = { value: 0, velocity: 0 }
  for (let i = 0; i < 600; i++) {
    state = glide(state.value, 1, state.velocity, 2.6, 1 / 30)
    assert.ok(state.value <= 1 + 1e-9)
  }
  const moving = run(1)
  const retargeted = glide(moving.value, 2, moving.velocity, 2.6, 1 / 30)
  assert.ok(Math.abs(retargeted.velocity - moving.velocity) < 0.05, 'no jump in speed when the target moves')
})
