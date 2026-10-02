import * as THREE from 'three'

const SPEED = 2.4
const PASS = 3.4
const START = 7.5
const LEAVES = 10
const clamp = THREE.MathUtils.clamp

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = state + 0x6d2b79f5 >>> 0
    let t = state
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const hash = (x, y) => THREE.MathUtils.euclideanModulo(Math.sin(x * 127.1 + y * 311.7) * 43758.5453, 1)

// Smooth value noise in [0, 1], so the breeze varies gently from place to place.
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

// Every so often a breeze wanders across the garden. Its front is ragged, its strength comes in
// patches and puffs, and its heading swirls, so plants bow at different moments and angles,
// loose leaves tumble along curling paths, and the water ruffles.
export class Breeze {
  constructor(garden) {
    this.garden = garden
    this.random = random(77031)
    this.gust = null
    this.nextGust = 9 + this.random() * 8
    this.shift = new THREE.Vector2()
    this.strength = 0
    this.wind = { x: 0, z: 0, amount: 0 }
    const leaf = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2)
    const colors = [0x6fc25f, 0x9fe282, 0xff9fb2, 0xffe07a]
    this.leaves = Array.from({ length: LEAVES }, (_, i) => {
      const mesh = new THREE.Mesh(leaf, new THREE.MeshLambertMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }))
      mesh.scale.set(0.075, 1, 0.04)
      mesh.castShadow = true
      mesh.visible = false
      garden.scene.add(mesh)
      return { mesh, x: 0, z: 0, delay: 0, phase: 0 }
    })
  }

  start(time) {
    const angle = this.random() * Math.PI * 2
    const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle))
    const perp = new THREE.Vector2(-dir.y, dir.x)
    this.gust = { start: time, angle, dir, perp, seed: this.random() * 100, strength: 0.75 + this.random() * 0.35 }
    for (const leaf of this.leaves) {
      const lateral = (this.random() - 0.5) * 9
      Object.assign(leaf, { x: -dir.x * 6.2 + perp.x * lateral, z: -dir.y * 6.2 + perp.y * lateral, delay: this.random() * 2.5, phase: this.random() * 10 })
    }
  }

  // The breeze at (x, z): which way it blows there and how hard it bends a plant, in radians.
  windAt(x, z, time) {
    const wind = this.wind
    const gust = this.gust
    wind.amount = 0
    if (!gust) return wind
    const along = x * gust.dir.x + z * gust.dir.y, across = x * gust.perp.x + z * gust.perp.y
    // A ragged front: some islands feel the breeze a little before their neighbors.
    const arrival = (along + START) / SPEED + (noise(across * 0.22 + gust.seed, 3.7) - 0.5) * 2.6
    const local = time - gust.start - arrival
    const heading = gust.angle + (noise(x * 0.17 + gust.seed, z * 0.17 + time * 0.12) - 0.5) * 1.2
    wind.x = Math.cos(heading)
    wind.z = Math.sin(heading)
    if (local < 0 || local > PASS) return wind
    const swell = Math.sin(local / PASS * Math.PI) ** 2
    const puffs = 0.6 + 0.4 * Math.sin(local * 4.3 + noise(x * 0.4, z * 0.4 + gust.seed) * 6)
    const patch = 0.5 + noise(x * 0.33 + gust.seed * 2, z * 0.33 + time * 0.25)
    const flutter = Math.sin(time * 7.5 + x * 2.3 + z * 1.9) * 0.045
    wind.amount = gust.strength * swell * (puffs * patch * 0.3 + flutter)
    return wind
  }

  update(time, dt, reducedMotion) {
    if (reducedMotion) return
    if (!this.gust && time > this.nextGust) this.start(time)
    const gust = this.gust
    const duration = (START * 2 + 2.6) / SPEED + PASS
    const age = gust ? time - gust.start : 0
    if (gust && age > duration) {
      this.gust = null
      this.nextGust = time + 14 + this.random() * 20
    }
    // The water's wave marks hurry along while the breeze blows over.
    this.strength = this.gust ? Math.sin(clamp(age / duration, 0, 1) * Math.PI) ** 2 * gust.strength : 0
    if (this.gust) {
      const wander = gust.angle + (noise(time * 0.2, gust.seed) - 0.5) * 0.8
      this.shift.x += Math.cos(wander) * this.strength * dt * 0.45
      this.shift.y += Math.sin(wander) * this.strength * dt * 0.45
    }
    for (const leaf of this.leaves) {
      const flying = !!this.gust && age > leaf.delay
      if (flying) {
        // Leaves ride the local wind, curling and tumbling rather than sliding in a line.
        const wind = this.windAt(leaf.x, leaf.z, time)
        const curl = Math.sin(time * 1.7 + leaf.phase) * 0.9
        const speed = SPEED * 0.75 + wind.amount * 3
        leaf.x += (wind.x * speed - wind.z * curl) * dt
        leaf.z += (wind.z * speed + wind.x * curl) * dt
      }
      const visible = flying && Math.abs(leaf.x) < 5.3 && Math.abs(leaf.z) < 5.3
      leaf.mesh.visible = visible
      if (!visible) continue
      leaf.mesh.position.set(leaf.x, 0.85 + Math.sin(time * 2.1 + leaf.phase) * 0.25 + Math.sin(time * 5.3 + leaf.phase) * 0.05, leaf.z)
      leaf.mesh.rotation.set(Math.sin(time * 6 + leaf.phase) * 1.3, time * 3.5 + leaf.phase, Math.cos(time * 4.6 + leaf.phase) * 0.9)
    }
  }

  get active() {
    return !!this.gust
  }
}
