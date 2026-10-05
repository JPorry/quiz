import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { City, BIOMES, BIOME_NAMES } from './city.js'
import { Island } from './island.js'
import { Sea } from './sea.js'
import { Ambient } from './ambient.js'
import { toon, outline, part, merge, canvasTexture, seeded } from './look.js'

// A tilted diorama of a turquoise sea. Islands sit on a grid; bridges are built
// plank by plank between them; tiny cars drive across once a bridge is open;
// each city grows with every bridge its island gets.

const CX = 1
const ELEVATION = 52 * Math.PI / 180
const DECK_Y = 0.2
const LINE = 0x5e4a58
const CAR_COLORS = [0xff8fa3, 0x7fc8ff, 0xffd166, 0x8ee39b, 0xc7a3ff, 0xffa96b, 0xffffff]
const clamp = THREE.MathUtils.clamp
export const islandRadius = (value) => 0.39 + value * 0.04

/* ---------- bridges ---------- */

const SOFT = new RoundedBoxGeometry(1, 1, 1, 1, 0.2)
const POST = new THREE.CylinderGeometry(1, 1, 1, 8)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const BALL = new THREE.SphereGeometry(1, 8, 6)
const CAP = new THREE.ConeGeometry(1, 1, 10)
const RING = new THREE.TorusGeometry(1, 0.18, 6, 20).rotateX(Math.PI / 2)
const FLAG = (() => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0, 0.5, 0, 0, -0.5, 0, 0, 0, -1, 0], 3))
  g.computeVertexNormals()
  return g
})()
const WOOD = [0xe8b98a, 0xdba878, 0xe3b182]
const BUNTING = [0xff8fa3, 0xffd166, 0x7fc8ff, 0x8ee39b, 0xc7a3ff]
const STONE = 0xf6e8d6
const DROPLET = new THREE.SphereGeometry(1, 8, 6)
const CONFETTI = new THREE.PlaneGeometry(1, 0.6)
const easeOut = (k) => 1 - (1 - k) ** 3

