import * as THREE from 'three'
import { toon, part, baked, merge } from './look.js'
import { TUBE, SEED } from './logic.js'
import { Hamster, LINE, SOFT, BALL, CYL, TORUS, bedParts, seedParts, FURNITURE } from './hamsters.js'

// A glass hamster habitat on a table, seen from above at a tilt through a fixed
// orthographic camera. The floor is soft bedding on a grid. The player lays
// see-through play tubes cell by cell; every number is a hamster sitting in its
// room, and once the room is walled in at exactly its size the hamster's bed
// and things pop in and it settles down happily. Outside the glass sit a little
// wooden house, a water bottle, a big wheel with a hamster running in it and a
// potted plant.

const ELEVATION = 54 * Math.PI / 180
const CZ = 1.12 // rows stretch a little so cells look square through the tilt
const TY = 0.3 // tube height
const R = 0.27 // tube radius
const BASE = 0x8fd3b0, BASE_DEEP = 0x6cbf96
const RUGS = ['#ffd7de', '#d9ecff', '#fff0b8', '#e4dcff', '#d6f3df', '#ffe0c7', '#e0f4ff', '#ffe4f2']
const CONFETTI = [0xff8fa3, 0xffd166, 0x7fc8ff, 0x8ee39b, 0xc7a3ff]
const clamp = THREE.MathUtils.clamp
const easeBack = (k) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2

// tubes are drawn in two passes, depth first, so overlapping parts of the
// glass blend as one layer
const GLASS = new THREE.MeshToonMaterial({ color: 0x8fcdec, transparent: true, opacity: 0.8, depthWrite: false, depthFunc: THREE.LessEqualDepth, gradientMap: toon().gradientMap })
const GLASS_WARN = GLASS.clone()
GLASS_WARN.color.setHex(0xff9c9c)
const DEPTH = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true })
const SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })
const DIRS = [[-1, 0], [0, -1], [0, 1], [1, 0]] // up, left, right, down as [dr, dc]
// an open band, the collar where two cells of tube meet
const BAND = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true)

