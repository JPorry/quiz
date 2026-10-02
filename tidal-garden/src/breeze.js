import * as THREE from 'three'

const SPEED = 2.6
const PASS = 2.8
const START = 7.5
const STREAKS = 7
const LEAVES = 16
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

// A wavy ribbon, tapered at both ends, lying flat along +x: a cartoon gust of wind.
function streakGeometry() {
  const segments = 24, positions = [], indices = []
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, x = (u - 0.5) * 2
    const y = Math.sin(u * Math.PI * 2.2) * 0.09 + (u > 0.8 ? (u - 0.8) ** 2 * 4 : 0)
    const half = 0.034 * Math.sin(u * Math.PI) ** 0.7
    positions.push(x, 0, y - half, x, 0, y + half)
    if (i < segments) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

// Every so often a breeze sweeps across the garden: trees and flowers bow as it passes
// over them, wind streaks and loose leaves drift across, and the water ruffles.
export class Breeze {
  constructor(garden) {
    this.garden = garden
    this.random = random(77031)
    this.gust = null
    this.nextGust = 9 + this.random() * 8
    this.shift = new THREE.Vector2()
    this.strength = 0
    const scene = garden.scene
    const streak = streakGeometry()
    this.streaks = Array.from({ length: STREAKS }, () => {
      const mesh = new THREE.Mesh(streak, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }))
      mesh.renderOrder = 6
      mesh.visible = false
      scene.add(mesh)
      return { mesh, lateral: 0, lag: 0, height: 0 }
    })
    const leaf = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2)
    const colors = [0x6fc25f, 0x9fe282, 0xff9fb2, 0xffe07a]
    this.leaves = Array.from({ length: LEAVES }, (_, i) => {
      const mesh = new THREE.Mesh(leaf, new THREE.MeshLambertMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }))
      mesh.scale.set(0.085, 1, 0.045)
      mesh.castShadow = true
      mesh.visible = false
      scene.add(mesh)
      return { mesh, lateral: 0, lag: 0, phase: 0 }
    })
  }

  start(time) {
    const angle = this.random() * Math.PI * 2
    const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle))
    this.gust = { start: time, dir, perp: new THREE.Vector2(-dir.y, dir.x), strength: 0.75 + this.random() * 0.35 }
    this.streaks.forEach((streak) => Object.assign(streak, { lateral: (this.random() - 0.5) * 10, lag: this.random() * 2.5, height: 0.8 + this.random() * 0.4 }))
    this.leaves.forEach((leaf) => Object.assign(leaf, { lateral: (this.random() - 0.5) * 9, lag: 0.3 + this.random() * 2.2, phase: this.random() * 10 }))
  }

  // How far the breeze bends a plant standing at (x, z), in radians.
  bend(x, z, time) {
    const gust = this.gust
    if (!gust) return 0
    const local = time - gust.start - (x * gust.dir.x + z * gust.dir.y + START) / SPEED
    if (local < 0 || local > PASS) return 0
    const wave = Math.sin(local / PASS * Math.PI) ** 2
    return gust.strength * wave * (0.3 + Math.sin(time * 8.5 + x * 2.1 + z * 1.7) * 0.07)
  }

  update(time, dt, reducedMotion) {
    if (reducedMotion) return
    if (!this.gust && time > this.nextGust) this.start(time)
    const gust = this.gust
    const duration = (START * 2) / SPEED + PASS
    const age = gust ? time - gust.start : 0
    if (gust && age > duration) {
      this.gust = null
      this.nextGust = time + 14 + this.random() * 20
    }
    // The water's wave marks hurry along while the gust blows over.
    this.strength = this.gust ? Math.sin(clamp(age / duration, 0, 1) * Math.PI) ** 2 * gust.strength : 0
    if (this.gust) this.shift.addScaledVector(gust.dir, this.strength * dt * 0.45)
    const front = age * SPEED - START
    for (const streak of this.streaks) {
      const along = front - streak.lag
      const visible = !!this.gust && along > -6 && along < 6
      streak.mesh.visible = visible
      if (!visible) continue
      const fade = Math.sin(clamp((along + 6) / 12, 0, 1) * Math.PI)
      streak.mesh.material.opacity = 0.85 * fade * gust.strength
      streak.mesh.position.set(gust.dir.x * along + gust.perp.x * streak.lateral, streak.height, gust.dir.y * along + gust.perp.y * streak.lateral)
      streak.mesh.rotation.y = -Math.atan2(gust.dir.y, gust.dir.x)
      streak.mesh.scale.set(0.8 + fade * 0.4, 1, 1 + Math.sin(time * 5 + streak.lag) * 0.25)
    }
    for (const leaf of this.leaves) {
      const along = front - leaf.lag
      const visible = !!this.gust && Math.abs(along) < 5.4 && Math.abs(leaf.lateral) < 5.2
      leaf.mesh.visible = visible
      if (!visible) continue
      const sway = Math.sin(time * 3 + leaf.phase) * 0.35
      leaf.mesh.position.set(gust.dir.x * along + gust.perp.x * (leaf.lateral + sway), 0.95 + Math.sin(time * 2.3 + leaf.phase) * 0.22, gust.dir.y * along + gust.perp.y * (leaf.lateral + sway))
      leaf.mesh.rotation.set(Math.sin(time * 6 + leaf.phase) * 1.2, time * 4 + leaf.phase, Math.cos(time * 5 + leaf.phase) * 0.8)
    }
  }

  get active() {
    return !!this.gust
  }
}