// A bridge is laid plank by plank. One lane is a wooden bridge with rope rails
// and bunting; a second lane rebuilds it as a wide stone bridge with lamps.
class Bridge {
  // a: start point, b: end point on the water plane (Vector3), lanes: 1 or 2
  constructor(parent, a, b, lanes, { preview = false } = {}) {
    this.group = new THREE.Group()
    parent.add(this.group)
    this.a = a.clone()
    this.b = b.clone()
    this.lanes = lanes
    this.preview = preview
    const stone = lanes === 2
    const len = a.distanceTo(b)
    this.length = len
    const dir = b.clone().sub(a).normalize()
    this.group.position.copy(a)
    this.group.rotation.y = -Math.atan2(dir.z, dir.x)
    const width = stone ? 0.32 : 0.19
    this.width = width
    const n = Math.max(4, Math.round(len / (stone ? 0.1 : 0.062)))
    const seg = len / n
    this.material = toon(0xffffff, { vertexColors: true, rim: 0.12 })
    this.blockedMaterial = toon(0xffa898, { vertexColors: true, rim: 0.12 })
    const line = outline(LINE, 0.005)
    this.segments = []
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const parts = stone
        ? [
            part(SOFT, STONE, [0, 0, 0], [seg * 1.01, 0.045, width]),
            part(BOX, 0xe6d0b8, [0, 0.022, 0], [seg * 1.01, 0.006, width * 0.7]),
            i % 2 ? null : part(BOX, 0xffffff, [0, 0.026, 0], [seg * 0.5, 0.004, 0.016]),
            ...[-1, 1].map((s) => part(SOFT, i % 2 ? 0xffb8a0 : 0xffc9b4, [0, 0.042, s * (width / 2 - 0.016)], [seg * 0.96, 0.055, 0.034])),
          ]
        : [part(BOX, WOOD[i % 3], [0, 0, 0], [seg * 0.88, 0.028, width * (i % 2 ? 1 : 0.94)])]
      const geometry = merge(parts)
      const g = new THREE.Group()
      const mesh = new THREE.Mesh(geometry, this.material)
      mesh.castShadow = true
      g.add(mesh, new THREE.Mesh(geometry, line))
      g.visible = false
      this.group.add(g)
      this.segments.push({ g, mesh, t, home: new THREE.Vector3(t * len, this.heightAt(t), 0), tilt: Math.atan(this.slopeAt(t)), state: 0, k: 0, vy: 0, spin: 0 })
    }
    this.place()
    this.extras = this.makeExtras(stone, len, width)
    this.extras.visible = false
    this.group.add(this.extras)
    this.piers = this.makePiers(stone, len, width)
    this.piers.visible = false
    this.group.add(this.piers)
    if (preview) {
      // a dotted guide shows where the bridge will go
      this.guide = []
      this.dot = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })
      for (let k = 0; k < Math.round(len / 0.09); k++) {
        const t = (k + 0.5) / Math.round(len / 0.09)
        const d = new THREE.Mesh(BALL, this.dot)
        d.scale.set(0.026, 0.01, 0.026)
        d.position.set(t * len, this.heightAt(t), 0)
        this.group.add(d)
        this.guide.push({ d, t })
      }
    }
    this.built = 0 // how much of the bridge stands, 0..1
    this.target = 0
    this.open = 0
    this.manual = preview
    this.mode = 'fall'
  }

  makeExtras(stone, len, width) {
    const parts = []
    if (stone) {
      // lamp posts along the parapets
      for (const t of len > 1 ? [0.03, 0.5, 0.97] : [0.03, 0.97]) for (const s of [-1, 1]) {
        const y = this.heightAt(t)
        parts.push(part(POST, 0x8f7fa8, [t * len, y + 0.1, s * (width / 2 - 0.016)], [0.01, 0.16, 0.01]))
        parts.push(part(BALL, 0xfff1a8, [t * len, y + 0.195, s * (width / 2 - 0.016)], [0.03, 0.03, 0.03]))
        parts.push(part(CAP, 0x8f7fa8, [t * len, y + 0.225, s * (width / 2 - 0.016)], [0.034, 0.03, 0.034]))
      }
    } else {
      // posts with round caps, rope rails, and a string of little flags
      const posts = Math.max(2, Math.round(len / 0.2))
      for (let k = 0; k <= posts; k++) {
        const t = k / posts
        for (const s of [-1, 1]) {
          parts.push(part(POST, 0xa8714a, [t * len, this.heightAt(t) + 0.04, s * (width / 2)], [0.01, 0.08, 0.01]))
          parts.push(part(BALL, 0xfff3e2, [t * len, this.heightAt(t) + 0.085, s * (width / 2)], [0.014, 0.014, 0.014]))
        }
      }
      for (const s of [-1, 1]) {
        const pts = []
        for (let k = 0; k <= 30; k++) {
          const t = k / 30
          const sag = Math.abs(Math.sin(t * posts * Math.PI)) * 0.012
          pts.push(new THREE.Vector3(t * len, this.heightAt(t) + 0.075 - sag, s * (width / 2)))
        }
        parts.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 4), 0xf7e3c4))
        const flags = Math.round(len / 0.07)
        for (let k = 1; k < flags; k++) {
          const t = k / flags
          const sag = Math.abs(Math.sin(t * posts * Math.PI)) * 0.012
          parts.push(part(FLAG, BUNTING[(k + (s > 0 ? 0 : 2)) % BUNTING.length], [t * len, this.heightAt(t) + 0.072 - sag, s * (width / 2)], [0.036, 0.04, 1]))
        }
      }
    }
    const geometry = merge(parts)
    const g = new THREE.Group()
    const mesh = new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true, rim: 0.12 }))
    mesh.castShadow = true
    g.add(mesh, new THREE.Mesh(geometry, outline(LINE, 0.004)))
    return g
  }

  makePiers(stone, len, width) {
    const g = new THREE.Group()
    const parts = []
    this.rings = []
    const at = len > 1.4 ? [0.3, 0.7] : len > 0.6 ? [0.5] : []
    for (const t of at) {
      const top = this.heightAt(t) - 0.02
      if (stone) parts.push(part(SOFT, 0xe6d6c2, [t * len, (top - 0.06) / 2, 0], [0.11, top + 0.06, width * 0.8]))
      else for (const s of [-1, 1]) parts.push(part(POST, 0xa8714a, [t * len, (top - 0.06) / 2, s * width * 0.36], [0.016, top + 0.06, 0.016]))
      const ring = new THREE.Mesh(RING, toon(0xffffff, { rim: 0 }))
      ring.position.set(t * len, -0.005, 0)
      ring.scale.set(stone ? 0.1 : 0.08, 0.05, stone ? width * 0.55 : width * 0.5)
      ring.userData.base = ring.scale.clone()
      g.add(ring)
      this.rings.push(ring)
    }
    if (parts.length) {
      const geometry = merge(parts)
      const mesh = new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true, rim: 0.12 }))
      mesh.castShadow = true
      g.add(mesh, new THREE.Mesh(geometry, outline(LINE, 0.005)))
    }
    return g
  }

  heightAt(t) {
    return DECK_Y + Math.sin(t * Math.PI) * Math.min(0.14, this.length * 0.08)
  }

  slopeAt(t) {
    return Math.cos(t * Math.PI) * Math.PI * Math.min(0.14, this.length * 0.08) / this.length
  }

  // a point on the deck, lane -1 or 1 for two-lane bridges
  pointAt(t, lane = 0) {
    const local = new THREE.Vector3(t * this.length, this.heightAt(t) + (this.lanes === 2 ? 0.026 : 0.016), lane * this.width * 0.2)
    return this.group.localToWorld(local)
  }

  place() {
    for (const s of this.segments) {
      if (s.state === 3) continue
      s.g.position.copy(s.home)
      s.g.rotation.set(0, 0, s.tilt)
    }
  }

  setBlocked(blocked) {
    for (const s of this.segments) s.mesh.material = blocked ? this.blockedMaterial : this.material
    this.dot?.color.setHex(blocked ? 0xff8f80 : 0xffffff)
  }

  // the preview the player dragged out becomes the real bridge
  adopt() {
    this.preview = false
    this.manual = false
    this.setBlocked(false)
    for (const { d } of this.guide ?? []) d.removeFromParent()
    this.guide = null
  }

  update(dt, time = 0) {
    if (!this.manual) {
      const speed = this.target > this.built ? 2.2 : 2.6
      this.built += clamp(this.target - this.built, -dt * speed, dt * speed)
    }
    if (this.baked && (this.built < 1 || this.target < 1)) this.unbake()
    const n = this.segments.length
    let landed = 0
    this.segments.forEach((s, i) => {
      const want = this.built >= s.t - 0.5 / n + 0.001
      if (want && (s.state === 0 || s.state === 3)) {
        // drop in from above with a little bounce
        s.state = 1
        s.k = 0
        s.g.visible = true
        this.onPlank?.(this, i)
      } else if (!want && (s.state === 1 || s.state === 2)) {
        s.state = 3
        s.k = 0
        s.vy = 0.3 + Math.random() * 0.2
        s.spin = (Math.random() - 0.5) * 8
      }
      if (s.state === 1) {
        s.k = Math.min(1, s.k + dt / 0.2)
        const drop = (1 - easeOut(s.k)) * 0.22
        const squash = s.k > 0.7 ? Math.sin((s.k - 0.7) / 0.3 * Math.PI) * 0.25 : 0
        s.g.position.set(s.home.x, s.home.y + drop, s.home.z)
        s.g.rotation.set((1 - s.k) * 0.6, 0, s.tilt)
        s.g.scale.set(1 + squash * 0.3, 1 - squash, 1 + squash * 0.3)
        if (s.k >= 1) { s.state = 2; s.g.scale.set(1, 1, 1); s.g.rotation.set(0, 0, s.tilt) }
      } else if (s.state === 3) {
        if (this.preview || this.mode === 'fade') {
          s.k += dt / 0.12
          s.g.scale.setScalar(Math.max(0.001, 1 - s.k))
          if (s.k >= 1) { s.state = 0; s.g.visible = false; s.g.scale.set(1, 1, 1) }
        } else {
          // tumble into the sea
          s.vy -= dt * 3.2
          s.g.position.y += s.vy * dt
          s.g.rotation.x += s.spin * dt
          if (s.g.position.y < -0.04) {
            s.state = 0
            s.g.visible = false
            this.onSplash?.(this.group.localToWorld(s.g.position.clone()))
            s.g.position.copy(s.home)
            s.g.rotation.set(0, 0, s.tilt)
          }
        }
      }
      if (s.state === 2) landed++
    })
    // once every plank is down, rails and piers pop up
    const done = landed === n && !this.preview
    if (done && this.open === 0) this.onOpen?.(this)
    this.open = clamp(this.open + (done ? dt / 0.5 : -dt / 0.15), 0, 1)
    this.extras.visible = this.open > 0
    this.piers.visible = this.open > 0
    if (this.open > 0) {
      const k = this.open
      const s = k >= 1 ? 1 : 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2
      this.extras.scale.set(1, Math.max(0.001, s), 1)
      this.piers.position.y = (1 - easeOut(k)) * -0.3
    }
    // foam rings around the piers breathe with the swell
    this.rings.forEach((ring, k) => {
      const w = 1 + Math.sin(time * 2.4 + k * 2) * 0.12
      const base = ring.userData.base
      ring.scale.set(base.x * w, base.y, base.z * w)
    })
    // the guide dots ahead of the last plank bob in a little wave
    // a finished bridge is drawn as one piece instead of a mesh per plank
    if (done && this.open >= 1 && !this.baked) this.bake()
    if (this.guide) for (const { d, t } of this.guide) {
      d.visible = t > this.built
      d.position.y = this.heightAt(t) + 0.02 + Math.max(0, Math.sin(time * 6 - t * 12)) * 0.02
    }
    return this.built
  }

  bake() {
    const geometry = merge(this.segments.map((s) => {
      s.g.updateMatrix()
      return s.mesh.geometry.clone().applyMatrix4(s.g.matrix)
    }))
    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.castShadow = true
    this.baked = new THREE.Group()
    this.baked.add(mesh, new THREE.Mesh(geometry, outline(LINE, 0.005)))
    this.group.add(this.baked)
    for (const s of this.segments) s.g.visible = false
  }

  unbake() {
    this.baked.removeFromParent()
    this.baked.children[0].geometry.dispose()
    this.baked = null
    for (const s of this.segments) s.g.visible = s.state !== 0
  }

  // nothing left standing or falling
  get gone() {
    return this.built <= 0.001 && this.segments.every((s) => s.state === 0)
  }

  dispose() {
    this.group.removeFromParent()
  }
}

