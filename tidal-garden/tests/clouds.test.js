import test from 'node:test'
import assert from 'node:assert/strict'
import { cloudDelay, makeCloud, cloudCenter } from '../src/clouds.js'

function seeded(seed) {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296
}

test('clouds are rare and irregular', () => {
  const random = seeded(7)
  const first = cloudDelay(random, true)
  assert.ok(first >= 25 && first <= 60, 'the first cloud takes a while to arrive')
  const gaps = Array.from({ length: 200 }, () => cloudDelay(random))
  assert.ok(gaps.every((gap) => gap >= 45 && gap <= 120), 'later clouds are well spaced')
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 40, 'the spacing varies')
})

test('each cloud starts and ends beyond the tray and crosses along its own line', () => {
  const random = seeded(11)
  const headings = new Set()
  for (let i = 0; i < 50; i++) {
    const cloud = makeCloud(random, 5.3, 0)
    headings.add(Math.round(Math.atan2(cloud.dir.z, cloud.dir.x) * 2))
    const start = cloudCenter(cloud, 0), end = cloudCenter(cloud, cloud.travel / cloud.speed - 0.01)
    assert.ok(Math.hypot(start.x, start.z) > 5.3 + cloud.size, 'enters from off the board')
    assert.ok(Math.hypot(end.x, end.z) > 5.3 + cloud.size, 'leaves off the board')
    assert.equal(cloudCenter(cloud, cloud.travel / cloud.speed + 0.1).done, true)
    assert.ok(cloud.puffs.length >= 5 && cloud.puffs.length <= 8)
    // A crossing takes a calm 15 to 45 seconds.
    const crossing = cloud.travel / cloud.speed
    assert.ok(crossing > 15 && crossing < 45, `crossing took ${crossing}s`)
  }
  assert.ok(headings.size > 6, 'clouds come from many directions')
})
