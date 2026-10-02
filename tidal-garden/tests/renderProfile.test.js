import test from 'node:test'
import assert from 'node:assert/strict'
import { renderProfile, frameIsDue, scheduledFrameTime } from '../src/renderProfile.js'
import { waterFragmentColor } from '../src/ocean.js'

test('phone rendering bounds pixel density, water geometry, shadows, and frame rate', () => {
  for (const width of [320, 390, 699]) {
    const profile = renderProfile(width, 3)
    assert.equal(profile.maxFps, 30)
    assert.equal(profile.pixelRatio, 1.25)
    assert.equal(profile.shadowSize, 1024)
    assert.equal(profile.shadowInterval, 200)
  }
  assert.equal(renderProfile(390, 1).pixelRatio, 1)
  assert.deepEqual(renderProfile(844, 3, true), renderProfile(390, 3), 'Landscape phones keep the mobile budget')
  assert.equal(renderProfile(1440, 2).maxFps, 45)
})

test('render scheduling caps high-refresh screens and pauses hidden pages', () => {
  for (const refreshRate of [60, 120, 62.5]) {
    let lastFrame = -Infinity, count = 0
    for (let i = 0; i < refreshRate; i++) {
      const time = i * 1000 / refreshRate
      if (frameIsDue(time, lastFrame, 30)) { lastFrame = scheduledFrameTime(time, lastFrame, 30); count++ }
    }
    assert.equal(count, 30)
  }
  assert.equal(frameIsDue(1000, 0, 30, true), false)
  assert.equal(frameIsDue(1000, 0, 30, false), true)
  assert.ok(scheduledFrameTime(48, 0, 30) < 48, 'Keep fractional frame time so the cap does not slow uneven animation ticks')
})

test('water pixels keep a bounded sampling and loop budget', () => {
  assert.equal((waterFragmentColor.match(/texture2D\(/g) ?? []).length, 1, 'One shore field lookup')
  const loops = waterFragmentColor.match(/for \(int \w+ = 0; \w+ < (\d+);/g) ?? []
  assert.equal(loops.length, 1, 'Only the splash loop')
  assert.ok(Number(loops[0].match(/< (\d+)/)[1]) <= 8, 'Splash slots stay few')
})