/* ---------- cars ---------- */

function carGeometry(color) {
  const body = new RoundedBoxGeometry(1, 1, 1, 2, 0.3)
  const wheel = new THREE.CylinderGeometry(1, 1, 1, 12)
  return merge([
    part(body, color, [0, 0.032, 0], [0.11, 0.04, 0.062]),
    part(body, 0xd8f2ff, [-0.008, 0.062, 0], [0.06, 0.032, 0.052]),
    part(body, color, [-0.008, 0.08, 0], [0.058, 0.008, 0.054]),
    ...[[-0.035, -1], [-0.035, 1], [0.035, -1], [0.035, 1]].map(([x, s]) => part(wheel, 0x4a3d48, [x, 0.016, s * 0.031], [0.016, 0.012, 0.016], [Math.PI / 2, 0, 0])),
    part(new THREE.SphereGeometry(1, 8, 6), 0xfff6c2, [0.056, 0.036, 0.018], [0.006, 0.006, 0.006]),
    part(new THREE.SphereGeometry(1, 8, 6), 0xfff6c2, [0.056, 0.036, -0.018], [0.006, 0.006, 0.006]),
  ])
}
const CAR_GEOS = CAR_COLORS.map(carGeometry)

/* ---------- number badges ---------- */

function drawBadge(g, value, have, done, over) {
  g.clearRect(0, 0, 128, 128)
  g.fillStyle = 'rgba(40,60,80,.25)'
  g.beginPath(); g.arc(64, 68, 50, 0, Math.PI * 2); g.fill()
  g.fillStyle = done ? '#6fd08a' : over ? '#ff8f8f' : '#fffaf2'
  g.beginPath(); g.arc(64, 62, 50, 0, Math.PI * 2); g.fill()
  // a ring of segments, one per bridge this island wants
  const gap = value > 1 ? 0.22 : 0
  for (let k = 0; k < value; k++) {
    const a0 = -Math.PI / 2 + (k / value) * Math.PI * 2 + gap / 2
    const a1 = -Math.PI / 2 + ((k + 1) / value) * Math.PI * 2 - gap / 2
    g.strokeStyle = k < have ? (done ? '#ffffff' : over ? '#d94f4f' : '#4fb8d8') : done ? 'rgba(255,255,255,.5)' : '#e6dccd'
    g.lineWidth = 9
    g.lineCap = 'round'
    g.beginPath(); g.arc(64, 62, 40, a0, a1); g.stroke()
  }
  g.fillStyle = done ? '#ffffff' : '#4e3d4c'
  g.font = '700 46px Fredoka, Nunito, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(value), 64, 64)
}

