import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { toon, outline, seeded } from './look.js'
import { cellGeometry, COLORS } from './flowers.js'
import { buildGarden, pebbles, SOIL_Y } from './garden.js'
import { World } from './world.js'

// A tilted diorama of a garden seen through a fixed orthographic camera. Every
// cell's plants are one baked mesh; they pop up when planted, grow buds when
// their bed is complete, and bloom in a wave across the garden when it is solved.

const ELEVATION = 53 * Math.PI / 180
const FINALE_ELEVATION = 78 * Math.PI / 180
const LINE = 0x3f5a32
const clamp = THREE.MathUtils.clamp
// a springy grow from `from` to full size as k goes from 0 to 1
const spring = (k, from = 0) => from + (1 - from) * (1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5))

const PUFF = new THREE.SphereGeometry(1, 6, 4)
const PETAL = new THREE.CircleGeometry(1, 7)
const SPARK = new THREE.OctahedronGeometry(1, 0)
const WING = new THREE.CircleGeometry(1, 12).scale(1, 0.75, 1).translate(1, 0, 0)
const BODY = new THREE.CapsuleGeometry(1, 2, 2, 6)
const MARK = new RoundedBoxGeometry(0.92, 0.01, 0.92, 2, 0.12)
const BUTTERFLY_COLORS = [0xffb3d1, 0xfff0a0, 0xb8e0ff, 0xd9c2ff, 0xffd0a8, 0xffffff]

class Flyer {
  // a butterfly, or a bee when `bee` is set, circling a point in the garden
  constructor(parent, color, bee, seed) {
    this.group = new THREE.Group()
    parent.add(this.group)
    this.bee = bee
    const wingMat = bee ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }) : toon(color, { rim: 0.3 }).clone()
    wingMat.side = THREE.DoubleSide
    const size = bee ? 0.045 : 0.085
    this.wings = [-1, 1].map((s) => {
      const pivot = new THREE.Group()
      const w = new THREE.Mesh(WING, wingMat)
      w.rotation.x = -Math.PI / 2
      w.scale.setScalar(size)
      pivot.add(w)
      pivot.scale.x = s
      this.group.add(pivot)
      return pivot
    })
    const body = new THREE.Mesh(BODY, toon(bee ? 0xffc93a : 0x5a4050))
    body.scale.set(bee ? 0.03 : 0.012, bee ? 0.022 : 0.03, bee ? 0.03 : 0.012)
    body.rotation.x = Math.PI / 2
    this.group.add(body)
    if (bee) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 5, 12), toon(0x3a2a2a))
      stripe.scale.setScalar(0.03)
      this.group.add(stripe)
    }
    const rand = seeded(seed)
    this.phase = rand() * 10
    this.speed = (bee ? 1.6 : 0.7) * (0.8 + rand() * 0.4)
    this.radius = [0.35 + rand() * 0.5, 0.3 + rand() * 0.4]
    this.home = new THREE.Vector3()
    this.k = 0
  }

  update(dt, time) {
    this.k = Math.min(1, this.k + dt * 0.8)
    const t = time * this.speed + this.phase
    const x = this.home.x + Math.cos(t) * this.radius[0]
    const z = this.home.z + Math.sin(t * 1.3) * this.radius[1]
    const y = this.home.y + 0.45 + Math.sin(t * 2.1) * 0.08 + (1 - this.k) * 1.5
    const dx = -Math.sin(t) * this.radius[0], dz = Math.cos(t * 1.3) * this.radius[1] * 1.3
    this.group.position.set(x, y, z)
    this.group.rotation.y = Math.atan2(dx, dz)
    const flap = Math.sin(time * (this.bee ? 60 : 16) + this.phase) * (this.bee ? 0.5 : 0.9)
    for (const w of this.wings) w.rotation.z = flap
  }

  dispose() { this.group.removeFromParent() }
}

