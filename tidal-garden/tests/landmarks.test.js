import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseLandmark, landmarkCorner } from '../src/landmarks.js'

test('starting land gets a mix of landmarks, mostly quiet stones', () => {
  const counts = {}
  for (let i = 0; i < 1000; i++) {
    const kind = chooseLandmark(i / 1000)
    counts[kind] = (counts[kind] ?? 0) + 1
  }
  assert.deepEqual(Object.keys(counts).sort(), ['arch', 'cairn', 'lantern', 'standing'])
  assert.ok(counts.standing + counts.cairn > counts.lantern + counts.arch, 'stones outnumber structures')
  assert.ok(counts.arch < counts.lantern, 'arches are the rare treat')
})

test('landmarks sit in a corner, clear of the planting in the middle', () => {
  const corners = new Set()
  for (let i = 0; i < 40; i++) {
    const { x, z } = landmarkCorner(i / 40)
    assert.equal(Math.abs(x), 0.27)
    assert.equal(Math.abs(z), 0.27)
    corners.add(`${x}:${z}`)
  }
  assert.equal(corners.size, 4)
})
