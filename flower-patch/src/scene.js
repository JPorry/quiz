import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { toon, outline, seeded } from './look.js'
import { cellGeometry, COLORS, GROW_STEPS, STEPS } from './flowers.js'
import { buildGarden, labels, SOIL_Y } from './garden.js'
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
const RING = new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2)
const WING = new THREE.CircleGeometry(1, 12).scale(1, 0.75, 1).translate(1, 0, 0)
const BODY = new THREE.CapsuleGeometry(1, 2, 2, 6)
const EMPTY = new THREE.BufferGeometry()
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
    this.faceMaterial = new THREE.MeshBasicMaterial({ vertexColors: true })
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
    this.world.add(labels(fixed, board.width, board.height))
    this.cells = Array.from({ length: board.cells }, (_, i) => {
      const group = new THREE.Group()
      group.position.copy(this.center(i))
      this.world.add(group)
      const mark = new THREE.Mesh(MARK, this.markMaterial)
      mark.position.copy(group.position)
      mark.position.y += 0.004
      mark.visible = false
      this.world.add(mark)
      // the plants now, and the ones they replace, shrinking away
      const plant = this.slot(group), ghost = this.slot(group)
      return { i, group, plant, ghost, mark, key: '', value: 0, stage: 'sprout', wilt: false, pop: 1, gone: 1, grow: null, wobble: -1, pending: null, phase: i * 1.7 }
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

  slot(parent) {
    const group = new THREE.Group()
    const mesh = new THREE.Mesh(undefined, this.plantMaterial)
    mesh.castShadow = true
    const line = new THREE.Mesh(undefined, this.plantLine)
    const face = new THREE.Mesh(undefined, this.faceMaterial)
    group.add(mesh, line, face)
    group.visible = false
    parent.add(group)
    return { group, mesh, line, face }
  }

  show(slot, shapes) {
    slot.mesh.geometry = shapes.body
    slot.line.geometry = shapes.body
    slot.face.geometry = shapes.face ?? EMPTY
    slot.group.visible = true
  }

  // The plants in a cell shrink away into the soil.
  retire(c) {
    if (!c.plant.group.visible) return
    this.show(c.ghost, { body: c.plant.mesh.geometry, face: c.plant.face.geometry })
    c.ghost.group.scale.copy(c.plant.group.scale)
    c.gone = 0
    c.plant.group.visible = false
  }

  // states[i] = { value, stage, wilt } for every cell
  // origin: the cell just planted, where any growth starts from
  setCells(states, { quiet = false, origin = null } = {}) {
    const from = origin === null ? null : this.center(origin)
    // each bed grows in a wave, starting nearest the cell just planted
    const rank = new Map()
    this.board.beds.forEach((cells) => {
      const order = [...cells].sort((a, b) => (from ? this.center(a).distanceTo(from) - this.center(b).distanceTo(from) : a - b))
      order.forEach((i, k) => rank.set(i, k))
    })
    states.forEach((s, i) => {
      const c = this.cells[i]
      const type = this.flowers[this.board.bedOf[i]]
      const key = s.value ? `${s.stage}|${s.value}|${s.wilt}` : ''
      c.mark.visible = !!s.wilt
      if (key === c.key) return
      c.key = key
      c.pending = null
      if (!s.value) {
        if (!quiet) this.retire(c)
        else c.plant.group.visible = false
        c.value = 0
        c.grow = null
        return
      }
      if (quiet) {
        Object.assign(c, { value: s.value, stage: s.stage, wilt: s.wilt, grow: null, pop: 1 })
        this.show(c.plant, cellGeometry(type, s.stage, s.value, s.wilt))
        c.plant.group.scale.setScalar(1)
        return
      }
      this.shadowFrames = 3
      const seedling = !c.value || s.value !== c.value
      if (seedling) {
        // a new seed pops up as a sprout first, and grows on from there
        this.retire(c)
        Object.assign(c, { value: s.value, stage: 'sprout', wilt: s.wilt, grow: null, pop: 0, popFrom: 0 })
        this.show(c.plant, cellGeometry(type, 'sprout', s.value, s.wilt))
        if (s.stage !== 'sprout') c.pending = { at: this.time + 0.32 + rank.get(i) * 0.11, change: () => this.advance(c, type, s, rank.get(i)) }
        return
      }
      if (s.stage === 'bloom' && c.stage !== 'bloom') {
        // the finale opens the flowers in a wave from the middle of the garden
        const p = this.center(i)
        c.pending = { at: this.time + 0.25 + Math.hypot(p.x, p.z) * 0.22, change: () => this.advance(c, type, s) }
        return
      }
      if (s.stage === 'bud' && c.stage === 'sprout') {
        // a beat after the tap, the bed bursts into bud plant by plant
        c.pending = { at: this.time + 0.32 + rank.get(i) * 0.11, change: () => this.advance(c, type, s, rank.get(i)) }
        return
      }
      this.advance(c, type, s)
    })
  }

  // Moves a cell's plants on to a new stage. Growing up is one continuous
  // change of shape that lands with a little boing and a burst.
  advance(c, type, s, rank = 0) {
    const from = c.stage
    if (s.stage === 'bloom' && from === 'sprout') {
      // the last seed planted buds first, then opens with the rest
      this.advance(c, type, { ...s, stage: 'bud' }, rank)
    }
    if (s.stage === 'bloom' && c.grow?.morph && !c.grow.back) {
      // a bud still growing finishes first, then opens
      c.pending = { at: this.time + (1 - c.grow.k) * c.grow.dur + 0.1, change: () => this.advance(c, type, s) }
      return
    }
    Object.assign(c, { stage: s.stage, wilt: s.wilt })
    if (s.stage === 'bud' && from === 'sprout') {
      // the sprout itself grows into the bud, one continuous change
      c.grow = { type, stage: 'bud', steps: GROW_STEPS, k: 0, dur: 1.1, step: -1, rank, morph: true }
    } else if (s.stage === 'bloom' && from !== 'bloom') {
      // the bud opens into its flower, one continuous change
      c.grow = { type, stage: 'bloom', steps: STEPS, k: 0, dur: 1.3, step: -1, rank, morph: true }
    } else if (s.stage === 'sprout' && from !== 'sprout') {
      // a bed that is no longer complete: its buds shrink back into sprouts
      c.grow = { type, stage: 'bud', steps: GROW_STEPS, k: 0, dur: 0.6, step: -1, rank, morph: true, back: true }
    } else {
      // a seed starts or stops wilting
      c.grow = null
      this.show(c.plant, cellGeometry(type, s.stage, c.value, s.wilt))
      c.wobble = 0
    }
  }

  stepGrowth(c, dt) {
    const g = c.grow
    const steps = g.steps ?? STEPS
    g.k = Math.min(1, g.k + dt / g.dur)
    // a morph eases in and out, like something alive; an opening eases out
    const e = g.morph ? g.k * g.k * (3 - 2 * g.k) : 1 - (1 - g.k) ** 2
    const step = Math.round((g.back ? 1 - e : e) * steps)
    if (step !== g.step) {
      g.step = step
      this.show(c.plant, cellGeometry(g.type, g.stage ?? c.stage, c.value, c.wilt, step))
    }
    if (g.morph) {
      // it breathes as it changes, swelling and settling
      const b = Math.sin(g.k * Math.PI * 3) * Math.sin(g.k * Math.PI) * 0.07
      c.plant.group.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5)
    }
    if (g.k < 1) return
    c.grow = null
    if (g.back) { this.show(c.plant, cellGeometry(g.type, 'sprout', c.value, c.wilt)); return }
    if (g.morph) {
      // done: a little boing, a burst of petals, and its note
      c.pop = 0
      c.popFrom = 0.86
      this.burst(c.i)
      this.shadowFrames = 3
      this.onPop?.(c.i, g.stage, g.rank)
    }
  }

  // grow: 0 bare soil, about half for a complete bed, 1 in bloom
  setBeds(levels, { quiet = false, origin = null } = {}) {
    levels.forEach((target, b) => {
      const bed = this.beds[b]
      const u = bed.material.userData
      if (target > 0 && !bed.target && !quiet) {
        // the carpet spreads across the bed from the cell just planted, with the wave of buds
        const p = origin ?? this.board.beds[b][0]
        u.origin.value.set((p % this.board.width) + 0.5, Math.floor(p / this.board.width) + 0.5)
        bed.spread = { at: this.time + 0.3, reach: 0 }
        u.reach.value = 0
        bed.grow = target
        u.grow.value = target
      }
      bed.target = target
      if (quiet) { bed.grow = target; u.grow.value = target; u.reach.value = 99 }
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

  spawn(geometry, color, position, velocity, size, { life = 1, gravity = 1, spin = 0, basic = false, drift = 0 } = {}) {
    const mesh = new THREE.Mesh(geometry, basic ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }) : toon(color))
    mesh.position.copy(position)
    mesh.scale.setScalar(size)
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0)
    this.world.add(mesh)
    this.fx.push({ mesh, v: velocity, life, age: 0, gravity, spin, drift, size, own: basic })
  }

  // A pop of petals, sparkles and a ring in the soil as a cell grows up.
  burst(i) {
    const color = COLORS[this.flowers[this.board.bedOf[i]]].petal
    const p = this.center(i)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.random() * 0.5
      this.spawn(PETAL, color, p.clone().add(new THREE.Vector3(Math.cos(a) * 0.1, 0.15, Math.sin(a) * 0.1)), new THREE.Vector3(Math.cos(a) * 0.9, 1.3 + Math.random() * 0.5, Math.sin(a) * 0.9), 0.04, { life: 0.9, gravity: 3.2, spin: 8, basic: true })
    }
    for (let k = 0; k < 4; k++) {
      this.spawn(SPARK, k % 2 ? 0xfff2a8 : 0xffffff, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2, (Math.random() - 0.5) * 0.5)), new THREE.Vector3((Math.random() - 0.5) * 0.3, 1 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3), 0.03, { life: 0.9, gravity: 0.5, spin: 6, basic: true })
    }
    const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0.85, depthWrite: false }))
    ring.position.set(p.x, SOIL_Y + 0.01, p.z)
    this.world.add(ring)
    this.fx.push({ mesh: ring, v: new THREE.Vector3(), life: 0.45, age: 0, gravity: 0, spin: 0, drift: 0, size: 0.1, own: true, ring: true })
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

  // where a cell sits on the screen, in page pixels
  toScreen(i) {
    const v = this.center(i).applyMatrix4(this.world.matrixWorld).project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height }
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
      }
      if (c.grow) { this.stepGrowth(c, dt); busy = true }
      if (c.gone < 1) {
        // the old plants squash down and sink away
        c.gone = Math.min(1, c.gone + dt / 0.28)
        const k = c.gone
        c.ghost.group.scale.set(1 + k * 0.25, Math.max(0.001, (1 - k) ** 1.5), 1 + k * 0.25)
        if (k >= 1) c.ghost.group.visible = false
        busy = true
      }
      const sprout = c.stage === 'sprout'
      if (c.grow?.morph) {
        // changing shape, handled above
      } else if (c.pop < 1) {
        // a springy pop, stretching up and squashing back
        c.pop = Math.min(1, c.pop + dt / 0.6)
        const k = c.pop
        const size = spring(k, c.popFrom ?? 0)
        const stretch = Math.sin(k * Math.PI * 3) * (1 - k) * 0.3
        c.plant.group.scale.set(size * (1 - stretch * 0.5), size * (1 + stretch), size * (1 - stretch * 0.5))
        busy = true
      } else if (sprout && c.plant.group.visible) {
        // sprouts breathe, softly
        const b = Math.sin(this.time * 2.2 + c.phase) * 0.035
        c.plant.group.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5)
      } else c.plant.group.scale.setScalar(1)
      if (c.wobble >= 0) {
        c.wobble += dt / 0.45
        const k = Math.min(1, c.wobble)
        c.group.rotation.z = Math.sin(k * Math.PI * 4) * (1 - k) * 0.25
        if (k >= 1) c.wobble = -1
      } else {
        // a gentle breeze
        c.group.rotation.z = Math.sin(this.time * 1.3 + c.phase) * 0.025
        c.group.rotation.x = Math.sin(this.time * 0.9 + c.phase * 0.7) * 0.02
      }
    }
    for (const bed of this.beds) {
      if (bed.spread && this.time >= bed.spread.at) {
        bed.spread.reach += dt * 3.2
        bed.material.userData.reach.value = bed.spread.reach
        if (bed.spread.reach > 7) { bed.spread = null; bed.material.userData.reach.value = 99 }
      }
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
      if (f.ring) {
        // a ring in the soil spreads out and fades
        const k = f.age / f.life
        f.mesh.scale.set(0.12 + k * 0.45, 1, 0.12 + k * 0.45)
        f.mesh.material.opacity = 0.85 * (1 - k)
      } else f.mesh.scale.setScalar(f.size * fade)
      if (f.age > f.life || f.mesh.position.y < SOIL_Y - 0.05) { f.mesh.removeFromParent(); if (f.own) f.mesh.material.dispose(); this.fx.splice(k, 1) }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