/* ---------- the scene ---------- */

export class IslandScene {
  constructor(container) {
    this.container = container
    this.mobile = matchMedia('(pointer: coarse)').matches
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
    this.sky = new THREE.HemisphereLight(0xf2f8ff, 0x9fd6cf, 1.5)
    this.sun = new THREE.DirectionalLight(0xfff1dc, 1.9)
    this.sun.position.set(-5, 10, 6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sky, this.sun, this.sun.target)
    this.sea = new Sea(this.scene)
    this.ambient = new Ambient(this.scene)
    this.world = new THREE.Group()
    this.scene.add(this.world)
    this.ray = new THREE.Raycaster()
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18)
    this.time = 0
    this.dusk = 0
    this.duskTarget = 0
    new ResizeObserver(() => this.resize()).observe(container)
  }

  load(board, { seed = 1 } = {}) {
    this.world.clear()
    this.board = board
    this.fx = []
    this.cars = []
    this.duskTarget = 0
    const { width, height } = board.level
    this.width = width
    this.height = height
    const box = this.container.getBoundingClientRect()
    const aspect = box.width ? box.height / box.width : 1.6
    // stretch the rows so the sea fills a tall phone screen
    this.CZ = height > 1 ? clamp(((width * CX) * aspect / Math.sin(ELEVATION) - 0.9) / height, 1, 1.7) : 1
    this.islands = board.burrows.map((b) => {
      const p = this.pos(b.index)
      const r = islandRadius(b.value)
      const group = new THREE.Group()
      group.position.copy(p)
      this.world.add(group)
      // neighbouring islands get different biomes, so each one has its own character
      const biome = BIOME_NAMES[(b.index * 5 + seed) % BIOME_NAMES.length]
      const island = new Island(r, seed * 13 + b.index * 7, biome, BIOMES[biome])
      group.add(island.group)
      const city = new City(seed * 17 + b.index * 11, biome)
      city.group.scale.setScalar(r)
      city.group.position.y = 0.205
      group.add(city.group)
      city.setTier(0)
      city.settle()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 128
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
      badge.scale.setScalar(0.42)
      badge.position.set(p.x + r * 0.95, 0.3, p.z + r * 0.75)
      badge.renderOrder = 10
      this.world.add(badge)
      const entry = { b, r, group, city, island, badge, canvas, tex, bounce: -1, key: '' }
      this.drawBadge(entry, 0, false, false)
      return entry
    })
    this.bridges = board.edges.map(() => null)
    this.counts = board.edges.map(() => 0)
    this.preview = null
    this.retiring = []
    this.shadowFrames = 3
    const reach = Math.max(width, height * this.CZ) + 3
    const shores = []
    for (const is of this.islands) {
      const { x, z } = is.group.position
      shores.push({ x, z, radius: is.island.shore })
      for (const rock of is.island.rocks) shores.push({ x: x + rock.x, z: z + rock.z, r: rock.r })
    }
    this.sea.setShores(shores, reach)
    this.ambient.setup((x, z) => this.sea.distance(x, z), [-width / 2 - 0.3, width / 2 + 0.3, -height * this.CZ / 2 - 0.3, height * this.CZ / 2 + 0.3])
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: 60 })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.resize()
  }

  pos(i) {
    const b = this.board.burrows[i]
    return new THREE.Vector3((b.column + 0.5 - this.width / 2) * CX, 0, (b.row + 0.5 - this.height / 2) * this.CZ)
  }

  drawBadge(entry, have, done, over) {
    const key = `${have}-${done}-${over}`
    if (entry.key === key) return
    entry.key = key
    drawBadge(entry.canvas.getContext('2d'), entry.b.value, have, done, over)
    entry.tex.needsUpdate = true
  }

  // the two ends of a bridge, at the shores of its islands
  ends(edgeIndex, fromIsland = null) {
    const e = this.board.edges[edgeIndex]
    let ia = e.a, ib = e.b
    if (fromIsland === e.b) [ia, ib] = [ib, ia]
    const a = this.pos(ia), b = this.pos(ib)
    const dir = b.clone().sub(a).normalize()
    return [a.clone().addScaledVector(dir, this.islands[ia].r * 0.92), b.clone().addScaledVector(dir, -this.islands[ib].r * 0.92), ia, ib]
  }

  /* ---------- state from the game ---------- */

  setBridges(counts) {
    this.board.edges.forEach((e, i) => {
      const want = counts[i]
      const cur = this.bridges[i]
      if ((cur?.lanes ?? 0) === want) return
      if (cur) this.retire(cur, want ? 'fade' : 'fall')
      this.bridges[i] = null
      if (!want) return
      let br
      if (this.preview?.edge === i && this.preview.bridge.lanes === want) {
        // the bridge the player just dragged out stays and opens
        br = this.preview.bridge
        br.adopt()
        this.preview = null
      } else {
        const [a, b] = this.ends(i)
        br = new Bridge(this.world, a, b, want)
      }
      br.target = 1
      br.built = Math.max(br.built, 0)
      br.edge = i
      this.hook(br)
      this.bridges[i] = br
    })
    this.counts = counts.slice()
    // footpaths run from every bridge into town
    for (const is of this.islands) {
      const dirs = Object.entries(this.board.neighbors[is.b.index]).filter(([, e]) => counts[e] > 0).map(([d]) => d)
      is.island.setPaths(dirs)
    }
  }

  hook(br) {
    br.onPlank = (b, k) => this.onPlank?.(k / b.segments.length, b.preview)
    br.onSplash = (p) => this.droplets(p, 4)
    br.onOpen = (b) => {
      // confetti at both ends, and the islands give a little hop
      for (const t of [0, 1]) {
        const p = b.pointAt(t)
        this.confetti(p.x, p.y, p.z)
      }
      const e = this.board.edges[b.edge]
      this.bounce(e.a)
      this.bounce(e.b)
      b.spawn = 0.15
      this.onOpen?.(b.lanes)
    }
  }

  retire(bridge, mode) {
    bridge.mode = mode
    bridge.target = 0
    bridge.built = Math.min(bridge.built, 1)
    if (mode === 'fade') bridge.built = 0
    this.retiring.push(bridge)
    for (const car of this.cars) if (car.bridge === bridge) car.gone = true
  }

  // per island: { tier, have, done, over }
  setIslands(states) {
    states.forEach((s, i) => {
      const is = this.islands[i]
      if (is.city.setTier(s.tier)) is.bounce = 0
      is.island.setHappy(s.done)
      this.drawBadge(is, s.have, s.done, s.over)
    })
  }

  setPreview(p) {
    if (!p) {
      if (this.preview) this.preview.bridge.dispose()
      this.preview = null
      return null
    }
    const key = `${p.edge}-${p.from}-${p.lanes}`
    if (!this.preview || this.preview.key !== key) {
      this.setPreview(null)
      const [a, b] = this.ends(p.edge, p.from)
      const bridge = new Bridge(this.world, a, b, p.lanes, { preview: true })
      bridge.edge = p.edge
      this.hook(bridge)
      this.preview = { key, bridge, edge: p.edge }
    }
    const br = this.preview.bridge
    br.built = clamp(p.progress, 0, 1)
    br.setBlocked(p.blocked)
    return br.pointAt(clamp(p.progress, 0, 1))
  }

  bounce(i) { this.islands[i].bounce = 0 }

  droplets(p, n) {
    for (let k = 0; k < n; k++) {
      const drop = new THREE.Mesh(DROPLET, toon(0xffffff, { rim: 0.05 }))
      drop.position.set(p.x + (Math.random() - 0.5) * 0.06, 0.01, p.z + (Math.random() - 0.5) * 0.06)
      drop.scale.setScalar(0.014 + Math.random() * 0.01)
      this.world.add(drop)
      this.fx.push({ mesh: drop, v: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5), life: 0.6, age: 0, gravity: 4 })
    }
  }

  confetti(x, y, z) {
    for (let k = 0; k < 16; k++) {
      const bit = new THREE.Mesh(CONFETTI, new THREE.MeshBasicMaterial({ color: BUNTING[k % BUNTING.length], side: THREE.DoubleSide }))
      bit.position.set(x, y + 0.05, z)
      bit.rotation.set(Math.random() * 6, Math.random() * 6, 0)
      bit.scale.setScalar(0.022)
      this.world.add(bit)
      const a = Math.random() * Math.PI * 2
      this.fx.push({ mesh: bit, v: new THREE.Vector3(Math.cos(a) * 0.5, 0.9 + Math.random() * 0.6, Math.sin(a) * 0.5), life: 0.9, age: 0, gravity: 2.6, spin: 8 })
    }
  }

  sparkle(x, z, n = 3, color = 0xfff2b0) {
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), new THREE.MeshBasicMaterial({ color }))
      s.position.set(x, DECK_Y + 0.05, z)
      this.world.add(s)
      this.fx.push({ mesh: s, v: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random(), (Math.random() - 0.5) * 1.2), life: 0.5, age: 0, gravity: 5 })
    }
  }

  shakeBridge(edgeIndex) {
    const br = this.bridges[edgeIndex]
    if (br) br.shake = 0.4
  }

  celebrate() {
    this.duskTarget = 1
    this.fireworks = 4.5
  }

  /* ---------- picking ---------- */

  toWorld(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    return this.ray.ray.intersectPlane(this.plane, hit) ? hit : null
  }

  toScreen(v) {
    const p = v.clone().project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height }
  }

  islandAt(p) {
    let best = null, bd = Infinity
    for (const is of this.islands) {
      const d = Math.hypot(p.x - is.group.position.x, p.z - is.group.position.z)
      if (d < is.r + 0.18 && d < bd) { bd = d; best = is.b.index }
    }
    return best
  }

  bridgeAt(p) {
    let best = null, bd = 0.22
    this.board.edges.forEach((e) => {
      if (!this.counts[e.index]) return
      const a = this.pos(e.a), b = this.pos(e.b)
      const inside = e.horizontal ? p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x) : p.z > Math.min(a.z, b.z) && p.z < Math.max(a.z, b.z)
      const d = e.horizontal ? Math.abs(p.z - a.z) : Math.abs(p.x - a.x)
      if (inside && d < bd) { bd = d; best = e.index }
    })
    return best
  }

  /* ---------- framing ---------- */

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    if (!this.board) return
    this.camera.position.set(0, Math.sin(ELEVATION) * 40, Math.cos(ELEVATION) * 40)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
    const hw = this.width * CX / 2 + 0.4, hd = this.height * this.CZ / 2 + 0.3
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const [x, y, z] of [[-hw, 0, -hd], [hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd], [-hw, 0.9, -hd + 0.6], [hw, 0.9, -hd + 0.6]]) {
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
    this.dusk = THREE.MathUtils.damp(this.dusk, this.duskTarget, 1.2, dt)
    this.sea.update(dt, this.dusk * 0.6)
    this.ambient.update(dt)
    this.sun.color.setHex(0xfff1dc).lerp(new THREE.Color(0xffb27a), this.dusk)
    this.sky.color.setHex(0xf2f8ff).lerp(new THREE.Color(0xffd9c9), this.dusk)
    if (!this.board) return
    for (const is of this.islands) {
      is.city.update(dt)
      is.island.update(dt)
      if (is.bounce >= 0) {
        is.bounce += dt / 0.45
        const k = Math.min(1, is.bounce)
        const w = Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.06
        is.group.scale.set(1 + w, 1 - w, 1 + w)
        if (k >= 1) { is.bounce = -1; is.group.scale.set(1, 1, 1) }
      }
      is.badge.position.y = 0.3 + Math.sin(this.time * 2 + is.b.index) * 0.012
    }
    for (const br of this.bridges) {
      if (!br) continue
      br.update(dt, this.time)
      if (br.shake > 0) {
        br.shake -= dt
        br.group.position.y = Math.abs(Math.sin(this.time * 40)) * 0.03 * Math.max(0, br.shake)
      }
    }
    this.preview?.bridge.update(dt, this.time)
    for (const br of this.retiring) br.update(dt, this.time)
    this.retiring = this.retiring.filter((br) => { if (br.gone) { br.dispose(); return false } return true })
    this.traffic(dt)
    const busy = this.preview || this.retiring.length || this.bridges.some((br) => br && !br.baked) || this.islands.some((is) => is.bounce >= 0 || is.city.busy)
    if (busy) this.shadowFrames = 3
    if (this.shadowFrames > 0) {
      this.shadowFrames--
      this.renderer.shadowMap.needsUpdate = true
    }
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const f = this.fx[k]
      f.age += dt
      f.v.y -= f.gravity * dt
      f.mesh.position.addScaledVector(f.v, dt)
      f.mesh.scale.multiplyScalar(1 - dt * 1.5)
      if (f.spin) { f.mesh.rotation.x += f.spin * dt; f.mesh.rotation.y += f.spin * 0.7 * dt }
      if (f.age > f.life) { f.mesh.removeFromParent(); this.fx.splice(k, 1) }
    }
    if (this.fireworks > 0) {
      this.fireworks -= dt
      if (Math.random() < dt * 5) {
        const is = this.islands[Math.floor(Math.random() * this.islands.length)]
        const color = CAR_COLORS[Math.floor(Math.random() * 6)]
        const c = is.group.position
        for (let k = 0; k < 18; k++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), new THREE.MeshBasicMaterial({ color }))
          s.position.set(c.x, 1.3, c.z)
          this.world.add(s)
          const a = (k / 18) * Math.PI * 2
          this.fx.push({ mesh: s, v: new THREE.Vector3(Math.cos(a) * 0.9, Math.sin(a) * 0.9 + 0.3, (Math.random() - 0.5) * 0.4), life: 1.1, age: 0, gravity: 0.8 })
        }
      }
    }
  }

  // Tiny cars cross every open bridge, more of them as the cities on both ends grow.
  traffic(dt) {
    for (const br of this.bridges) {
      if (!br || br.built < 1) continue
      const ia = this.islands[this.board.edges[br.edge].a], ib = this.islands[this.board.edges[br.edge].b]
      const want = Math.min(br.lanes * 2, 1 + Math.floor((ia.city.tier + ib.city.tier) / 4)) * (br.lanes === 2 ? 1 : 1)
      const mine = this.cars.filter((c) => c.bridge === br && !c.gone)
      br.spawn = (br.spawn ?? 0) - dt
      if (mine.length < want && br.spawn <= 0) {
        const lane = br.lanes === 2 ? (mine.filter((c) => c.lane > 0).length <= mine.filter((c) => c.lane < 0).length ? 1 : -1) : 0
        const forward = br.lanes === 2 ? lane > 0 : Math.random() < 0.5
        const mesh = new THREE.Mesh(CAR_GEOS[Math.floor(Math.random() * CAR_GEOS.length)], toon(0xffffff, { vertexColors: true }))
        this.world.add(mesh)
        this.cars.push({ mesh, bridge: br, lane, forward, t: -0.12, speed: 0.22 + Math.random() * 0.1, bob: Math.random() * 6 })
        br.spawn = 0.8 + Math.random() * 1.6
      }
    }
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const c = this.cars[k]
      c.t += (dt * c.speed) / c.bridge.length
      const t = c.forward ? c.t : 1 - c.t
      const along = clamp(t, 0, 1)
      const p = c.bridge.pointAt(along, c.lane)
      // ease on and off the islands' shores
      const fade = clamp(Math.min(c.t + 0.12, 1.12 - c.t) / 0.12, 0, 1)
      c.mesh.position.copy(p)
      c.mesh.position.y += Math.abs(Math.sin((this.time + c.bob) * 18)) * 0.004
      const ahead = c.bridge.pointAt(clamp(along + (c.forward ? 0.02 : -0.02), 0, 1), c.lane)
      c.mesh.lookAt(ahead.x, ahead.y, ahead.z)
      c.mesh.rotateY(-Math.PI / 2)
      const s = (c.gone ? Math.max(0, 1 - (c.goneT = (c.goneT ?? 0) + dt * 3)) : 1) * Math.max(0.001, fade) * 1.5
      c.mesh.scale.setScalar(Math.max(0.001, s))
      if (c.t > 1.12 || (c.gone && c.goneT >= 1)) {
        c.mesh.removeFromParent()
        this.cars.splice(k, 1)
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}

export { seeded, canvasTexture }