export class GardenScene {
  constructor(container) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: new URLSearchParams(location.search).has('capture') })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    // shadows are redrawn only while something that casts one is changing
    this.renderer.shadowMap.autoUpdate = false
    this.shadowFrames = 0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.append(this.renderer.domElement)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200)
    this.sky = new THREE.HemisphereLight(0xf6fbff, 0xb9dca0, 1.5)
    this.sun = new THREE.DirectionalLight(0xfff3df, 1.9)
    this.sun.position.set(-4, 10, 5)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sky, this.sun, this.sun.target)
    this.world = new THREE.Group()
    this.scene.add(this.world)
    this.around = new World(this.scene)
    this.ray = new THREE.Raycaster()
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SOIL_Y)
    this.time = 0
    this.glow = 0
    this.glowTarget = 0
    this.elevation = ELEVATION
    this.elevationTarget = ELEVATION
    this.plantMaterial = toon(0xffffff, { vertexColors: true, rim: 0.2 })
    this.plantLine = outline(LINE, 0.006)
    this.markMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.38, depthWrite: false })
    new ResizeObserver(() => this.resize()).observe(container)
  }

  // flowers: the flower of each bed; fixed: the cells planted at the start
  load(board, flowers, fixed, { seed = 1 } = {}) {
    this.world.clear()
    for (const f of this.flyers ?? []) f.dispose()
    this.board = board
    this.flowers = flowers
    this.fx = []
    this.flyers = []
    this.bedFlyers = new Map()
    this.glowTarget = 0
    this.elevationTarget = ELEVATION
    const garden = buildGarden(board, flowers, seed)
    this.world.add(garden.group)
    this.beds = garden.beds.map((b) => ({ ...b, grow: 0, target: 0 }))
    this.world.add(pebbles(fixed, board.width, board.height))
    this.cells = Array.from({ length: board.cells }, (_, i) => {
      const group = new THREE.Group()
      group.position.copy(this.center(i))
      const mesh = new THREE.Mesh(undefined, this.plantMaterial)
      mesh.castShadow = true
      const line = new THREE.Mesh(undefined, this.plantLine)
      group.add(mesh, line)
      group.visible = false
      this.world.add(group)
      const mark = new THREE.Mesh(MARK, this.markMaterial)
      mark.position.copy(group.position)
      mark.position.y += 0.004
      mark.visible = false
      this.world.add(mark)
      return { i, group, mesh, line, mark, key: '', value: 0, stage: 'sprout', k: 1, from: 0, leaving: false, wobble: -1, pending: null, phase: i * 1.7 }
    })
    const reach = Math.max(board.width, board.height) / 2 + 2
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: 40 })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.shadowFrames = 3
    this.elevation = ELEVATION
    this.seed = seed
    this.resize()
  }

  center(i) {
    const { width, height } = this.board
    return new THREE.Vector3((i % width) + 0.5 - width / 2, SOIL_Y, Math.floor(i / width) + 0.5 - height / 2)
  }

  // states[i] = { value, stage, wilt } for every cell
  setCells(states, { quiet = false } = {}) {
    states.forEach((s, i) => {
      const c = this.cells[i]
      const key = s.value ? `${this.flowers[this.board.bedOf[i]]}|${s.stage}|${s.value}|${s.wilt}` : ''
      c.mark.visible = !!s.wilt
      if (key === c.key) return
      if (!s.value) {
        c.key = ''
        c.pending = null
        if (c.value) { c.leaving = true; c.k = 0 }
        c.value = 0
        return
      }
      const change = () => {
        const fresh = !c.value || c.leaving || s.value !== c.value
        const grew = c.stage !== s.stage
        c.key = key
        c.value = s.value
        c.stage = s.stage
        c.leaving = false
        const geometry = cellGeometry(this.flowers[this.board.bedOf[i]], s.stage, s.value, s.wilt)
        c.mesh.geometry = geometry
        c.line.geometry = geometry
        c.group.visible = true
        if (quiet) { c.k = 1; return }
        c.k = 0
        c.from = fresh ? 0 : grew ? 0.55 : 0.85
        this.shadowFrames = 3
      }
      // the finale opens the flowers in a wave from the middle of the garden
      if (s.stage === 'bloom' && c.stage !== 'bloom' && !quiet) {
        const p = this.center(i)
        c.pending = { at: this.time + 0.25 + Math.hypot(p.x, p.z) * 0.22, change }
      } else {
        c.pending = null
        change()
      }
    })
  }

  // grow: 0 bare soil, about half for a complete bed, 1 in bloom
  setBeds(levels, { quiet = false } = {}) {
    levels.forEach((target, b) => {
      const bed = this.beds[b]
      bed.target = target
      if (quiet) { bed.grow = target; bed.material.userData.grow.value = target }
      // a butterfly comes to visit every complete bed
      const wants = target > 0 && this.bedFlyers.size < 7
      if (wants && !this.bedFlyers.has(b)) {
        const f = new Flyer(this.world, BUTTERFLY_COLORS[b % BUTTERFLY_COLORS.length], false, b * 31 + 7)
        f.home.copy(this.bedCenter(b))
        if (quiet) f.k = 1
        this.bedFlyers.set(b, f)
        this.flyers.push(f)
      } else if (!target && this.bedFlyers.has(b)) {
        const f = this.bedFlyers.get(b)
        f.dispose()
        this.flyers = this.flyers.filter((x) => x !== f)
        this.bedFlyers.delete(b)
      }
    })
  }

  bedCenter(b) {
    const p = new THREE.Vector3()
    for (const i of this.board.beds[b]) p.add(this.center(i))
    return p.divideScalar(this.board.beds[b].length)
  }

  wobble(i) { this.cells[i].wobble = 0 }

  puff(i, color = 0x7a4e33, n = 7) {
    const p = this.center(i)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random()
      this.spawn(PUFF, color, p.clone().add(new THREE.Vector3(Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12)), new THREE.Vector3(Math.cos(a) * 0.8, 1.2 + Math.random() * 0.6, Math.sin(a) * 0.8), 0.022 + Math.random() * 0.012, { life: 0.55, gravity: 5 })
    }
  }

  // sparkles rise from every cell of a bed that has just been completed
  sparkleBed(b) {
    const color = COLORS[this.flowers[b]].petal
    for (const i of this.board.beds[b]) {
      const p = this.center(i)
      for (let k = 0; k < 4; k++) {
        this.spawn(SPARK, k % 2 ? 0xfff2a8 : color, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.1, (Math.random() - 0.5) * 0.7)), new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3), 0.03, { life: 1, gravity: 0.6, spin: 6, basic: true })
      }
    }
  }

  spawn(geometry, color, position, velocity, size, { life = 1, gravity = 1, spin = 0, basic = false, drift = 0 } = {}) {
    const mesh = new THREE.Mesh(geometry, basic ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }) : toon(color))
    mesh.position.copy(position)
    mesh.scale.setScalar(size)
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0)
    this.world.add(mesh)
    this.fx.push({ mesh, v: velocity, life, age: 0, gravity, spin, drift, size, own: basic })
  }

  // a little pop of petals as a cell bursts into bloom
  burst(i) {
    const color = COLORS[this.flowers[this.board.bedOf[i]]].petal
    const p = this.center(i)
    for (let k = 0; k < 3; k++) {
      this.spawn(SPARK, k ? color : 0xfff2a8, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.15, (Math.random() - 0.5) * 0.5)), new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.9, (Math.random() - 0.5) * 0.4), 0.025, { life: 0.8, gravity: 0.8, spin: 6, basic: true })
    }
  }

  celebrate() {
    this.glowTarget = 1
    this.elevationTarget = FINALE_ELEVATION
    this.petals = 6
    for (let k = 0; k < 3; k++) {
      const f = new Flyer(this.world, 0, true, 90 + k * 13)
      f.home.set((k - 1) * 1.2, SOIL_Y, 0)
      f.radius = [this.board.width * 0.3, this.board.height * 0.3]
      this.flyers.push(f)
    }
  }

  /* ---------- picking ---------- */

  toWorld(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    return this.ray.ray.intersectPlane(this.plane, hit) ? hit : null
  }

  cellAt(p) {
    const { width, height } = this.board
    const c = Math.floor(p.x + width / 2), r = Math.floor(p.z / this.world.scale.z + height / 2)
    return c >= 0 && c < width && r >= 0 && r < height ? r * width + c : null
  }

  /* ---------- framing ---------- */

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    if (this.board) this.frame()
  }

  frame() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (!w || !h) return
    this.camera.position.set(0, Math.sin(this.elevation) * 40, Math.cos(this.elevation) * 40)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
    // Rows stretch to make up for the tilt, so cells look square and the garden
    // fills a tall phone, as far as the screen has room for.
    const lift = Math.sin(this.elevation)
    const fit = ((h / w) * (this.board.width + 1) - 0.5) / ((this.board.height + 0.9) * lift)
    this.world.scale.z = clamp(fit, 1, 1 / lift)
    // the beds and the fence around them
    const hw = this.board.width / 2 + 0.5, hd = (this.board.height / 2 + 0.45) * this.world.scale.z
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const [x, y, z] of [[-hw, 0, -hd], [hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd], [-hw, 0.45, -hd], [hw, 0.45, -hd]]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse)
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y)
    }
    const s = Math.min(w / (maxX - minX), h / (maxY - minY))
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    this.camera.left = cx - w / 2 / s
    this.camera.right = cx + w / 2 / s
    this.camera.top = cy + h / 2 / s
    this.camera.bottom = cy - h / 2 / s
    this.camera.updateProjectionMatrix()
    if (this.elevationTarget === ELEVATION) this.surroundings()
  }

  // Lays out the little world on whatever lawn the screen shows around the fence.
  surroundings() {
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera)
      const hit = new THREE.Vector3()
      if (!this.ray.ray.intersectPlane(ground, hit)) continue
      x0 = Math.min(x0, hit.x); x1 = Math.max(x1, hit.x); z0 = Math.min(z0, hit.z); z1 = Math.max(z1, hit.z)
    }
    // tall things behind the garden poke up into view, so look a little further back
    const bounds = [x0 + 0.05, x1 - 0.05, z0 - 0.6, z1 - 0.1]
    const key = bounds.map((v) => v.toFixed(1)).join() + this.board.level.id
    if (key === this.worldKey) return
    this.worldKey = key
    const sz = this.world.scale.z
    const hw = this.board.width / 2 + 0.5, hd = (this.board.height / 2 + 0.45) * sz
    this.around.build(bounds, [-hw, hw, -hd - 0.1, hd], this.seed)
    const reach = Math.max(x1 - x0, z1 - z0) / 2 + 1.5
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.shadowFrames = 3
  }

  // a tap on the lawn: a critter there jumps
  poke(clientX, clientY) {
    const p = this.toWorld(clientX, clientY)
    return p ? this.around.poke(p.x, p.z) : null
  }

  // If frames keep coming slowly, draw fewer pixels: the pixel ratio steps down
  // a quarter at a time, never below 1, and never back up during a visit.
  tune(ms) {
    if (ms > 250) return
    this.frames = (this.frames ?? 0) + 1
    this.frameTime = (this.frameTime ?? 0) + ms
    if (this.frames < 90) return
    const avg = this.frameTime / this.frames
    this.frames = this.frameTime = 0
    const ratio = this.renderer.getPixelRatio()
    if (avg > 20 && ratio > 1) {
      this.renderer.setPixelRatio(Math.max(1, ratio - 0.25))
      this.resize()
    }
  }

  /* ---------- animation ---------- */

  update(dt) {
    this.time += dt
    if (!this.board) return
    this.glow = THREE.MathUtils.damp(this.glow, this.glowTarget, 1.2, dt)
    this.sun.color.setHex(0xfff3df).lerp(new THREE.Color(0xffc98a), this.glow * 0.7)
    this.sky.color.setHex(0xf6fbff).lerp(new THREE.Color(0xffe6cf), this.glow)
    if (Math.abs(this.elevation - this.elevationTarget) > 0.0005) {
      this.elevation = THREE.MathUtils.damp(this.elevation, this.elevationTarget, 1.1, dt)
      this.frame()
    }
    let busy = false
    for (const c of this.cells) {
      if (c.pending && this.time >= c.pending.at) {
        const { change } = c.pending
        c.pending = null
        change()
        this.burst(c.i)
      }
      if (c.leaving) {
        c.k = Math.min(1, c.k + dt / 0.22)
        c.group.scale.setScalar(Math.max(0.001, 1 - c.k))
        if (c.k >= 1) { c.leaving = false; c.group.visible = false }
        busy = true
      } else if (c.k < 1) {
        c.k = Math.min(1, c.k + dt / 0.6)
        c.group.scale.setScalar(Math.max(0.001, spring(c.k, c.from)))
        busy = true
      }
      if (c.wobble >= 0) {
        c.wobble += dt / 0.45
        const k = Math.min(1, c.wobble)
        c.group.rotation.z = Math.sin(k * Math.PI * 4) * (1 - k) * 0.25
        if (k >= 1) c.wobble = -1
      } else if (c.group.visible) {
        // a gentle breeze
        c.group.rotation.z = Math.sin(this.time * 1.3 + c.phase) * 0.025
        c.group.rotation.x = Math.sin(this.time * 0.9 + c.phase * 0.7) * 0.02
      }
    }
    for (const bed of this.beds) {
      if (Math.abs(bed.grow - bed.target) > 0.001) {
        bed.grow = THREE.MathUtils.damp(bed.grow, bed.target, 2.5, dt)
        bed.material.userData.grow.value = bed.grow
      }
    }
    for (const f of this.flyers) f.update(dt, this.time)
    this.around.update(dt, this.time)
    if (busy) this.shadowFrames = 2
    if (this.shadowFrames > 0) {
      this.shadowFrames--
      this.renderer.shadowMap.needsUpdate = true
    }
    if (this.petals > 0) {
      this.petals -= dt
      const { width, height } = this.board
      if (Math.random() < dt * 14) {
        const colors = [...new Set(this.flowers.map((f) => COLORS[f].petal))]
        this.spawn(PETAL, colors[Math.floor(Math.random() * colors.length)], new THREE.Vector3((Math.random() - 0.5) * width, 2.2, (Math.random() - 0.5) * height - 0.6), new THREE.Vector3(0.25, -0.35, 0.1), 0.045, { life: 6, gravity: 0, spin: 2.5, basic: true, drift: 1 })
      }
    }
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const f = this.fx[k]
      f.age += dt
      f.v.y -= f.gravity * dt
      f.mesh.position.addScaledVector(f.v, dt)
      if (f.drift) f.mesh.position.x += Math.sin(this.time * 2 + k) * dt * 0.3
      if (f.spin) { f.mesh.rotation.x += f.spin * dt; f.mesh.rotation.y += f.spin * 0.7 * dt }
      const fade = clamp((f.life - f.age) / 0.3, 0, 1)
      f.mesh.scale.setScalar(f.size * fade)
      if (f.age > f.life || f.mesh.position.y < SOIL_Y - 0.05) { f.mesh.removeFromParent(); if (f.own) f.mesh.material.dispose(); this.fx.splice(k, 1) }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
