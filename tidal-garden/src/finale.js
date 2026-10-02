import * as THREE from 'three'

const clamp = THREE.MathUtils.clamp
const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x) }
const WATER_Y = 0.06
const TAU = Math.PI * 2

// How the camera holds the finished garden: lifted to show the cliffs, slowly turning.
export const FINALE_VIEW = Object.freeze({ tilt: 38 * Math.PI / 180, spin: 0.12 })

// When each part of the finale begins and how long it takes, in seconds.
// A celebration plays out in full; revisiting a finished garden eases straight into evening.
export function finaleTimeline(mode, reducedMotion = false) {
  if (reducedMotion) return { lift: [0, 0], dusk: [0, 0], lights: 0, wave: false, flock: false, card: 0, spin: false }
  if (mode === 'celebrate') return { lift: [0.8, 3], dusk: [1.2, 4.8], lights: 3.4, wave: true, flock: true, card: 4.8, spin: true }
  return { lift: [0, 1.6], dusk: [0, 1.8], lights: 0.6, wave: false, flock: false, card: 1, spin: true }
}

function hash(index) {
  return THREE.MathUtils.euclideanModulo(Math.sin(index * 91.7 + 47.3) * 43758.5453, 1)
}

// A value that eases from one level to another over a set span of time.
class Tween {
  constructor(value = 0) { this.from = value; this.to = value; this.start = 0; this.duration = 0 }
  set(to, time, duration, delay = 0) {
    this.from = this.at(time)
    this.to = to
    this.start = time + delay
    this.duration = duration
  }
  at(time) { return this.duration <= 0 ? (time >= this.start ? this.to : this.from) : THREE.MathUtils.lerp(this.from, this.to, smooth((time - this.start) / this.duration)) }
  done(time) { return time >= this.start + this.duration }
}

// The end of a garden is the reward: the interface steps aside, a wave of life rolls out
// from the last tile, the camera lifts and turns the island in the evening light, a flock
// circles overhead, and fireflies and floating lanterns come out. Everything is derived
// from the finished grid, so it works for any garden.
export class Finale {
  constructor(garden) {
    this.garden = garden
    this.active = false
    this.mode = null
    this.started = -100
    this.blend = new Tween()
    this.dusk = new Tween()
    this.yaw = 0
    this.yawTween = null
    this.drag = null
    this.dragRelease = -100
    this.queue = []
    this.fireflies = []
    this.lanterns = []
    this.flock = []
    this.flockStarted = null
    this.flockLeaving = null
    this.buildGlow()
    this.buildLanterns()
  }

  get view() { return { blend: this.blend.at(this.garden.time), dusk: this.dusk.at(this.garden.time), yaw: this.yaw } }
  // Shadows only need refreshing while the light moves or the flock flies.
  get busy() { const time = this.garden.time; return !this.blend.done(time) || !this.dusk.done(time) || this.flock.some((bird) => bird.root.visible) }