export class HabitatScene {
  constructor(container) {
    this.container = container
    const capture = new URLSearchParams(location.search).has('capture')
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: capture })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.append(this.renderer.domElement)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200)
    this.sky = new THREE.HemisphereLight(0xfff6ee, 0xf3c7b0, 1.55)
    this.sun = new THREE.DirectionalLight(0xfff1dc, 1.9)
    this.sun.position.set(-5, 12, 6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0008
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sky, this.sun, this.sun.target)
    this.world = new THREE.Group()
    this.scene.add(this.world)
    this.ray = new THREE.Raycaster()
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.03)
    this.time = 0
    this.glow = 0
    this.glowTarget = 0
    this.shadowFrames = 3
    this.inset = 0
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
  }

  /* ---------- building a habitat ---------- */

  load(board, { seed = 1 } = {}) {
    this.world.clear()
    this.board = board
    this.seed = seed
    this.width = board.width
    this.height = board.height
    this.fx = []
    this.runners = []
    this.tubes = new Array(board.size).fill(null)
    this.seeds = new Array(board.size).fill(null)
    this.leaving = []
    this.cells = new Array(board.size).fill(0)
    this.wide = new Set()
    this.glowTarget = 0
    this.celebrating = 0
    this.won = false
    this.texKey = ''
    this.buildHabitat()
    this.buildProps()
    this.rooms = board.clues.map((clue, k) => this.buildRoom(clue, k))
    this.marks = new THREE.Group()
    this.world.add(this.marks)
    const reach = Math.max(this.width, this.height * CZ) / 2 + 3
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 60 })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.shadowFrames = 3
    this.resize()
  }

  pos(i, y = 0) {
    const r = Math.floor(i / this.width), c = i % this.width
    return new THREE.Vector3(c + 0.5 - this.width / 2, y, (r + 0.5 - this.height / 2) * CZ)
  }

  buildHabitat() {
    const w = this.width, d = this.height * CZ
    const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), toon(0xf1cfae))
    table.rotation.x = -Math.PI / 2
    table.position.y = -0.42
    table.receiveShadow = true
    this.world.add(table)
    this.world.add(baked([
      part(SOFT(0.2), BASE, [0, -0.2, 0], [w + 0.9, 0.44, d + 0.9]),
      part(SOFT(0.1), BASE_DEEP, [0, -0.36, 0], [w + 1.05, 0.12, d + 1.05]),
    ], { line: LINE, width: 0.02 }))
    // the bedding is one canvas, redrawn when rooms finish or tubes change
    this.canvas = document.createElement('canvas')
    this.cellPx = Math.min(128, Math.floor(1400 / Math.max(w, this.height)))
    this.canvas.width = w * this.cellPx
    this.canvas.height = this.height * this.cellPx
    this.bedTex = new THREE.CanvasTexture(this.canvas)
    this.bedTex.colorSpace = THREE.SRGBColorSpace
    this.bedTex.anisotropy = 4
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshToonMaterial({ map: this.bedTex, gradientMap: toon().gradientMap }))
    bed.rotation.x = -Math.PI / 2
    bed.position.y = 0.025
    bed.receiveShadow = true
    this.world.add(bed)
    // the flakes of bedding never change, so they're drawn once and kept
    this.flakes = document.createElement('canvas')
    this.flakes.width = this.canvas.width
    this.flakes.height = this.canvas.height
    const g = this.flakes.getContext('2d')
    let s = this.seed * 9301 + 49297
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    g.fillStyle = '#fbe7c0'
    g.fillRect(0, 0, this.flakes.width, this.flakes.height)
    const k = this.cellPx / 128
    for (let n = 0; n < w * this.height * 55; n++) {
      g.save()
      g.translate(rnd() * this.flakes.width, rnd() * this.flakes.height)
      g.rotate(rnd() * Math.PI)
      g.fillStyle = rnd() < 0.5 ? '#efd29b' : '#fff3d8'
      g.beginPath()
      g.ellipse(0, 0, (4 + rnd() * 7) * k, (1.6 + rnd() * 1.6) * k, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    // glass on the back and sides, a white rim, mint posts
    const H = 0.95, ex = w / 2 + 0.38, ez = d / 2 + 0.38
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.16, roughness: 0.1, depthWrite: false })
    for (const [x, z, len, ry] of [[0, -ez, w + 0.76, 0], [-ex, 0, d + 0.76, Math.PI / 2], [ex, 0, d + 0.76, Math.PI / 2]]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, H), glass)
      wall.position.set(x, H / 2, z)
      wall.rotation.y = ry
      wall.renderOrder = 5
      this.world.add(wall)
    }
    const rim = [
      part(SOFT(0.04), 0xffffff, [0, H, -ez], [w + 0.86, 0.1, 0.1]),
      part(SOFT(0.04), 0xffffff, [-ex, H, 0], [0.1, 0.1, d + 0.86]),
      part(SOFT(0.04), 0xffffff, [ex, H, 0], [0.1, 0.1, d + 0.86]),
    ]
    for (const [x, z] of [[-ex, -ez], [ex, -ez]]) rim.push(part(SOFT(0.05), BASE, [x, H / 2, z], [0.16, H + 0.08, 0.16]))
    for (const x of [-ex, ex]) rim.push(part(SOFT(0.05), BASE, [x, H / 2 - 0.05, ez], [0.16, H, 0.16]))
    this.world.add(baked(rim, { line: LINE, width: 0.015, shadow: false }))
    this.edges = { ex, ez }
  }

  buildProps() {
    const { ex, ez } = this.edges
    // a little wooden house behind the back left corner, with a hamster at the door
    const house = baked([
      part(SOFT(0.15), 0xe8b98a, [0, 0.45, 0], [1.3, 0.95, 1.0]),
      part(SOFT(0.2), 0xe0675e, [-0.36, 1.12, 0], [0.9, 0.12, 1.2], [0, 0, 0.6]),
      part(SOFT(0.2), 0xe0675e, [0.36, 1.12, 0], [0.9, 0.12, 1.2], [0, 0, -0.6]),
      part(SOFT(0.2), 0xe8b98a, [0, 0.95, 0], [0.75, 0.35, 0.95]),
      part(SOFT(0.4), 0x6b4128, [0, 0.32, 0.5], [0.42, 0.5, 0.04]),
      part(SOFT(0.3), 0xbfe6f2, [0.42, 0.6, 0.5], [0.22, 0.22, 0.04]),
      part(SOFT(0.3), 0xfff4dc, [0, -0.02, 0], [1.5, 0.06, 1.2]),
    ], { line: LINE, width: 0.02 })
    house.position.set(-ex + 0.75, -0.4, -ez - 1.05)
    this.world.add(house)
    this.greeter = new Hamster(4, 0.72)
    this.greeter.group.position.set(-ex + 1.75, -0.4, -ez - 0.7)
    this.greeter.group.rotation.y = -0.3
    this.world.add(this.greeter.group)
    // water bottle hanging on the back glass
    const bottle = baked([
      part(SOFT(0.45), 0xbfe6f2, [0, 1.15, 0], [0.42, 0.95, 0.32]),
      part(SOFT(0.45), 0x5aa9d6, [0, 0.95, 0], [0.4, 0.5, 0.3]),
      part(CYL, 0xffd166, [0, 0.6, 0], [0.13, 0.12, 0.13]),
      part(CYL, 0xd9d2c8, [0, 0.42, 0.06], [0.03, 0.32, 0.03], [0.35, 0, 0]),
    ], { line: LINE, width: 0.015 })
    bottle.position.set(0.4, 0.25, -ez + 0.2)
    this.world.add(bottle)
    // the big wheel behind the back right corner, turning under its runner
    const stand = [part(SOFT(0.3), 0xffd166, [0, 0.03, -0.17], [1.3, 0.08, 0.8]), part(CYL, 0xffd166, [-0.4, 0.55, -0.17], [0.05, 1.2, 0.05], [0, 0, -0.35]), part(CYL, 0xffd166, [0.4, 0.55, -0.17], [0.05, 1.2, 0.05], [0, 0, 0.35])]
    const spin = [part(TORUS, 0x7cc0e6, [0, 0, 0], [0.85, 0.85, 1.8]), part(TORUS, 0x7cc0e6, [0, 0, -0.35], [0.85, 0.85, 1.8])]
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; spin.push(part(CYL, 0xd6eefa, [Math.cos(a) * 0.85, Math.sin(a) * 0.85, -0.175], [0.02, 0.35, 0.02], [Math.PI / 2, 0, 0])) }
    const wheel = new THREE.Group()
    wheel.add(baked(stand, { line: LINE, width: 0.015 }))
    this.wheel = baked(spin, { line: LINE, width: 0.015 })
    this.wheel.position.y = 1.15
    wheel.add(this.wheel)
    this.runner = new Hamster(0, 0.6)
    this.runner.group.position.set(0, 0.33, -0.05)
    this.runner.group.rotation.set(0.15, Math.PI / 2, 0)
    wheel.add(this.runner.group)
    wheel.position.set(ex - 0.9, -0.4, -ez - 1.0)
    wheel.rotation.y = -0.25
    this.world.add(wheel)
    // a potted plant by the front left corner
    const leaves = []
    for (let k = 0; k < 6; k++) leaves.push(part(BALL, k % 2 ? 0x6cc070 : 0x8fd38a, [Math.cos(k) * 0.18, 0.25 + k * 0.05, Math.sin(k) * 0.12], [0.22, 0.09, 0.12], [0, k, 0.7]))
    leaves.push(part(CYL, 0xf3a68a, [0, 0.13, 0], [0.24, 0.26, 0.24]))
    const plant = baked(leaves, { line: LINE, width: 0.015 })
    plant.position.set(-ex - 0.35, -0.42, ez + 0.1)
    this.world.add(plant)
  }

  // A hamster sits in every room from the start, with its number floating over
  // it. The bed and things wait, hidden, for the room to be finished.
  buildRoom(clue, k) {
    const p = this.pos(clue.cell)
    const coat = (this.seed + k * 3) % 7
    const hamster = new Hamster(coat, 1.05)
    hamster.group.position.set(p.x, 0.03, p.z + 0.04)
    this.world.add(hamster.group)
    const bed = baked(bedParts(), { line: LINE, width: 0.012 })
    bed.position.copy(p)
    bed.scale.setScalar(0.001)
    bed.visible = false
    this.world.add(bed)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    badge.scale.setScalar(0.4)
    badge.position.set(p.x - 0.3, 0.72, p.z - 0.2)
    badge.renderOrder = 20
    this.world.add(badge)
    const room = { clue, k, hamster, bed, badge, canvas, tex, done: false, state: '', items: [], at: 0 }
    this.drawBadge(room, 'open')
    return room
  }

  drawBadge(room, state) {
    if (room.state === state) return
    room.state = state
    const g = room.canvas.getContext('2d')
    g.clearRect(0, 0, 128, 128)
    const [fill, ring, ink] = { open: ['#fff8ec', '#d69a64', '#4a3428'], done: ['#5fbf72', '#2f8146', '#ffffff'], wrong: ['#ff8f7a', '#c4492c', '#ffffff'] }[state]
    g.fillStyle = 'rgba(90,60,40,.25)'
    g.beginPath(); g.arc(64, 70, 50, 0, Math.PI * 2); g.fill()
    g.fillStyle = fill
    g.beginPath(); g.arc(64, 62, 50, 0, Math.PI * 2); g.fill()
    g.lineWidth = 8
    g.strokeStyle = ring
    g.stroke()
    g.fillStyle = ink
    g.font = '600 64px Fredoka, Nunito, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(String(room.clue.value), 64, 67)
    room.tex.needsUpdate = true
  }

  /* ---------- the bedding ---------- */

  drawBedding() {
    const g = this.canvas.getContext('2d')
    const s = this.cellPx, w = this.width
    g.drawImage(this.flakes, 0, 0)
    // a soft rug under every finished room, in its own colour
    for (const room of this.rooms) {
      if (!room.done) continue
      g.fillStyle = RUGS[(room.k + this.seed) % RUGS.length]
      const m = s * 0.08
      const inRoom = new Set(room.cells)
      for (const i of room.cells) {
        const x = (i % w) * s, y = Math.floor(i / w) * s
        g.beginPath()
        g.roundRect(x + m, y + m, s - 2 * m, s - 2 * m, s * 0.18)
        g.fill()
        if (i % w < w - 1 && inRoom.has(i + 1)) g.fillRect(x + s / 2, y + m, s, s - 2 * m)
        if (inRoom.has(i + w)) g.fillRect(x + m, y + s / 2, s - 2 * m, s)
      }
    }
    // tubes leave a soft blue shade on the bedding under them, pink when too wide
    for (let i = 0; i < this.board.size; i++) {
      if (this.cells[i] !== TUBE) continue
      g.fillStyle = this.wideCells?.has(i) ? 'rgba(255,120,120,.28)' : 'rgba(120,170,200,.16)'
      g.fillRect((i % w) * s, Math.floor(i / w) * s, s, s)
    }
    g.strokeStyle = 'rgba(160,110,60,.16)'
    g.lineWidth = Math.max(1.5, s / 64)
    g.beginPath()
    for (let c = 1; c < w; c++) { g.moveTo(c * s, 0); g.lineTo(c * s, this.canvas.height) }
    for (let r = 1; r < this.height; r++) { g.moveTo(0, r * s); g.lineTo(this.canvas.width, r * s) }
    g.stroke()
    this.bedTex.needsUpdate = true
  }

  /* ---------- tubes ---------- */

  // One cell of tube: a glass ball where its arms meet, an arm toward every
  // neighbouring tube, a ring where it joins the next cell, and a shine on top.
  makeTube(i) {
    const r = Math.floor(i / this.width), c = i % this.width
    const arms = []
    for (const [dr, dc] of DIRS) {
      const rr = r + dr, cc = c + dc
      if (rr < 0 || cc < 0 || rr >= this.height || cc >= this.width) continue
      if (this.cells[rr * this.width + cc] === TUBE) arms.push([dr, dc])
    }
    const glass = [part(BALL, 0xffffff, [0, 0, 0], [R, R, R])]
    const shine = [part(BALL, 0xffffff, [-0.06, R * 0.92, -0.06], [0.07, 0.02, 0.07])]
    const rings = []
    for (const [dr, dc] of arms) {
      const len = dr ? CZ / 2 : 0.5
      const mid = [dc * len / 2, 0, dr * len / 2]
      const along = dr ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]
      glass.push(part(CYL, 0xffffff, mid, [R, len, R], along))
      shine.push(part(CYL, 0xffffff, [mid[0] - (dr ? 0.07 : 0), R * 0.92, mid[2] - (dc ? 0.07 : 0)], [0.035, len, 0.012], along))
      // a collar at the seam with the next cell (each seam gets one, from one side)
      if (dr > 0 || dc > 0) rings.push(part(BAND, 0x6db8e2, [dc * len, 0, dr * len], [R + 0.02, 0.08, R + 0.02], along))
    }
    const geometry = mergeAll(glass)
    const group = new THREE.Group()
    const depth = new THREE.Mesh(geometry, DEPTH)
    depth.renderOrder = 10
    const body = new THREE.Mesh(geometry, this.wideCells?.has(i) ? GLASS_WARN : GLASS)
    body.renderOrder = 11
    const sh = new THREE.Mesh(mergeAll(shine), SHINE)
    sh.renderOrder = 12
    group.add(depth, body, sh)
    if (rings.length) group.add(baked(rings, { line: LINE, width: 0.012, shadow: false }))
    group.position.copy(this.pos(i, TY))
    group.userData = { body, key: arms.map((a) => a.join()).join('|') + (this.wideCells?.has(i) ? 'w' : '') }
    return group
  }

  /* ---------- state from the game ---------- */

  // cells: BEDDING/TUBE/SEED per cell; st: the logic's status
  setState(cells, st, { won = false } = {}) {
    const before = this.cells
    this.cells = cells.slice()
    this.wideCells = new Set()
    for (const i of st.wide) for (const j of [i, i + 1, i + this.width, i + this.width + 1]) this.wideCells.add(j)
    // tubes: new ones pop in, removed ones shrink away, neighbours re-join
    for (let i = 0; i < this.board.size; i++) {
      const want = cells[i] === TUBE
      const have = this.tubes[i]
      if (!want) {
        if (have) { this.retire(have); this.tubes[i] = null }
        continue
      }
      const fresh = this.makeTube(i)
      if (have && have.userData.key === fresh.userData.key) { disposeTube(fresh); continue }
      if (have) {
        // same cell, new shape: swap in place without popping
        fresh.userData.k = have.userData.k ?? 1
        this.world.remove(have)
        disposeTube(have)
      } else {
        fresh.userData.k = before[i] === TUBE ? 1 : 0
        if (!fresh.userData.k) this.sparkle(fresh.position, 3, 0xd6f0ff)
      }
      fresh.scale.setScalar(Math.max(0.001, easeBack(clamp(fresh.userData.k, 0, 1))))
      this.world.add(fresh)
      this.tubes[i] = fresh
    }
    // seeds
    for (let i = 0; i < this.board.size; i++) {
      const want = cells[i] === SEED
      if (want && !this.seeds[i]) {
        const s = baked(seedParts(), { line: LINE, width: 0.01 })
        s.position.copy(this.pos(i))
        s.rotation.y = ((i * 37) % 7) * 0.4
        s.userData.k = 0
        s.scale.setScalar(0.001)
        this.world.add(s)
        this.seeds[i] = s
      } else if (!want && this.seeds[i]) {
        this.retire(this.seeds[i])
        this.seeds[i] = null
      }
    }
    // rooms
    const wrong = new Set([...st.crowded, ...st.cramped])
    this.rooms.forEach((room, k) => {
      const done = st.rooms[k].done
      const cells = done ? st.rooms[k].cells : []
      if (done && (!room.done || room.cells.join() !== cells.join())) this.furnish(room, cells)
      else if (!done && room.done) this.unfurnish(room)
      room.done = done
      room.cells = cells
      room.hamster.setAsleep(done)
      this.drawBadge(room, done ? 'done' : wrong.has(k) ? 'wrong' : 'open')
    })
    const key = `${cells.join('')}|${this.rooms.map((r) => (r.done ? r.cells.join('.') : '')).join('/')}|${[...this.wideCells].join('.')}`
    if (key !== this.texKey) { this.texKey = key; this.drawBedding() }
    if (won && !this.won) this.celebrate()
    if (!won && this.won) { this.won = false; this.clearRunners() }
    this.shadowFrames = 3
  }

  retire(object) {
    object.userData.leaving = 1
    this.leaving.push(object)
  }

  // The bed slides in under the hamster, and its things pop in one by one.
  furnish(room, cells) {
    this.unfurnish(room)
    room.bed.visible = true
    room.at = 0
    room.hamster.jump(0.35)
    let n = 0
    const order = cells.filter((i) => i !== room.clue.cell)
    order.forEach((i) => {
      const make = FURNITURE[(this.seed * 3 + room.k * 4 + n++) % FURNITURE.length]
      const item = baked(make(), { line: LINE, width: 0.012 })
      item.position.copy(this.pos(i))
      item.rotation.y = (((i * 37) % 7) - 3) * 0.12
      item.scale.setScalar(0.001)
      item.userData.delay = 0.15 + n * 0.12
      this.world.add(item)
      room.items.push(item)
    })
    const p = this.pos(room.clue.cell)
    this.confetti(p.x, 0.5, p.z, 10)
  }

  unfurnish(room) {
    for (const item of room.items) this.retire(item)
    room.items = []
    room.out = 1
  }

  setGlow(cells) {
    this.glowCells = cells ?? []
    this.marks.clear()
    for (const i of cells ?? []) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 40), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, depthWrite: false }))
      ring.rotation.x = -Math.PI / 2
      ring.scale.z = CZ
      ring.position.copy(this.pos(i, 0.04))
      ring.renderOrder = 4
      this.marks.add(ring)
    }
  }

  // a tapped hamster hops (and the game squeaks)
  poke(k) { this.rooms[k]?.hamster.jump(0.3) }
  roomAt(i) { return this.rooms.findIndex((r) => r.clue.cell === i) }
  cheer() { for (const r of this.rooms) r.hamster.jump(0.3) }

  celebrate() {
    this.won = true
    this.celebrating = 5
    this.glowTarget = 1
    this.rooms.forEach((r, k) => setTimeout(() => r.hamster.jump(0.4), k * 120))
    // a few hamsters come out to run the new tubes
    this.clearRunners()
    const tubes = []
    for (let i = 0; i < this.board.size; i++) if (this.cells[i] === TUBE) tubes.push(i)
    const count = Math.min(4, Math.max(1, Math.floor(tubes.length / 8)))
    for (let k = 0; k < count && tubes.length; k++) {
      const h = new Hamster(k + 2, 0.58)
      const from = tubes[Math.floor((k + 0.5) / count * tubes.length)]
      this.world.add(h.group)
      this.runners.push({ h, from, to: from, t: 1, speed: 2.2 + k * 0.3 })
    }
  }

  clearRunners() {
    for (const r of this.runners) r.h.group.removeFromParent()
    this.runners = []
    this.glowTarget = 0
  }

  confetti(x, y, z, n = 16) {
    for (let k = 0; k < n; k++) {
      const bit = new THREE.Mesh(CONFETTI_GEO, new THREE.MeshBasicMaterial({ color: CONFETTI[k % CONFETTI.length], side: THREE.DoubleSide }))
      bit.position.set(x, y, z)
      bit.rotation.set(Math.random() * 6, Math.random() * 6, 0)
      bit.scale.setScalar(0.05)
      this.world.add(bit)
      const a = Math.random() * Math.PI * 2
      this.fx.push({ mesh: bit, v: new THREE.Vector3(Math.cos(a) * 0.9, 1.6 + Math.random() * 0.9, Math.sin(a) * 0.9), life: 1, age: 0, gravity: 4, spin: 8 })
    }
  }

  sparkle(p, n = 3, color = 0xfff2b0) {
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(SPARK, new THREE.MeshBasicMaterial({ color }))
      s.position.set(p.x, p.y + 0.1, p.z)
      s.scale.setScalar(0.035)
      this.world.add(s)
      this.fx.push({ mesh: s, v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 1 + Math.random(), (Math.random() - 0.5) * 1.6), life: 0.45, age: 0, gravity: 5 })
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

  // the cell under a point on screen, or -1
  cellAt(clientX, clientY) {
    const p = this.toWorld(clientX, clientY)
    if (!p || !this.board) return -1
    const c = Math.floor(p.x + this.width / 2), r = Math.floor(p.z / CZ + this.height / 2)
    if (c < 0 || r < 0 || c >= this.width || r >= this.height) return -1
    return r * this.width + c
  }

  toScreen(i) {
    const p = this.pos(i, 0.3).project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height }
  }

  /* ---------- framing ---------- */

  // keeps the top `px` of the stage clear (for the tutorial's coach card)
  setInset(px) {
    if (px === this.inset) return
    this.inset = px
    this.resize()
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    if (!this.board) return
    this.camera.position.set(0, Math.sin(ELEVATION) * 40, Math.cos(ELEVATION) * 40)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
    // fit the habitat with its rim, and the house and wheel peeking over the back
    const { ex, ez } = this.edges
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const [x, y, z] of [[-ex - 0.3, 0, -ez], [ex + 0.3, 0, -ez], [-ex - 0.3, -0.4, ez + 0.3], [ex + 0.3, -0.4, ez + 0.3], [0, 1.6, -ez - 0.9]]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse)
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y)
    }
    const free = Math.max(h * 0.5, h - this.inset)
    const s = Math.min(w / (maxX - minX), free / (maxY - minY))
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    // centred in the space below the inset
    const shift = (h - free) / 2 / s
    this.camera.left = cx - w / 2 / s
    this.camera.right = cx + w / 2 / s
    this.camera.top = cy + h / 2 / s + shift
    this.camera.bottom = cy - h / 2 / s + shift
    this.camera.updateProjectionMatrix()
    this.shadowFrames = 3
  }

  // If frames keep coming slowly, draw fewer pixels.
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
    let busy = false
    this.glow = THREE.MathUtils.damp(this.glow, this.glowTarget, 1.5, dt)
    this.sun.color.setHex(0xfff1dc).lerp(new THREE.Color(0xffc48a), this.glow * 0.7)
    this.sky.color.setHex(0xfff6ee).lerp(new THREE.Color(0xffe0d0), this.glow)
    for (const t of this.tubes) {
      if (!t || t.userData.k >= 1) continue
      t.userData.k = Math.min(1, t.userData.k + dt / 0.32)
      t.scale.setScalar(Math.max(0.001, easeBack(t.userData.k)))
      busy = true
    }
    for (const s of this.seeds) {
      if (!s || s.userData.k >= 1) continue
      s.userData.k = Math.min(1, s.userData.k + dt / 0.3)
      s.scale.setScalar(Math.max(0.001, easeBack(s.userData.k)))
    }
    for (let k = this.leaving.length - 1; k >= 0; k--) {
      const o = this.leaving[k]
      o.userData.leaving -= dt / 0.2
      o.scale.setScalar(Math.max(0.001, o.userData.leaving))
      if (o.userData.leaving <= 0) { o.removeFromParent(); if (o.userData.body) disposeTube(o); this.leaving.splice(k, 1) }
      busy = true
    }
    // too-wide tubes wobble
    if (this.wideCells?.size) {
      for (const i of this.wideCells) if (this.tubes[i]) this.tubes[i].position.y = TY + Math.abs(Math.sin(this.time * 9)) * 0.03
      busy = true
    } else for (const t of this.tubes) if (t) t.position.y = TY
    for (const room of this.rooms) {
      room.hamster.update(dt, this.time)
      if (room.hamster.hop >= 0) busy = true
      // bed and things pop in after a beat, one at a time
      if (room.done) {
        room.at += dt
        const kb = clamp(room.at / 0.35, 0, 1)
        room.bed.scale.setScalar(Math.max(0.001, easeBack(kb)))
        room.hamster.group.position.y = 0.03 + 0.11 * kb
        for (const item of room.items) {
          const ki = clamp((room.at - item.userData.delay) / 0.35, 0, 1)
          item.scale.setScalar(Math.max(0.001, easeBack(ki)))
          if (ki > 0 && !item.userData.popped) { item.userData.popped = true; this.sparkle(item.position, 3); this.onItem?.() }
          if (ki < 1) busy = true
        }
      } else if (room.bed.visible) {
        room.out = Math.max(0, (room.out ?? 1) - dt / 0.2)
        const kb = room.out
        room.bed.scale.setScalar(Math.max(0.001, kb))
        room.hamster.group.position.y = 0.03 + 0.11 * kb
        if (kb <= 0) room.bed.visible = false
        busy = true
      }
      room.badge.position.y = 0.72 + (room.done ? 0.1 : 0) + Math.sin(this.time * 2 + room.k) * 0.015
    }
    for (const ring of this.marks.children) ring.material.opacity = 0.55 + Math.sin(this.time * 5) * 0.35
    this.greeter.update(dt, this.time)
    this.runner.update(dt, this.time, { idle: false })
    this.wheel.rotation.z -= dt * 2.4
    this.runner.body.position.y = Math.abs(Math.sin(this.time * 12)) * 0.04
    this.runTubes(dt)
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const f = this.fx[k]
      f.age += dt
      f.v.y -= f.gravity * dt
      f.mesh.position.addScaledVector(f.v, dt)
      f.mesh.scale.multiplyScalar(1 - dt * 1.5)
      if (f.spin) { f.mesh.rotation.x += f.spin * dt; f.mesh.rotation.y += f.spin * 0.7 * dt }
      if (f.age > f.life) { f.mesh.removeFromParent(); f.mesh.material.dispose(); this.fx.splice(k, 1) }
    }
    if (this.celebrating > 0) {
      this.celebrating -= dt
      if (Math.random() < dt * 3) {
        const room = this.rooms[Math.floor(Math.random() * this.rooms.length)]
        const p = this.pos(room.clue.cell)
        this.confetti(p.x, 1.2, p.z, 14)
      }
    }
    if (busy || this.runners.length) this.shadowFrames = 2
    if (this.shadowFrames > 0) {
      this.shadowFrames--
      this.renderer.shadowMap.needsUpdate = true
    }
  }

  // After a win, hamsters scurry from cell to cell through the tubes.
  runTubes(dt) {
    for (const r of this.runners) {
      r.t += dt * r.speed
      if (r.t >= 1) {
        r.t = 0
        const row = Math.floor(r.to / this.width), col = r.to % this.width
        const next = []
        for (const [dr, dc] of DIRS) {
          const rr = row + dr, cc = col + dc
          const j = rr * this.width + cc
          if (rr >= 0 && cc >= 0 && rr < this.height && cc < this.width && this.cells[j] === TUBE && j !== r.from) next.push(j)
        }
        r.from = r.to
        r.to = next.length ? next[Math.floor(Math.random() * next.length)] : r.from
      }
      const a = this.pos(r.from, TY - R + 0.03), b = this.pos(r.to, TY - R + 0.03)
      r.h.group.position.lerpVectors(a, b, r.t)
      if (r.from !== r.to) r.h.group.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
      r.h.update(dt, this.time, { idle: false })
      r.h.body.position.y = Math.abs(Math.sin(this.time * 14 + r.speed)) * 0.03
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}

const CONFETTI_GEO = new THREE.PlaneGeometry(1, 0.6)
const SPARK = new THREE.SphereGeometry(1, 6, 5)

const mergeAll = merge

function disposeTube(group) {
  group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose() })
}
