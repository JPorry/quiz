import * as THREE from 'three'
import { cloudCenter } from './clouds.js'

const clamp = THREE.MathUtils.clamp
const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x) }
const LAND_TOP = 0.44
const WATER_Y = 0.06
const SOCKET_TOP = 0.1
const FALL_FROM = 2.6
const FALL_SPEED = 7
const UP = new THREE.Vector3(0, 1, 0)

// How hard a rain cloud is raining right now: it builds as the cloud drifts over the tray
// and eases off as it leaves.
export function showerStrength(center, size, reach) {
  const out = Math.max(Math.abs(center.x), Math.abs(center.z))
  return smooth((reach + size * 0.8 - out) / (size * 1.4))
}

// A passing shower: slanted streaks fall beneath a rain cloud, each drop dimpling the
// water or splashing on the grass.
export class Rain {
  constructor(garden, { reach, random = Math.random }) {
    this.garden = garden
    this.reach = reach
    this.random = random
    this.drops = []
    this.marks = []
    this.capacity = garden.mobile ? 140 : 240
    this.dummy = new THREE.Object3D()
    this.streaks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xf2faff, transparent: true, opacity: 0.75, depthWrite: false }), this.capacity)
    this.streaks.count = 0
    this.streaks.frustumCulled = false
    garden.scene.add(this.streaks)
    // Rings brighten what is under them; their color fades them out.
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.035, 0.055, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    }), this.capacity)
    this.rings.count = 0
    this.rings.frustumCulled = false
    this.rings.renderOrder = 2
    for (let i = 0; i < this.capacity; i++) this.rings.setColorAt(i, new THREE.Color(0xffffff))
    garden.scene.add(this.rings)
    this.ringColor = new THREE.Color()
    this.strength = 0
  }

  // A little cat's-paw ripple on open water, for gusts that skim across it.
  ruffle(x, z, time) {
    this.marks.push({ x, z, y: WATER_Y + 0.008, land: false, born: time })
  }

  surface(x, z) {
    const value = this.garden.grid?.[Math.floor(z + 5)]?.[Math.floor(x + 5)]
    return value === 1 ? { y: LAND_TOP, land: true } : value === null ? { y: SOCKET_TOP, land: true } : { y: WATER_Y, land: false }
  }

  // A raindrop lands somewhere under one of the cloud's puffs, inside the tray.
  spawnDrop(cloud, center, time) {
    const puff = cloud.puffs[Math.floor(this.random() * cloud.puffs.length)]
    const angle = this.random() * Math.PI * 2, distance = Math.sqrt(this.random()) * puff.r * 0.8
    const x = center.x + puff.x + Math.cos(angle) * distance, z = center.z + puff.z + Math.sin(angle) * distance
    if (Math.abs(x) > this.reach - 0.2 || Math.abs(z) > this.reach - 0.2) return
    const ground = this.surface(x, z)
    // Rain slants a little with the cloud's drift.
    const vx = cloud.dir.x * 2.2, vz = cloud.dir.z * 2.2
    const fall = (FALL_FROM - ground.y) / FALL_SPEED
    this.drops.push({ x, z, vx, vz, ground, born: time, lands: time + fall })
  }

  update(time, dt, clouds, reducedMotion) {
    let strength = 0
    if (!reducedMotion && !this.garden.finale?.active) {
      for (const cloud of clouds.clouds) {
        if (!cloud.rain) continue
        const center = cloudCenter(cloud, time)
        const amount = showerStrength(center, cloud.size, this.reach)
        strength = Math.max(strength, amount)
        // A heavier shower drops more at once; fractions carry over between frames.
        cloud.owed = (cloud.owed ?? 0) + amount * (this.garden.mobile ? 80 : 140) * dt
        while (cloud.owed >= 1 && this.drops.length < this.capacity) { cloud.owed -= 1; this.spawnDrop(cloud, center, time) }
        cloud.owed = Math.min(cloud.owed, 4)
      }
    }
    this.strength = strength
    this.updateDrops(time)
  }

  updateDrops(time) {
    const landed = this.drops.filter((drop) => time >= drop.lands)
    for (const drop of landed) this.marks.push({ x: drop.x, z: drop.z, y: drop.ground.y + 0.008, land: drop.ground.land, born: time })
    this.drops = this.drops.filter((drop) => time < drop.lands)
    this.marks = this.marks.filter((mark) => time - mark.born < (mark.land ? 0.35 : 0.7)).slice(-this.capacity)
    const direction = new THREE.Vector3()
    this.drops.forEach((drop, index) => {
      const left = drop.lands - time
      this.dummy.position.set(drop.x - drop.vx * left, drop.ground.y + FALL_SPEED * left + 0.15, drop.z - drop.vz * left)
      direction.set(drop.vx, FALL_SPEED, drop.vz).normalize()
      this.dummy.quaternion.setFromUnitVectors(UP, direction)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.streaks.setMatrixAt(index, this.dummy.matrix)
    })
    this.streaks.count = this.drops.length
    this.streaks.instanceMatrix.needsUpdate = true
    this.marks.forEach((mark, index) => {
      const t = (time - mark.born) / (mark.land ? 0.35 : 0.7)
      this.dummy.position.set(mark.x, mark.y, mark.z)
      this.dummy.quaternion.identity()
      this.dummy.scale.setScalar((mark.land ? 0.5 : 0.7) + t * (mark.land ? 1 : 2.8))
      this.dummy.updateMatrix()
      this.rings.setMatrixAt(index, this.dummy.matrix)
      this.rings.setColorAt(index, this.ringColor.setRGB(0.85, 0.95, 1).multiplyScalar((1 - t) ** 1.5 * (mark.land ? 0.45 : 0.85)))
    })
    this.rings.count = this.marks.length
    this.rings.instanceMatrix.needsUpdate = true
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true
  }
}