  // Soft glowing points for fireflies and lanterns, sized in world units.
  buildGlow() {
    const count = this.garden.mobile ? 34 : 52
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 24)
    this.glowMaterial = new THREE.ShaderMaterial({
      // Light is added without touching alpha, so glows over the page's own background stay bright.
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { uScale: { value: 1 } },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 color;
        uniform float uScale;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = color;
          gl_PointSize = aSize * uScale;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float glow = exp(-d * d * 5.0) * 0.55 + (1.0 - smoothstep(0.08, 0.2, d));
          if (glow * vAlpha < 0.004) discard;
          gl_FragColor = vec4(vColor * glow * vAlpha, 0.0);
          #include <colorspace_fragment>
        }
      `,
    })
    this.glow = new THREE.Points(geometry, this.glowMaterial)
    this.glow.frustumCulled = false
    this.glow.renderOrder = 25
    this.glow.visible = false
    this.garden.scene.add(this.glow)
    this.glowCapacity = count
  }

  buildLanterns() {
    this.lanternGroup = new THREE.Group()
    this.garden.scene.add(this.lanternGroup)
    const paper = new THREE.MeshBasicMaterial({ color: 0xffd79a })
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a5a3c })
    const lid = new THREE.MeshBasicMaterial({ color: 0xf2a65e })
    const body = new THREE.CylinderGeometry(0.045, 0.055, 0.085, 10).translate(0, 0.0425, 0)
    const cap = new THREE.CylinderGeometry(0.03, 0.06, 0.025, 10).translate(0, 0.095, 0)
    const raft = new THREE.CylinderGeometry(0.075, 0.075, 0.016, 12)
    for (let i = 0; i < (this.garden.mobile ? 4 : 6); i++) {
      const root = new THREE.Group()
      root.add(new THREE.Mesh(raft, wood), new THREE.Mesh(body, paper), new THREE.Mesh(cap, lid))
      root.children.forEach((mesh) => { mesh.castShadow = false })
      root.visible = false
      this.lanternGroup.add(root)
      this.lanterns.push({ root, x: 0, z: 0, phase: i * 1.9, delay: i * 0.45, placed: false })
    }
  }

  buildFlock() {
    if (this.flock.length) return
    const count = this.garden.mobile ? 5 : 7
    for (let i = 0; i < count; i++) {
      const model = this.garden.completions.wildlife.model('songbirds', i, 3)
      model.root.visible = false
      this.garden.scene.add(model.root)
      // Each bird keeps its own place in a loose, wavering ring.
      this.flock.push({ ...model, lag: i * 0.62 + hash(i) * 0.2, lane: (hash(i + 9) - 0.5) * 0.7, height: 1.9 + hash(i + 3) * 0.45, flap: hash(i + 5) * 7 })
    }
  }

  // Land cells host fireflies and open water hosts lanterns, chosen from the finished grid.
  arrange(grid) {
    const land = [], water = []
    grid.forEach((row, r) => row.forEach((value, c) => (value === 1 ? land : water).push({ row: r, col: c })))
    this.fireflies = []
    const fireflyCount = this.glowCapacity - this.lanterns.length * 2
    for (let i = 0; i < fireflyCount && land.length; i++) {
      const cell = land[Math.floor(hash(i * 3 + 1) * land.length)]
      this.fireflies.push({
        // Homes stay far enough inside the tray that their wandering never leaves it.
        x: clamp(cell.col - 4.5 + (hash(i * 5 + 2) - 0.5) * 0.8, -4.65, 4.65), z: clamp(cell.row - 4.5 + (hash(i * 7 + 4) - 0.5) * 0.8, -4.65, 4.65),
        y: 0.82 + hash(i * 11 + 6) * 0.6, phase: hash(i * 13 + 8) * TAU, speed: 0.7 + hash(i * 17 + 3) * 0.8, delay: hash(i * 19 + 5) * 2.4,
      })
    }
    // Lanterns float in open water, spread apart from one another.
    const life = this.garden.waterLife
    const open = water.map((cell) => ({ x: cell.col - 4.5, z: cell.row - 4.5, order: hash(cell.row * 10 + cell.col + 40) }))
      .filter((spot) => life.isOpen(spot.x, spot.z, 0.2)).sort((a, b) => a.order - b.order)
    const chosen = []
    for (const spot of open) {
      if (chosen.length >= this.lanterns.length) break
      if (chosen.every((other) => Math.hypot(other.x - spot.x, other.z - spot.z) > 2.1)) chosen.push(spot)
    }
    this.lanterns.forEach((lantern, i) => {
      lantern.placed = i < chosen.length
      if (lantern.placed) Object.assign(lantern, { x: chosen[i].x, z: chosen[i].z })
      lantern.root.visible = false
    })
  }

  start(mode, origin = null) {
    const garden = this.garden
    const time = garden.time
    const plan = finaleTimeline(mode, garden.reducedMotion)
    this.active = true
    this.mode = mode
    this.plan = plan
    this.started = time
    this.yawTween = null
    this.drag = null
    this.blend.set(1, time, plan.lift[1], plan.lift[0])
    this.dusk.set(1, time, plan.dusk[1], plan.dusk[0])
    this.arrange(garden.grid)
    this.queue = []
    garden.clearSelection()
    if (plan.wave && origin) this.wave(origin)
    this.flockLeaving = null
    if (plan.flock) {
      this.buildFlock()
      this.flock.forEach((bird) => { bird.root.visible = false })
      this.flockStarted = time + 2.4
    } else this.flockStarted = null
  }

  // Lowers the lights and lowers the camera back to the board, wherever the turn has reached.
  stop() {
    if (!this.active) return
    const time = this.garden.time
    const quick = this.garden.reducedMotion ? 0 : 1.3
    this.active = false
    this.queue = []
    this.drag = null
    this.blend.set(0, time, quick)
    this.dusk.set(0, time, quick)
    const home = Math.round(this.yaw / TAU) * TAU
    this.yawTween = new Tween(this.yaw)
    this.yawTween.set(home, time, quick)
    if (this.flockStarted !== null) this.flockLeaving = time
  }

  // A wave of life rolls out from the last tile: islands bounce and shed petals,
  // and fish leap and ripples spread as it passes over the water.
  wave(origin) {
    const garden = this.garden
    const time = garden.time
    const petals = [0xffd3df, 0xffffff, 0xffe07a, 0xff9fb2, 0xc6ef94].map((hex) => new THREE.Color(hex))
    const waters = []
    for (const cell of garden.cells) {
      const dx = cell.col - origin.col, dz = cell.row - origin.row
      const distance = Math.hypot(dx, dz)
      const at = time + 0.3 + distance * 0.12
      if (cell.value === 1) {
        cell.reactionAt = at
        if (distance) cell.direction.set(dx / distance, dz / distance)
        else cell.direction.set(0, 1)
        cell.reactionStrength = 1.2
        this.queue.push({ at: at + 0.05, run: () => this.petals(cell, petals) })
      } else waters.push({ cell, at, distance })
    }
    // A handful of fish and ripples along the wave, spread across the water.
    const picked = []
    for (const water of waters.sort((a, b) => hash(a.cell.row * 10 + a.cell.col) - hash(b.cell.row * 10 + b.cell.col))) {
      if (picked.length >= 7) break
      if (picked.every((other) => Math.hypot(other.cell.col - water.cell.col, other.cell.row - water.cell.row) > 2.2)) picked.push(water)
    }
    picked.forEach((water, index) => {
      const x = water.cell.col - 4.5, z = water.cell.row - 4.5
      this.queue.push({ at: water.at, run: () => {
        const t = garden.time
        garden.ripples[garden.rippleIndex].set(x, z, t, 1)
        garden.rippleIndex = (garden.rippleIndex + 1) % garden.ripples.length
        if (index % 2 === 0 || !garden.waterLife.startLeap(x, z, hash(index) * TAU, t)) garden.waterLife.ring(x, z, t, 2)
      } })
    })
    this.queue.sort((a, b) => a.at - b.at)
  }

  petals(cell, colors) {
    const garden = this.garden
    const x = cell.col - 4.5, z = cell.row - 4.5
    for (let i = 0; i < 4; i++) {
      const angle = hash(cell.row * 10 + cell.col + i * 31) * TAU
      const speed = 0.25 + hash(i * 7 + cell.col) * 0.45
      garden.particles.push({ x, z, height: garden.cellHeight(cell) + 0.15, started: garden.time, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, vy: 1 + hash(i + cell.row) * 0.6, color: colors[(i + cell.row + cell.col) % colors.length], petal: true })
    }
    garden.particles = garden.particles.slice(-garden.particleMesh.instanceMatrix.count)
  }

  // Dragging turns the island by hand; it picks the slow turn back up shortly after release.
  grab(x) { if (this.active) this.drag = { x, yaw: this.yaw } }
  move(x) { if (this.drag) this.yaw = this.drag.yaw + (x - this.drag.x) * 0.008 }
  release() { if (this.drag) { this.drag = null; this.dragRelease = this.garden.time } }

  update(time, delta) {
    const garden = this.garden
    const quiet = garden.reducedMotion
    while (this.queue.length && this.queue[0].at <= time) this.queue.shift().run()
    // The turn starts as the camera lifts and pauses briefly while the island is held.
    if (this.yawTween) {
      this.yaw = this.yawTween.at(time)
      if (this.yawTween.done(time)) { this.yaw = 0; this.yawTween = null }
    } else if (this.active && this.plan.spin && !this.drag) {
      const age = time - this.started
      const ramp = smooth((age - this.plan.lift[0]) / 2.5) * smooth((time - this.dragRelease - 1) / 2)
      this.yaw += FINALE_VIEW.spin * ramp * delta
    }
    const dusk = this.dusk.at(time)
    this.updateGlow(time, dusk, quiet)
    this.updateLanterns(time, dusk, quiet)
    this.updateFlock(time, quiet)
  }

  updateGlow(time, dusk, quiet) {
    const shown = dusk > 0.01
    this.glow.visible = shown
    if (!shown) return
    const { position, aSize, aAlpha, color } = this.glow.geometry.attributes
    const warm = new THREE.Color(0xf1ff8c), lantern = new THREE.Color(0xffb562)
    const clock = quiet ? 0 : time
    const age = this.active ? time - this.started - this.plan.lights : 10
    let n = 0
    for (const fly of this.fireflies) {
      const appear = quiet ? 1 : smooth((age - fly.delay) / 1.5)
      const x = fly.x + Math.sin(clock * 0.37 * fly.speed + fly.phase) * 0.22 + Math.sin(clock * 0.91 + fly.phase * 2) * 0.06
      const z = fly.z + Math.cos(clock * 0.29 * fly.speed + fly.phase) * 0.22
      const y = fly.y + Math.sin(clock * 0.6 + fly.phase) * 0.12 - (1 - appear) * 0.3
      const blink = quiet ? 0.8 : 0.3 + 0.7 * smooth(Math.sin(clock * fly.speed * 1.4 + fly.phase) * 0.6 + 0.5)
      position.setXYZ(n, x, y, z)
      aSize.setX(n, 0.3)
      aAlpha.setX(n, blink * appear * dusk)
      color.setXYZ(n, warm.r, warm.g, warm.b)
      n++
    }
    // Each lantern glows above the water and casts a softer glow on the surface beneath it.
    for (const item of this.lanterns) {
      for (const reflection of [0, 1]) {
        const appear = item.placed ? item.appear ?? 0 : 0
        position.setXYZ(n, item.root.position.x, reflection ? WATER_Y + 0.01 : item.root.position.y + 0.06, item.root.position.z)
        aSize.setX(n, reflection ? 0.75 : 0.42)
        aAlpha.setX(n, appear * dusk * (reflection ? 0.32 : 0.85) * (quiet ? 1 : 0.9 + Math.sin(clock * 5 + item.phase) * 0.1))
        color.setXYZ(n, lantern.r, lantern.g, lantern.b)
        n++
      }
    }
    for (; n < this.glowCapacity; n++) aAlpha.setX(n, 0)
    position.needsUpdate = aSize.needsUpdate = aAlpha.needsUpdate = color.needsUpdate = true
  }

  updateLanterns(time, dusk, quiet) {
    const clock = quiet ? 0 : time
    const age = this.active ? time - this.started - this.plan.lights - 0.4 : 10
    for (const item of this.lanterns) {
      item.appear = item.placed ? (quiet ? 1 : smooth((age - item.delay) / 1.4)) * smooth(dusk * 1.6 - 0.3) : 0
      item.root.visible = item.appear > 0.01
      if (!item.root.visible) continue
      // They rise from the water, bob gently, and drift in slow circles.
      const drift = clock * 0.18 + item.phase
      item.root.position.set(item.x + Math.cos(drift) * 0.12, WATER_Y - 0.004 - (1 - item.appear) * 0.14 + Math.sin(clock * 1.3 + item.phase) * 0.008, item.z + Math.sin(drift) * 0.12)
      item.root.rotation.set(Math.sin(clock * 0.9 + item.phase) * 0.05, drift, Math.cos(clock * 1.1 + item.phase) * 0.05)
      item.root.scale.setScalar(Math.max(0.001, item.appear))
    }
  }

  // The flock sweeps in from beyond the tray, circles the island a few times, and flies off.
  updateFlock(time, quiet) {
    if (this.flockStarted === null || !this.flock.length) return
    const age = time - this.flockStarted
    const leaving = this.flockLeaving !== null ? time - this.flockLeaving : null
    for (const bird of this.flock) {
      const t = age - bird.lag
      const arrive = smooth(t / 3)
      const depart = leaving !== null ? smooth(leaving / 2.2) : smooth((t - 17) / 4)
      bird.root.visible = !quiet && t > 0 && depart < 1
      if (!bird.root.visible) continue
      const angle = -t * 0.42 - bird.lag * 0.5 + 2.4
      const radius = 3.4 + bird.lane + Math.sin(t * 0.7 + bird.flap) * 0.25 + (1 - arrive) * 9 + depart * 10
      const y = bird.height + Math.sin(t * 1.1 + bird.flap) * 0.12 + depart * 2.2
      bird.root.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      // Clockwise travel: the bird faces along its path and banks into the turn.
      bird.root.rotation.set(0, Math.atan2(Math.sin(angle), -Math.cos(angle)), 0)
      bird.root.rotateZ(-0.35 * arrive * (1 - depart))
      bird.root.scale.setScalar(2.4)
      const flap = Math.sin(time * (arrive < 1 || depart > 0 ? 24 : 16) + bird.flap) * 1.1
      bird.wings.forEach((wing, i) => { wing.rotation.z = flap * (i ? 1 : -1) })
      if (bird.tail) bird.tail.rotation.y = Math.sin(time * 3 + bird.flap) * 0.15
    }
    if (this.flock.every((bird) => !bird.root.visible) && (leaving !== null || age > 30)) { this.flockStarted = null; this.flockLeaving = null }
  }
}
