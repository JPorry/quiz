import * as THREE from 'three'

export const SPLASH_SLOTS = 6
const DROPLETS = 96
const GRAVITY = 3.2
const clamp = THREE.MathUtils.clamp
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))

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

// A little fish silhouette, nose toward +z, for shadows seen through the water.
function fishShape() {
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.085)
  shape.bezierCurveTo(0.04, -0.075, 0.042, 0.02, 0.012, 0.055)
  shape.lineTo(0.04, 0.095)
  shape.lineTo(0, 0.078)
  shape.lineTo(-0.04, 0.095)
  shape.lineTo(-0.012, 0.055)
  shape.bezierCurveTo(-0.042, 0.02, -0.04, -0.075, 0, -0.085)
  return new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2)
}

// The water is never still: fish shadows cruise between the islands, now and then
// one leaps clear of the surface, and every new water tile lands with a splash.
export class WaterLife {
  constructor(garden, { reach, waterY }) {
    this.garden = garden
    this.reach = reach
    this.waterY = waterY
    this.grid = null
    this.random = random(20260402)
    this.splashes = Array.from({ length: SPLASH_SLOTS }, () => new THREE.Vector4(0, 0, -100, 0))
    this.splashIndex = 0
    this.nextLeap = 4
    const scene = garden.scene

    const plumeMaterial = new THREE.MeshLambertMaterial({ color: 0xc9f4f1, transparent: true, opacity: 0.9 })
    const column = new THREE.CylinderGeometry(0.045, 0.2, 1, 20, 1, true).translate(0, 0.5, 0)
    const crown = new THREE.SphereGeometry(0.08, 16, 12)
    // From above, height barely reads, so the splash also throws out a ring-shaped crown of water.
    const halo = new THREE.TorusGeometry(0.2, 0.04, 8, 32).rotateX(Math.PI / 2)
    this.plumes = Array.from({ length: 4 }, () => {
      const group = new THREE.Group()
      const haloMaterial = new THREE.MeshLambertMaterial({ color: 0xe6fbf8, transparent: true, opacity: 0.95 })
      const plume = { group, column: garden.mesh(column, plumeMaterial, group), crown: garden.mesh(crown, plumeMaterial, group), halo: garden.mesh(halo, haloMaterial, group), started: -10 }
      group.visible = false
      scene.add(group)
      return plume
    })

    this.drops = []
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), DROPLETS)
    this.dropMesh.count = 0
    this.dropMesh.castShadow = true
    scene.add(this.dropMesh)
    this.dummy = new THREE.Object3D()
    // Instance colors must exist before the first draw, or the material compiles without them.
    for (let i = 0; i < DROPLETS; i++) this.dropMesh.setColorAt(i, new THREE.Color(0xffffff))
    this.dropColors = [new THREE.Color(0xf4fdfb), new THREE.Color(0xa8ecec), new THREE.Color(0xd6f7f4)]

    // Leaping fish are tiny koi, shared between ambient leaps and placement surprises.
    const fishMaterials = { white: new THREE.MeshLambertMaterial({ color: 0xfffaf0 }), koi: new THREE.MeshLambertMaterial({ color: 0xff7a45 }), ink: new THREE.MeshLambertMaterial({ color: 0x2c2b36 }) }
    const sphere = new THREE.SphereGeometry(1, 14, 10)
    this.leapers = Array.from({ length: 3 }, (_, index) => {
      const root = new THREE.Group(), body = new THREE.Group(), tail = new THREE.Group()
      root.add(body)
      const part = (parent, material, position, scale) => garden.mesh(sphere, material, parent, ...position).scale.set(...scale)
      part(body, index % 2 ? fishMaterials.koi : fishMaterials.white, [0, 0, 0], [0.034, 0.03, 0.075])
      part(body, fishMaterials.koi, [0, 0.016, 0.02], [0.024, 0.016, 0.03])
      for (const side of [-1, 1]) part(body, fishMaterials.ink, [side * 0.022, 0.012, 0.05], [0.007, 0.008, 0.006])
      tail.position.z = -0.07
      part(tail, fishMaterials.koi, [0, 0, -0.03], [0.006, 0.034, 0.032])
      root.add(tail)
      root.visible = false
      scene.add(root)
      return { root, tail, leap: null }
    })

    this.shadowGeometry = fishShape()
    this.shoal = Array.from({ length: garden.mobile ? 4 : 6 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({ color: 0x0b4f63, transparent: true, opacity: 0, depthWrite: false })
      const mesh = new THREE.Mesh(this.shadowGeometry, material)
      mesh.position.y = waterY + 0.004
      mesh.renderOrder = 1
      mesh.scale.setScalar(0.85 + (index % 3) * 0.18)
      scene.add(mesh)
      return { mesh, x: 0, z: 0, heading: this.random() * Math.PI * 2, wander: 0, phase: index * 1.7, opacity: 0, hidden: false, placed: false }
    })
  }

  // Land and empty sockets are both solid; only poured water and the tray's margin are swimmable.
  isLand(x, z) {
    const value = this.grid?.[Math.floor(z + 5)]?.[Math.floor(x + 5)]
    return value === 1 || value === null
  }

  // Open water, clear of the tray edge and a little way off every shore.
  isOpen(x, z, margin = 0.16) {
    if (Math.abs(x) > this.reach - margin || Math.abs(z) > this.reach - margin) return false
    return !this.isLand(x, z) && !this.isLand(x + margin, z) && !this.isLand(x - margin, z) && !this.isLand(x, z + margin) && !this.isLand(x, z - margin)
  }

  ring(x, z, time, kind) {
    this.splashes[this.splashIndex].set(x, z, time, kind)
    this.splashIndex = (this.splashIndex + 1) % SPLASH_SLOTS
  }

  spray(x, z, count, time, { speed = 0.7, lift = 1.5, height = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + this.random() * 0.4
      const v = speed * (0.6 + this.random() * 0.6)
      this.drops.push({ x, y: this.waterY + height, z, vx: Math.cos(angle) * v, vy: lift * (0.7 + this.random() * 0.5), vz: Math.sin(angle) * v, born: time, size: 0.6 + this.random() * 0.7, color: this.dropColors[i % 3] })
    }
    if (this.drops.length > DROPLETS) this.drops.splice(0, this.drops.length - DROPLETS)
  }

  // A new water tile: a column of water leaps up and collapses into a crown of droplets.
  splash(x, z, time) {
    const plume = this.plumes.find((candidate) => time - candidate.started > 0.9) ?? this.plumes[0]
    plume.started = time
    plume.group.position.set(x, this.waterY - 0.02, z)
    plume.group.visible = true
    this.ring(x, z, time, 1)
    this.spray(x, z, 22, time, { speed: 1.05, lift: 1.8 })
    if (this.random() < 0.4) this.startLeap(x, z, this.random() * Math.PI * 2, time + 0.35, true)
  }

  startLeap(x, z, heading, time, fromSplash = false) {
    const leaper = this.leapers.find((candidate) => !candidate.leap)
    if (!leaper) return false
    const distance = 0.55
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = heading + attempt * Math.PI / 4
      const x1 = x + Math.sin(angle) * distance, z1 = z + Math.cos(angle) * distance
      if (!this.isOpen(x1, z1, 0.1)) continue
      leaper.leap = { x0: x, z0: z, x1, z1, heading: angle, start: time, duration: 0.8, height: fromSplash ? 0.5 : 0.4, launched: false }
      return true
    }
    return false
  }

  update(time, dt, reducedMotion) {
    if (reducedMotion) {
      this.placeShoal()
      return
    }
    this.animatePlumes(time)
    this.animateDrops(time, dt)
    this.animateLeaps(time)
    this.animateShoal(time, dt)
  }

  animatePlumes(time) {
    for (const plume of this.plumes) {
      const t = (time - plume.started) / 0.75
      plume.group.visible = t >= 0 && t < 1
      if (!plume.group.visible) continue
      // Shoots up fast, hangs for a beat, then slumps back into the water.
      const rise = Math.sin(Math.min(1, t / 0.55) * Math.PI)
      const height = Math.max(0.001, rise * 0.62)
      plume.column.scale.set(1 - t * 0.35, height, 1 - t * 0.35)
      plume.crown.position.y = height + 0.02
      plume.crown.scale.setScalar(Math.max(0.001, 1.25 - t * 0.7))
      const burst = 1 - (1 - Math.min(1, t * 1.6)) ** 2
      plume.halo.scale.set(0.4 + burst * 1.5, 1 + Math.sin(Math.min(1, t * 1.6) * Math.PI) * 1.5, 0.4 + burst * 1.5)
      plume.halo.position.y = 0.02 + Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.1
      plume.halo.material.opacity = 0.95 * (1 - t) ** 0.7
    }
  }

  animateDrops(time, dt) {
    this.drops = this.drops.filter((drop) => {
      drop.x += drop.vx * dt
      drop.z += drop.vz * dt
      drop.vy -= GRAVITY * dt
      drop.y += drop.vy * dt
      return drop.y > this.waterY - 0.02 && time - drop.born < 2
    })
    this.dropMesh.count = this.drops.length
    this.drops.forEach((drop, index) => {
      this.dummy.position.set(drop.x, drop.y, drop.z)
      const stretch = 1 + Math.min(1.2, Math.abs(drop.vy) * 0.35)
      this.dummy.scale.set(drop.size, drop.size * stretch, drop.size)
      this.dummy.updateMatrix()
      this.dropMesh.setMatrixAt(index, this.dummy.matrix)
      this.dropMesh.setColorAt(index, drop.color)
    })
    this.dropMesh.instanceMatrix.needsUpdate = true
    if (this.dropMesh.instanceColor) this.dropMesh.instanceColor.needsUpdate = true
  }

  animateLeaps(time) {
    if (time > this.nextLeap) {
      // Every so often a fish from the shoal breaks the surface.
      const fish = this.shoal.filter((candidate) => candidate.placed && !candidate.hidden && this.isOpen(candidate.x, candidate.z, 0.25))
      const chosen = fish[Math.floor(this.random() * fish.length)]
      if (chosen && this.startLeap(chosen.x, chosen.z, chosen.heading, time)) {
        chosen.hidden = true
        chosen.leaper = this.leapers.find((leaper) => leaper.leap?.start === time)
      }
      this.nextLeap = time + 5 + this.random() * 7
    }
    for (const leaper of this.leapers) {
      const leap = leaper.leap
      if (!leap) continue
      const t = (time - leap.start) / leap.duration
      if (t < 0) continue
      if (!leap.launched) {
        leap.launched = true
        this.ring(leap.x0, leap.z0, time, 2)
        this.spray(leap.x0, leap.z0, 7, time, { speed: 0.35, lift: 1.1 })
      }
      if (t >= 1) {
        this.ring(leap.x1, leap.z1, time, 2)
        this.spray(leap.x1, leap.z1, 9, time, { speed: 0.4, lift: 1.0 })
        leaper.root.visible = false
        leaper.leap = null
        const fish = this.shoal.find((candidate) => candidate.leaper === leaper)
        if (fish) Object.assign(fish, { hidden: false, leaper: null, x: leap.x1, z: leap.z1, heading: leap.heading })
        continue
      }
      leaper.root.visible = true
      const x = THREE.MathUtils.lerp(leap.x0, leap.x1, t), z = THREE.MathUtils.lerp(leap.z0, leap.z1, t)
      leaper.root.position.set(x, this.waterY - 0.04 + Math.sin(t * Math.PI) * leap.height, z)
      leaper.root.rotation.set(0, leap.heading, 0)
      leaper.root.rotateX(-Math.cos(t * Math.PI) * 0.95)
      leaper.tail.rotation.y = Math.sin(time * 30) * 0.5
    }
  }

  placeShoal() {
    for (const fish of this.shoal) {
      if (fish.placed) continue
      for (let attempt = 0; attempt < 40; attempt++) {
        const x = (this.random() - 0.5) * 2 * (this.reach - 0.3), z = (this.random() - 0.5) * 2 * (this.reach - 0.3)
        if (!this.isOpen(x, z)) continue
        Object.assign(fish, { x, z, placed: true })
        break
      }
      fish.mesh.position.x = fish.x
      fish.mesh.position.z = fish.z
      fish.mesh.rotation.y = fish.heading
    }
  }

  animateShoal(time, dt) {
    this.placeShoal()
    for (const fish of this.shoal) {
      // Fish caught under freshly placed land slip away and turn up somewhere else.
      const stranded = !this.isOpen(fish.x, fish.z, 0.05)
      const visible = fish.placed && !fish.hidden && !stranded
      fish.opacity = clamp(fish.opacity + (visible ? dt : -dt * 3), 0, 1)
      fish.mesh.material.opacity = fish.opacity * 0.34
      if (stranded && fish.opacity === 0) { fish.placed = false; continue }
      if (fish.hidden || !fish.placed) continue
      fish.wander = clamp(fish.wander + (this.random() - 0.5) * dt * 3, -0.8, 0.8)
      let desired = fish.heading + fish.wander * dt * 2
      const ahead = (angle, distance) => this.isOpen(fish.x + Math.sin(angle) * distance, fish.z + Math.cos(angle) * distance)
      if (!ahead(fish.heading, 0.45)) {
        const left = ahead(fish.heading + 0.9, 0.4), right = ahead(fish.heading - 0.9, 0.4)
        desired = fish.heading + (left && !right ? 1 : right && !left ? -1 : (fish.wander >= 0 ? 1 : -1)) * 1.6
      }
      for (const other of this.shoal) {
        if (other === fish || !other.placed) continue
        const gap = Math.hypot(fish.x - other.x, fish.z - other.z)
        if (gap < 0.32 && gap > 0) desired += wrapAngle(Math.atan2(fish.x - other.x, fish.z - other.z) - fish.heading) * 0.4
      }
      fish.heading = wrapAngle(fish.heading + clamp(wrapAngle(desired - fish.heading), -2.6 * dt, 2.6 * dt))
      const speed = 0.28 * (0.65 + 0.35 * Math.sin(time * 1.3 + fish.phase))
      const nx = fish.x + Math.sin(fish.heading) * speed * dt, nz = fish.z + Math.cos(fish.heading) * speed * dt
      if (this.isOpen(nx, nz, 0.1)) { fish.x = nx; fish.z = nz } else fish.heading = wrapAngle(fish.heading + Math.PI * dt * 2)
      fish.mesh.position.x = fish.x
      fish.mesh.position.z = fish.z
      fish.mesh.rotation.y = fish.heading + Math.sin(time * 7 + fish.phase) * 0.12
    }
  }
}
