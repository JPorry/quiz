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

// A pretend iPhone: motion needs a tapped permission request, and listeners are recorded.
function iPhone(answer = 'granted') {
  const listeners = new Set()
  const requests = []
  globalThis.matchMedia = () => ({ matches: true })
  globalThis.DeviceOrientationEvent = class { static requestPermission() { requests.push(answer); return Promise.resolve(answer) } }
  globalThis.addEventListener = (type, fn) => { if (type === 'deviceorientation') listeners.add(fn) }
  globalThis.removeEventListener = (type, fn) => { if (type === 'deviceorientation') listeners.delete(fn) }
  const store = new Map()
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }
  return { listeners, requests, storage }
}

test('on iOS, a returning player is listened to and quietly re-confirmed on their first tap', async () => {
  const phone = iPhone()
  const first = new DeviceTilt({ storage: phone.storage })
  assert.equal(first.needsPermission, true)
  first.restore()
  assert.equal(first.shouldAsk, true, 'first visit asks on the first tap')
  assert.equal(await first.confirm(), 'granted')
  assert.equal(phone.listeners.size, 1)
  // The next visit, with tilting already allowed: it must not stay silently off.
  phone.listeners.clear()
  const again = new DeviceTilt({ storage: phone.storage })
  assert.equal(again.restore(), true, 'listens straight away')
  assert.equal(phone.listeners.size, 1)
  assert.equal(again.shouldAsk, true, 'and re-confirms on the first tap')
  assert.equal(await again.confirm(), 'granted')
  assert.equal(again.shouldAsk, false)
})

test('on iOS, turning tilting off or declining is respected on later visits', async () => {
  const phone = iPhone('denied')
  const tilt = new DeviceTilt({ storage: phone.storage })
  tilt.restore()
  assert.equal(await tilt.confirm(), 'denied')
  assert.equal(phone.listeners.size, 0)
  const later = new DeviceTilt({ storage: phone.storage })
  assert.equal(later.restore(), false)
  assert.equal(later.shouldAsk, false, 'no nagging after a no')
  delete globalThis.DeviceOrientationEvent
  delete globalThis.matchMedia
})
