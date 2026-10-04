import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Bunny, COAT_NAMES, makeBasket, makeCarrot } from './bunny.js'
import { otherEnd, routeFrom } from './logic.js'

const COLORS = {
  grass: 0x9bd873, grassDark: 0x6fb556, grassSide: 0x7cc25e, mound: 0xa6e07e, earth: 0xc99060, earthDark: 0xa06e44,
  path: 0xe6c08a, stone: 0xf4ecdc, wood: 0xb0773f, woodDark: 0x7d4f2b, frame: 0xe1d4bd, trunk: 0xa0704a,
  leaf: 0x54b25c, leafLight: 0x9fe282, leafDark: 0x2f8a4c, cherry: 0xffb3c7, cherryLight: 0xffd3df, rock: 0xc7cfca,
  mushroom: 0xe8574d, berry: 0xe8546b, chimney: 0xd9b48a, water: 0x6fcbd6,
}
const FLOWER_COLORS = [0xffe07a, 0xffc2d6, 0xffffff, 0xc9b6ff, 0xffa8a0]
const mat = (color, options = {}) => new THREE.MeshLambertMaterial({ color, ...options })
const M = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, mat(v)]))
M.glow = mat(0xffd27a, { emissive: 0xffb347, emissiveIntensity: 1.1 })
M.dark = mat(0x4a2e1c)

const CELL = 1
const R = 0.44 // burrow mound radius
const GRANDMA_R = 0.5
const BUNNY_SCALE = 0.34
const ELEVATION = 50 * Math.PI / 180
const clamp = THREE.MathUtils.clamp
const smooth = (t) => t * t * (3 - 2 * t)
const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2
const bump = (t) => Math.sin(clamp(t, 0, 1) * Math.PI)
// Set-out baskets stand to one side of each path's mouth, chosen to keep clear of the
// door (front) and the resident bunny (front left).
const BASKET_SIDE = { up: [-1, 0, 0], down: [1, 0, 0], left: [0, 0, -1], right: [0, 0, 1] }
const DIR_VECTORS = { up: [0, 0, -1], down: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0] }

function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function mesh(geometry, material, parent, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(x, y, z)
  m.castShadow = cast
  m.receiveShadow = receive
  parent.add(m)
  return m
}

const glowTexture = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,220,140,0.95)')
  gradient.addColorStop(0.4, 'rgba(255,196,100,0.4)')
  gradient.addColorStop(1, 'rgba(255,180,80,0)')
  g.fillStyle = gradient
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
})()
const puffTexture = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gradient
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
})()
const heartTexture = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  g.fillStyle = '#ff8fab'
  g.beginPath()
  g.moveTo(32, 54)
  g.bezierCurveTo(4, 36, 6, 10, 22, 10)
  g.bezierCurveTo(28, 10, 32, 16, 32, 20)
  g.bezierCurveTo(32, 16, 36, 10, 42, 10)
  g.bezierCurveTo(58, 10, 60, 36, 32, 54)
  g.fill()
  return new THREE.CanvasTexture(canvas)
})()

function sprite(texture, size, options = {}) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, ...options }))
  s.scale.setScalar(size)
  return s
}

const STONE = new THREE.CylinderGeometry(0.06, 0.068, 0.03, 10)
const STRIP_CACHE = new Map()
function stripGeometry(length, width) {
  const key = `${length.toFixed(3)}-${width}`
  if (!STRIP_CACHE.has(key)) STRIP_CACHE.set(key, new RoundedBoxGeometry(length, 0.04, width, 2, 0.018))
  return STRIP_CACHE.get(key)
}

export class WarrenScene {
  constructor(container, { onTapBurrow, onDragEdge, onTapEdge, onTapEmpty, safeArea }) {
    this.container = container
    this.onTapBurrow = onTapBurrow
    this.onDragEdge = onDragEdge
    this.onTapEdge = onTapEdge
    this.onTapEmpty = onTapEmpty
    this.safeArea = safeArea
    this.mobile = matchMedia('(pointer: coarse)').matches
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: new URLSearchParams(location.search).has('capture') })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.75 : 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    container.append(this.renderer.domElement)

    this.scene.add(new THREE.HemisphereLight(0xc4ddff, 0xd2dcaa, 1.55))
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.5)
    sun.position.set(-7, 14, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048)
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    sun.shadow.radius = 4
    this.scene.add(sun)
    this.scene.add(sun.target)
    this.sun = sun

    this.world = new THREE.Group()
    this.scene.add(this.world)
    this.raycaster = new THREE.Raycaster()
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.pointer = null
    this.time = 0
    this.effects = []
    this.couriers = []
    this.bindInput()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.lastFrame = 0
    this.renderer.setAnimationLoop((time) => this.frame(time))
  }

  /* ---------- level ---------- */

  load(board) {
    this.world.clear()
    this.effects = []
    this.couriers = []
    this.board = board
    this.fedBefore = null
    const { width, height } = board
    this.half = { x: ((width - 1) / 2) * CELL, z: ((height - 1) / 2) * CELL }
    this.trayWidth = width * CELL + 0.5
    this.trayDepth = height * CELL + 0.5
    this.buildTray()
    this.burrows = board.burrows.map((b) => this.buildBurrow(b))
    this.paths = board.edges.map(() => null)
    this.counts = board.edges.map(() => 0)
    this.buildDecor()
    this.buildMarkers()
    const shadow = this.sun.shadow.camera
    const reach = Math.max(this.trayWidth, this.trayDepth) * 0.75 + 1
    Object.assign(shadow, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 40 })
    shadow.updateProjectionMatrix()
    this.resize()
    this.intro = this.reducedMotion || new URLSearchParams(location.search).has('capture') ? 1 : 0
  }

  cellPosition(row, column) {
    return new THREE.Vector3(column * CELL - this.half.x, 0, row * CELL - this.half.z)
  }

  buildTray() {
    const w = this.trayWidth
    const d = this.trayDepth
    mesh(new RoundedBoxGeometry(w, 0.3, d, 4, 0.14), M.grass, this.world, 0, -0.15, 0)
    mesh(new RoundedBoxGeometry(w - 0.03, 0.42, d - 0.03, 4, 0.12), M.earth, this.world, 0, -0.47, 0)
    mesh(new RoundedBoxGeometry(w - 0.06, 0.24, d - 0.06, 4, 0.1), M.earthDark, this.world, 0, -0.76, 0)
    const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x6b4a2a, opacity: 0.16 }))
    table.position.y = -0.9
    table.receiveShadow = true
    this.world.add(table)
    // Pebbles and a few buried carrots in the soil's cross-section
    const pebble = new THREE.SphereGeometry(1, 8, 6)
    for (let i = 0; i < Math.round(w * 4); i++) {
      const p = mesh(pebble, seeded(i) < 0.5 ? M.rock : M.stone, this.world, -w / 2 + 0.2 + seeded(i + 9) * (w - 0.4), -0.38 - seeded(i + 3) * 0.42, d / 2 - 0.01, { cast: false })
      p.scale.set(0.03 + seeded(i + 5) * 0.035, 0.025 + seeded(i + 6) * 0.02, 0.015)
    }
    for (let i = 0; i < Math.max(2, Math.round(w / 2.5)); i++) {
      const carrot = makeCarrot()
      carrot.scale.setScalar(0.45)
      carrot.position.set(-w / 2 + 0.6 + ((i + 0.5) / Math.max(2, Math.round(w / 2.5))) * (w - 1.2) + (seeded(i + 40) - 0.5) * 0.4, -0.36, d / 2 + 0.005)
      carrot.rotation.z = (seeded(i + 41) - 0.5) * 0.6
      this.world.add(carrot)
    }
  }

  buildBurrow(burrow) {
    const board = this.board
    const grandma = burrow.index === board.source
    const radius = grandma ? GRANDMA_R : R
    const group = new THREE.Group()
    group.position.copy(this.cellPosition(burrow.row, burrow.column))
    this.world.add(group)
    const bob = new THREE.Group()
    group.add(bob)
    const heightScale = 0.68
    const top = radius * heightScale
    const mound = mesh(new THREE.SphereGeometry(radius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.mound, bob)
    mound.scale.y = heightScale
    mesh(new THREE.TorusGeometry(radius, 0.028, 8, 40).rotateX(Math.PI / 2), M.grassDark, bob, 0, 0.008, 0, { cast: false })
    // tufts on the mound
    const tuft = new THREE.ConeGeometry(0.022, 0.07, 5)
    for (let i = 0; i < 6; i++) {
      const a = seeded(burrow.index * 13 + i) * Math.PI * 2
      const r = radius * (0.55 + seeded(burrow.index * 7 + i) * 0.35)
      if (Math.cos(a) > 0.5) continue
      const y = top * Math.sqrt(Math.max(0, 1 - (r / radius) ** 2))
      mesh(tuft, M.grassDark, bob, Math.sin(a) * r, y + 0.025, Math.cos(a) * r, { cast: false })
    }

    // Round front door: a frame, a wooden leaf on a hinge, warm light inside.
    const door = new THREE.Group()
    const doorY = 0.09
    door.position.set(0, doorY, radius * Math.sqrt(1 - (doorY / top) ** 2) - 0.012)
    door.rotation.x = -0.5
    bob.add(door)
    const doorRadius = grandma ? 0.14 : 0.125
    const frame = mesh(new THREE.TorusGeometry(doorRadius, 0.022, 8, 28, Math.PI * 1.15), M.frame, door, 0, 0, 0.008, { cast: false })
    frame.rotation.z = -0.075 * Math.PI
    const inside = mesh(new THREE.CircleGeometry(doorRadius * 0.95, 24), M.dark, door, 0, 0, 0.004, { cast: false })
    const hinge = new THREE.Group()
    hinge.position.set(-doorRadius, 0, 0.01)
    door.add(hinge)
    const leaf = mesh(new THREE.CylinderGeometry(doorRadius * 0.95, doorRadius * 0.95, 0.02, 24), M.wood, hinge, doorRadius, 0, 0, { cast: false })
    leaf.rotation.x = Math.PI / 2
    for (const dx of [-0.035, 0, 0.035]) mesh(new THREE.BoxGeometry(0.005, doorRadius * 1.7, 0.004), M.woodDark, leaf, dx, 0.011, 0, { cast: false }).rotation.x = -Math.PI / 2
    mesh(new THREE.SphereGeometry(0.012, 8, 6), mat(0xffd36b), hinge, doorRadius * 1.7, 0, 0.018, { cast: false })
    const doorGlow = sprite(glowTexture, 0.42, { blending: THREE.AdditiveBlending, opacity: 0 })
    doorGlow.position.set(0, doorY + 0.03, radius + 0.04)
    bob.add(doorGlow)

    // Grandma's burrow: a chimney with smoke, a window box, and a little veg patch sign.
    let chimney = null
    if (grandma) {
      chimney = new THREE.Group()
      chimney.position.set(radius * 0.38, top * 0.78, -radius * 0.3)
      bob.add(chimney)
      mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 10), M.chimney, chimney, 0, 0.06, 0)
      mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.025, 10), M.woodDark, chimney, 0, 0.14, 0)
      // tiny carrot rows on the back of her mound
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i - 2) * 0.32
        const r = radius * 0.62
        const y = top * Math.sqrt(1 - (r / radius) ** 2)
        for (const k of [-1, 1]) {
          const leafTop = mesh(new THREE.ConeGeometry(0.014, 0.06, 4), M.leaf, bob, Math.sin(a) * r, y + 0.025, Math.cos(a) * r, { cast: false })
          leafTop.rotation.z = k * 0.35
        }
        mesh(new THREE.SphereGeometry(0.014, 6, 5), mat(0xf28c38), bob, Math.sin(a) * r, y + 0.004, Math.cos(a) * r, { cast: false })
      }
      // heart sign on a post
      const sign = new THREE.Group()
      sign.position.set(-radius - 0.08, 0, -0.12)
      group.add(sign)
      mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.2, 6), M.woodDark, sign, 0, 0.1, 0)
      mesh(new THREE.BoxGeometry(0.15, 0.09, 0.015), M.wood, sign, 0, 0.19, 0)
      const heart = sprite(heartTexture, 0.07)
      heart.position.set(0, 0.19, 0.012)
      sign.add(heart)
    }

    // Resident bunny, front left of the door.
    const bunny = new Bunny(grandma
      ? { grandma: true, coat: 'silver', seed: 97 }
      : {
          coat: COAT_NAMES[Math.floor(seeded(burrow.index * 3 + this.board.burrows.length) * COAT_NAMES.length)],
          lop: seeded(burrow.index * 5 + 1) < 0.25,
          accessory: ['bow', 'scarf', 'flower', null, null][Math.floor(seeded(burrow.index * 11 + 2) * 5)],
          seed: 7 + burrow.index * 31,
        })
    bunny.root.scale.setScalar(BUNNY_SCALE * (grandma ? 1.08 : 1))
    bunny.gazeUp = 0.32
    const angle = -0.78
    const home = new THREE.Vector3(Math.sin(angle) * (radius + 0.13), 0, Math.cos(angle) * (radius + 0.13))
    bunny.root.position.copy(home)
    bunny.root.rotation.y = -0.2
    bunny.setMood(grandma ? 'content' : 'sleepy')
    group.add(bunny.root)

    // One basket per path the burrow needs.
    const baskets = Array.from({ length: burrow.value }, () => {
      const basket = makeBasket()
      basket.scale.setScalar(0.12)
      group.add(basket)
      const state = { object: basket, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, slot: null, filled: false, fill: 0, fillDelay: 0 }
      return state
    })

    const selection = mesh(new THREE.RingGeometry(radius + 0.05, radius + 0.09, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0, depthWrite: false }), group, 0, 0.012, 0, { cast: false, receive: false })
    return { burrow, group, bob, radius, top, door: { hinge, open: 0, glow: doorGlow, inside }, bunny, home, baskets, chimney, selection, grandma, shake: 0, fed: grandma, spills: [], smokeTimer: 0 }
  }

  // Where waiting baskets sit: a ring on the mound's top, readable at a glance.
  ringSlot(entry, i, n) {
    const ring = n <= 1 ? 0 : clamp(0.06 + n * 0.024, 0.1, entry.radius * 0.55)
    const a = Math.PI + ((i + 0.5) / n) * Math.PI * 2 - Math.PI / n
    const r = ring
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r - 0.02
    const y = entry.top * Math.sqrt(Math.max(0, 1 - (Math.hypot(x, z) / entry.radius) ** 2)) - 0.012
    return new THREE.Vector3(x, y, z)
  }

  // Where a set-out basket stands beside the mouth of a path.
  mouthSlot(entry, direction, lane, lanes) {
    const [dx, , dz] = DIR_VECTORS[direction]
    const [sx, , sz] = BASKET_SIDE[direction]
    const out = entry.radius + 0.06
    const along = (lanes === 2 ? 0.24 : 0.18) + lane * 0.14
    return new THREE.Vector3(dx * out + sx * along, 0, dz * out + sz * along)
  }

  buildDecor() {
    const board = this.board
    const blocked = new Set()
    for (const b of board.burrows) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!dr || !dc) blocked.add(`${b.row + dr},${b.column + dc}`)
    }
    for (const e of board.edges) for (const [r, c] of e.cells) blocked.add(`${r},${c}`)
    const free = []
    for (let r = 0; r < board.height; r++) for (let c = 0; c < board.width; c++) if (!blocked.has(`${r},${c}`)) free.push([r, c])

    // Instanced little things: grass tufts and flowers everywhere they won't be in the way.
    const tuftGeo = new THREE.ConeGeometry(0.016, 0.075, 4)
    const flowerGeo = new THREE.SphereGeometry(0.022, 8, 6)
    const tufts = []
    const flowers = []
    const nearBurrow = (x, z) => board.burrows.some((b) => {
      const p = this.cellPosition(b.row, b.column)
      return Math.hypot(p.x - x, p.z - z) < (b.index === board.source ? GRANDMA_R : R) + 0.2
    })
    const onPath = (x, z) => board.edges.some((e) => {
      const a = this.cellPosition(board.burrows[e.a].row, board.burrows[e.a].column)
      const b = this.cellPosition(board.burrows[e.b].row, board.burrows[e.b].column)
      return e.horizontal ? Math.abs(z - a.z) < 0.24 && x > Math.min(a.x, b.x) && x < Math.max(a.x, b.x)
        : Math.abs(x - a.x) < 0.24 && z > Math.min(a.z, b.z) && z < Math.max(a.z, b.z)
    })
    const w = this.trayWidth / 2 - 0.12
    const d = this.trayDepth / 2 - 0.12
    for (let i = 0; i < board.width * board.height * 3; i++) {
      const x = (seeded(i * 2 + 1) * 2 - 1) * w
      const z = (seeded(i * 2 + 2) * 2 - 1) * d
      if (nearBurrow(x, z) || onPath(x, z)) continue
      ;(seeded(i + 500) < 0.3 ? flowers : tufts).push([x, z, i])
    }
    const tuftMesh = new THREE.InstancedMesh(tuftGeo, M.grassDark, tufts.length * 3)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    tufts.forEach(([x, z, i], k) => {
      for (let j = 0; j < 3; j++) {
        q.setFromEuler(new THREE.Euler(0, 0, (j - 1) * 0.35))
        m4.compose(new THREE.Vector3(x + (j - 1) * 0.022, 0.035, z), q, new THREE.Vector3(1, 0.8 + seeded(i + j) * 0.6, 1))
        tuftMesh.setMatrixAt(k * 3 + j, m4)
        tuftMesh.setColorAt(k * 3 + j, new THREE.Color(seeded(i + j * 7) < 0.5 ? COLORS.grassDark : COLORS.leafLight))
      }
    })
    this.world.add(tuftMesh)
    const flowerMesh = new THREE.InstancedMesh(flowerGeo, mat(0xffffff), flowers.length)
    const stemMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 4), M.leafDark, flowers.length)
    flowers.forEach(([x, z, i], k) => {
      m4.compose(new THREE.Vector3(x, 0.075, z), q.identity(), new THREE.Vector3(1, 0.8, 1))
      flowerMesh.setMatrixAt(k, m4)
      flowerMesh.setColorAt(k, new THREE.Color(FLOWER_COLORS[Math.floor(seeded(i + 77) * FLOWER_COLORS.length)]))
      m4.compose(new THREE.Vector3(x, 0.035, z), q.identity(), new THREE.Vector3(1, 1, 1))
      stemMesh.setMatrixAt(k, m4)
    })
    flowerMesh.castShadow = true
    this.world.add(flowerMesh, stemMesh)

    // Bigger scenery on whole free cells: trees, bushes, mushrooms, a pond.
    let trees = 0
    let pond = false
    free.forEach(([r, c], k) => {
      const p = this.cellPosition(r, c)
      const roll = seeded(r * 31 + c * 17 + board.burrows.length)
      const jx = (seeded(k + 3) - 0.5) * 0.3
      const jz = (seeded(k + 4) - 0.5) * 0.3
      if (!pond && roll > 0.93) {
        pond = true
        const water = mesh(new THREE.CircleGeometry(0.3, 28).rotateX(-Math.PI / 2), mat(COLORS.water), this.world, p.x, 0.004, p.z, { cast: false })
        water.scale.set(1, 1, 0.8)
        mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 28).rotateX(Math.PI / 2), M.stone, this.world, p.x, 0.006, p.z, { cast: false }).scale.set(1, 1, 0.8)
        mesh(new THREE.CircleGeometry(0.06, 14, 0.3, Math.PI * 1.75).rotateX(-Math.PI / 2), M.leaf, this.world, p.x + 0.08, 0.008, p.z - 0.04, { cast: false })
      } else if (roll < 0.36 && trees < 14) {
        trees++
        this.tree(p.x + jx, p.z + jz, seeded(k + 9) < 0.35 ? 'cherry' : 'leaf', 0.75 + seeded(k + 1) * 0.35)
      } else if (roll < 0.62) {
        this.bush(p.x + jx, p.z + jz)
      } else if (roll < 0.8) {
        this.mushrooms(p.x + jx, p.z + jz)
      }
    })
  }

  tree(x, z, kind, s) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.scale.setScalar(s)
    g.rotation.y = seeded(x * 10 + z) * 6
    this.world.add(g)
    mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.3, 8), M.trunk, g, 0, 0.15, 0)
    const cols = kind === 'cherry' ? [M.cherry, M.cherryLight, M.cherry] : [M.leaf, M.leafLight, M.leafDark]
    mesh(new THREE.IcosahedronGeometry(0.22, 2), cols[0], g, 0, 0.42, 0)
    mesh(new THREE.IcosahedronGeometry(0.15, 2), cols[1], g, 0.12, 0.54, 0.05)
    mesh(new THREE.IcosahedronGeometry(0.14, 2), cols[2], g, -0.13, 0.36, 0.08)
  }

  bush(x, z) {
    const color = seeded(x * 3 + z) < 0.5 ? M.leaf : M.leafLight
    mesh(new THREE.IcosahedronGeometry(0.11, 2), color, this.world, x, 0.06, z).scale.y = 0.8
    mesh(new THREE.IcosahedronGeometry(0.08, 2), color, this.world, x + 0.1, 0.045, z + 0.04).scale.y = 0.8
    if (seeded(x + z * 5) < 0.6) for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.018, 8, 6), M.berry, this.world, x + (seeded(i + x) - 0.4) * 0.16, 0.11, z + 0.06 + seeded(i + z) * 0.04, { cast: false })
  }

  mushrooms(x, z) {
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group()
      g.position.set(x + i * 0.08, 0, z + i * 0.05)
      g.scale.setScalar(1 - i * 0.3)
      this.world.add(g)
      mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.08, 8), M.stone, g, 0, 0.04, 0)
      mesh(new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.mushroom, g, 0, 0.075, 0).scale.y = 0.75
      for (let k = 0; k < 3; k++) mesh(new THREE.SphereGeometry(0.009, 6, 4), M.stone, g, Math.cos(k * 2.1) * 0.03, 0.105, Math.sin(k * 2.1) * 0.03, { cast: false })
    }
  }

  buildMarkers() {
    // A soft pulsing highlight for hints and the path being dragged.
    this.hintMarker = new THREE.Mesh(new RoundedBoxGeometry(1, 0.02, 0.32, 2, 0.008), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false }))
    this.hintMarker.visible = false
    this.world.add(this.hintMarker)
    this.ghost = new THREE.Mesh(new RoundedBoxGeometry(1, 0.03, 0.22, 2, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }))
    this.ghost.visible = false
    this.world.add(this.ghost)
  }

  /* ---------- geometry helpers ---------- */

  burrowPosition(index) {
    const b = this.board.burrows[index]
    return this.cellPosition(b.row, b.column)
  }

  edgeEnds(edgeIndex) {
    const e = this.board.edges[edgeIndex]
    return [this.burrowPosition(e.a), this.burrowPosition(e.b), this.burrows[e.a].radius, this.burrows[e.b].radius]
  }

  directionFrom(burrowIndex, edgeIndex) {
    const n = this.board.neighbors[burrowIndex]
    return Object.keys(n).find((k) => n[k] === edgeIndex)
  }

  /* ---------- state ---------- */

  // Bring the scene in line with the counts and the game's status.
  sync(counts, status, { changed = null, initial = false } = {}) {
    const board = this.board
    this.counts = counts.slice()
    for (const e of board.edges) this.syncPath(e.index, counts[e.index], initial)

    const fed = status.fed
    const newlyFed = this.fedBefore ? [...fed.keys()].filter((i) => !this.fedBefore.has(i)) : []
    const unfed = this.fedBefore ? [...this.fedBefore.keys()].filter((i) => !fed.has(i)) : []

    this.burrows.forEach((entry, index) => {
      const burrow = entry.burrow
      const degree = status.degree[index]
      const isFed = fed.has(index)
      const distance = fed.get(index) ?? 0
      // Set-out slots, in a stable order: up, right, down, left.
      const mouths = []
      for (const dir of ['up', 'right', 'down', 'left']) {
        const edgeIndex = board.neighbors[index][dir]
        if (edgeIndex === undefined) continue
        for (let lane = 0; lane < counts[edgeIndex]; lane++) mouths.push({ dir, lane, lanes: counts[edgeIndex], edgeIndex })
      }
      const setOut = mouths.slice(0, burrow.value)
      const waiting = burrow.value - setOut.length
      entry.baskets.forEach((basket, i) => {
        let slot
        let key
        if (i < setOut.length) {
          slot = this.mouthSlot(entry, setOut[i].dir, setOut[i].lane, setOut[i].lanes)
          key = `m-${setOut[i].dir}-${setOut[i].lane}`
        } else {
          slot = this.ringSlot(entry, i - setOut.length, waiting)
          key = `r-${i - setOut.length}-${waiting}`
        }
        if (basket.slot !== key) {
          basket.from.copy(initial ? slot : basket.object.position)
          basket.to.copy(slot)
          basket.t = initial ? 1 : 0
          basket.slot = key
          basket.setOut = i < setOut.length
        }
        const wantFull = entry.grandma || (isFed && basket.setOut)
        if (wantFull !== basket.filled) {
          basket.filled = wantFull
          basket.fillDelay = initial || !wantFull ? 0 : 0.25 + distance * 0.28
        }
      })
      // Paths beyond the burrow's baskets spill carrots on the grass.
      const extra = mouths.slice(burrow.value)
      this.syncSpills(entry, extra)
      if (extra.length && changed !== null && board.edges[changed] && (board.edges[changed].a === index || board.edges[changed].b === index)) {
        entry.shake = 1
        entry.bunny.fret()
      }

      entry.fed = isFed
      const mood = entry.grandma ? 'content' : degree > burrow.value ? 'worried' : !isFed ? 'sleepy' : degree === burrow.value ? 'happy' : 'content'
      if (entry.bunny.mood !== mood) {
        if (mood === 'happy' && !initial && !entry.bunny.busy) entry.bunny.binky()
        entry.bunny.setMood(mood)
      }
      entry.doorTarget = isFed ? 1 : 0
      entry.doorDelay = isFed && !initial && newlyFed.includes(index) ? 0.2 + distance * 0.28 : 0
    })

    if (!initial && newlyFed.length) {
      const far = newlyFed.reduce((best, i) => (fed.get(i) > fed.get(best) ? i : best), newlyFed[0])
      if (fed.get(far) >= 1) this.sendCourier(far)
      this.burrows[board.source].bunny.wave()
    }
    if (unfed.length) for (const c of this.couriers) if (unfed.includes(c.goal)) c.cancel = true
    this.fedBefore = new Map(fed)
  }

  syncPath(edgeIndex, count, initial) {
    let path = this.paths[edgeIndex]
    if (!path) {
      if (!count) return
      path = this.paths[edgeIndex] = this.buildPath(edgeIndex)
    }
    if (path.count === count) return
    const was = path.count
    path.count = count
    path.lanes.forEach((lane, i) => {
      // single paths use the middle lane, doubles use the two outer ones
      const active = count === 1 ? i === 0 : count === 2 ? i > 0 : false
      if (lane.active === active) return
      lane.active = active
      lane.t = initial ? 1 : 0
    })
    void was
  }

  buildPath(edgeIndex) {
    const e = this.board.edges[edgeIndex]
    const [a, b, ra, rb] = this.edgeEnds(edgeIndex)
    const group = new THREE.Group()
    this.world.add(group)
    const dir = b.clone().sub(a).normalize()
    const start = a.clone().addScaledVector(dir, ra - 0.04)
    const end = b.clone().addScaledVector(dir, -(rb - 0.04))
    const length = start.distanceTo(end)
    const mid = start.clone().add(end).multiplyScalar(0.5)
    group.position.copy(mid)
    if (!e.horizontal) group.rotation.y = Math.PI / 2
    const lanes = [[0, 0.26], [-0.1, 0.17], [0.1, 0.17]].map(([offset, width], laneIndex) => {
      const lane = new THREE.Group()
      lane.position.z = offset
      group.add(lane)
      const strip = mesh(stripGeometry(length, width), M.path, lane, 0, 0.0, 0, { cast: false })
      const steps = Math.max(2, Math.floor(length / (width > 0.2 ? 0.17 : 0.15)))
      const stones = []
      for (let i = 0; i < steps; i++) {
        const x = -length / 2 + (i + 0.5) * (length / steps)
        const stone = mesh(STONE, M.stone, lane, x, 0.025, (seeded(edgeIndex * 50 + i + laneIndex * 7) - 0.5) * 0.03, { cast: false })
        const s = width > 0.2 ? 1 : 0.8
        stone.userData.scale = new THREE.Vector3(s * (1 + seeded(i + edgeIndex) * 0.2), 1, s * (0.85 + seeded(i * 3 + edgeIndex) * 0.2))
        stone.rotation.y = seeded(i * 7 + edgeIndex) * 3
        stones.push(stone)
      }
      // tiny flowers along the outside edge
      const blooms = []
      for (let i = 0; i < steps; i += 2) {
        const x = -length / 2 + (i + 0.9) * (length / steps)
        const side = laneIndex === 0 ? (i % 4 ? 1 : -1) : laneIndex === 1 ? -1 : 1
        const bloom = mesh(new THREE.SphereGeometry(0.02, 8, 6), mat(FLOWER_COLORS[(i + edgeIndex) % FLOWER_COLORS.length]), lane, x, 0.03, side * (width / 2 + 0.035), { cast: false })
        blooms.push(bloom)
      }
      lane.visible = false
      return { group: lane, strip, stones, blooms, active: false, t: 1, length }
    })
    return { group, lanes, count: 0, length, edgeIndex }
  }

  syncSpills(entry, extra) {
    while (entry.spills.length > extra.length) entry.group.remove(entry.spills.pop())
    extra.forEach((m, i) => {
      if (entry.spills[i]) return
      const spill = new THREE.Group()
      const slot = this.mouthSlot(entry, m.dir, m.lane, m.lanes)
      spill.position.copy(slot)
      for (let k = 0; k < 2; k++) {
        const carrot = makeCarrot()
        carrot.scale.setScalar(0.09)
        carrot.rotation.set(Math.PI / 2, 0, k * 1.2 + 0.4)
        carrot.position.set(k * 0.05 - 0.02, 0.012, k * 0.03)
        spill.add(carrot)
      }
      const puff = sprite(puffTexture, 0.25, { opacity: 0.7 })
      puff.position.y = 0.08
      spill.add(puff)
      spill.userData.puff = puff
      spill.userData.t = 0
      entry.group.add(spill)
      entry.spills.push(spill)
    })
  }

  sendCourier(goal) {
    if (this.couriers.length >= 2) return
    const route = routeFrom(this.board, this.counts, this.board.source, goal)
    if (!route || route.length < 2) return
    const bunny = new Bunny({ coat: COAT_NAMES[(goal * 7) % COAT_NAMES.length], accessory: 'scarf', seed: 1000 + goal })
    bunny.root.scale.setScalar(BUNNY_SCALE * 0.85)
    const start = this.burrowPosition(route[0])
    const grandma = this.burrows[route[0]]
    bunny.root.position.copy(start).add(new THREE.Vector3(0, 0, grandma.radius + 0.08))
    bunny.setMood('content')
    const basket = makeBasket()
    basket.scale.setScalar(0.42)
    basket.position.set(0, 0.18, 0.5)
    basket.userData.carrots.visible = true
    basket.userData.carrots.scale.setScalar(1)
    bunny.torso.add(basket)
    bunny.paws.forEach((paw) => (paw.rotation.x = -1.1))
    this.world.add(bunny.root)
    const courier = { bunny, goal, route, cancel: false, done: false }
    this.couriers.push(courier)
    this.walkRoute(courier)
  }

  async walkRoute(courier) {
    const { bunny, route } = courier
    const waypoints = []
    for (let i = 1; i < route.length; i++) {
      const a = this.burrowPosition(route[i - 1])
      const b = this.burrowPosition(route[i])
      const dir = b.clone().sub(a).normalize()
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.0)
      const from = a.clone().addScaledVector(dir, this.burrows[route[i - 1]].radius + 0.1).add(side)
      const to = b.clone().addScaledVector(dir, -(this.burrows[route[i]].radius + 0.12)).add(side)
      waypoints.push(from, to)
    }
    for (const point of waypoints) {
      const distance = bunny.root.position.distanceTo(point)
      const hops = Math.max(1, Math.round(distance / 0.26))
      const start = bunny.root.position.clone()
      await bunny.face(Math.atan2(point.x - start.x, point.z - start.z), 0.12)
      for (let h = 1; h <= hops; h++) {
        if (courier.cancel) break
        await bunny.hop(start.clone().lerp(point, h / hops), { height: 0.07, duration: 0.34 })
      }
      if (courier.cancel) break
    }
    if (!courier.cancel) {
      await bunny.face(0, 0.2)
      await bunny.binky({ height: 0.12, duration: 0.6 })
      await bunny.wave(0.8)
    }
    courier.leaving = 0
  }

  /* ---------- hints, selection, feedback ---------- */

  select(burrowIndex, candidates = []) {
    this.selected = burrowIndex
    this.candidates = candidates
  }

  showHint(edgeIndex) {
    if (edgeIndex === null || edgeIndex === undefined) {
      this.hint = null
      return
    }
    const [a, b] = this.edgeEnds(edgeIndex)
    const e = this.board.edges[edgeIndex]
    const length = a.distanceTo(b)
    this.hintMarker.position.copy(a).add(b).multiplyScalar(0.5)
    this.hintMarker.position.y = 0.03
    this.hintMarker.scale.set(length, 1, 1)
    this.hintMarker.rotation.y = e.horizontal ? 0 : Math.PI / 2
    this.hint = { edgeIndex, t: 0 }
  }

  showGhost(edgeIndex) {
    if (edgeIndex === null || edgeIndex === undefined) {
      this.ghost.visible = false
      return
    }
    const [a, b, ra, rb] = this.edgeEnds(edgeIndex)
    const e = this.board.edges[edgeIndex]
    const dir = b.clone().sub(a).normalize()
    const start = a.clone().addScaledVector(dir, ra)
    const end = b.clone().addScaledVector(dir, -rb)
    this.ghost.visible = true
    this.ghost.position.copy(start).add(end).multiplyScalar(0.5)
    this.ghost.position.y = 0.04
    this.ghost.scale.set(start.distanceTo(end), 1, 1)
    this.ghost.rotation.y = e.horizontal ? 0 : Math.PI / 2
  }

  // A path that can't be laid: the blocking path gives a little wobble.
  blocked(edgeIndex, blocker) {
    const path = this.paths[blocker]
    if (path) path.wobble = 1
    const e = this.board.edges[edgeIndex]
    for (const i of [e.a, e.b]) this.burrows[i].bunny.fret()
  }

  closedGroups(groups) {
    this.closed = new Set(groups.flat())
  }

  celebrate() {
    const source = this.board.source
    const fed = this.fedBefore ?? new Map()
    this.burrows.forEach((entry, i) => {
      const delay = (fed.get(i) ?? 0) * 0.22
      setTimeout(() => {
        entry.bunny.binky({ height: 0.7, duration: 0.75 }).then(() => entry.bunny.binky({ height: 0.45, duration: 0.6 }))
        this.burst(this.burrowPosition(i).add(new THREE.Vector3(0, 0.45, 0)), 6)
      }, delay * 1000)
    })
    this.burrows[source].bunny.wave(1.4)
  }

  burst(position, count = 8) {
    for (let i = 0; i < count; i++) {
      const heart = sprite(heartTexture, 0.07 + Math.random() * 0.05)
      heart.position.copy(position)
      this.world.add(heart)
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.9 + Math.random() * 0.6, (Math.random() - 0.5) * 0.9)
      this.effects.push({ object: heart, velocity, life: 1.4 + Math.random() * 0.5, age: 0 })
    }
  }

  /* ---------- input ---------- */

  bindInput() {
    const el = this.renderer.domElement
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', (event) => {
      const hit = this.pick(event)
      if (!hit) return
      el.setPointerCapture(event.pointerId)
      this.pointer = { id: event.pointerId, start: hit, startX: event.clientX, startY: event.clientY, burrow: this.burrowAt(hit), edge: null, moved: false }
    })
    el.addEventListener('pointermove', (event) => {
      const p = this.pointer
      if (!p || p.id !== event.pointerId) return
      const hit = this.pick(event)
      if (!hit) return
      if (Math.hypot(event.clientX - p.startX, event.clientY - p.startY) > 10) p.moved = true
      if (p.burrow === null || !p.moved) return
      const origin = this.burrowPosition(p.burrow)
      const dx = hit.x - origin.x
      const dz = hit.z - origin.z
      const reach = Math.hypot(dx, dz)
      let dir = null
      if (reach > 0.35) dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : dz > 0 ? 'down' : 'up'
      const edge = dir ? this.board.neighbors[p.burrow][dir] ?? null : null
      p.edge = edge
      this.showGhost(edge)
    })
    const finish = (event) => {
      const p = this.pointer
      if (!p || p.id !== event.pointerId) return
      this.pointer = null
      this.showGhost(null)
      if (p.moved && p.burrow !== null) {
        if (p.edge !== null) this.onDragEdge(p.edge)
        return
      }
      if (p.moved) return
      if (p.burrow !== null) return this.onTapBurrow(p.burrow)
      const edge = this.edgeAt(p.start)
      if (edge !== null) return this.onTapEdge(edge)
      this.onTapEmpty()
    }
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', (event) => {
      this.pointer = null
      this.showGhost(null)
      void event
    })
  }

  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    // Aim at mound height so taps on a mound's face count.
    this.ground.constant = -0.1
    const point = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(this.ground, point) ? point : null
  }

  burrowAt(point) {
    let best = null
    let bestDistance = Infinity
    this.burrows.forEach((entry, i) => {
      const p = this.burrowPosition(i)
      const d = Math.hypot(point.x - p.x, point.z - p.z)
      if (d < entry.radius + 0.14 && d < bestDistance) {
        best = i
        bestDistance = d
      }
    })
    return best
  }

  edgeAt(point) {
    let best = null
    let bestDistance = 0.28
    for (const e of this.board.edges) {
      const a = this.burrowPosition(e.a)
      const b = this.burrowPosition(e.b)
      const inside = e.horizontal ? point.x > Math.min(a.x, b.x) && point.x < Math.max(a.x, b.x) : point.z > Math.min(a.z, b.z) && point.z < Math.max(a.z, b.z)
      if (!inside) continue
      const d = e.horizontal ? Math.abs(point.z - a.z) : Math.abs(point.x - a.x)
      if (d < bestDistance) {
        best = e.index
        bestDistance = d
      }
    }
    return best
  }

  // Screen position of a burrow, for labels.
  project(index, height = 0.45) {
    const p = this.burrowPosition(index)
    p.y = height
    p.project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: (p.x + 1) / 2 * rect.width, y: (1 - p.y) / 2 * rect.height }
  }

  /* ---------- framing ---------- */

  resize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.renderer.domElement.style.width = `${width}px`
    this.renderer.domElement.style.height = `${height}px`
    const target = new THREE.Vector3(0, 0, 0)
    this.camera.position.set(0, Math.sin(ELEVATION) * 30, Math.cos(ELEVATION) * 30)
    this.camera.lookAt(target)
    this.camera.updateMatrixWorld()
    if (!this.board) return
    // Fit the whole tray, mounds and trees included, into the space the interface leaves.
    const w = this.trayWidth / 2
    const d = this.trayDepth / 2
    const view = this.camera.matrixWorldInverse
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const x of [-w, w]) for (const z of [-d, d]) for (const y of [-0.9, 0.75]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(view)
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    }
    const safe = this.safeArea?.() ?? { top: 0, bottom: 0, left: 0, right: 0 }
    const availableW = Math.max(100, width - safe.left - safe.right)
    const availableH = Math.max(100, height - safe.top - safe.bottom)
    const scale = Math.min(availableW / (maxX - minX), availableH / (maxY - minY))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const offsetX = (safe.left - safe.right) / 2 / scale
    const offsetY = (safe.bottom - safe.top) / 2 / scale
    this.camera.left = centerX - width / 2 / scale - offsetX
    this.camera.right = centerX + width / 2 / scale - offsetX
    this.camera.top = centerY + height / 2 / scale - offsetY
    this.camera.bottom = centerY - height / 2 / scale - offsetY
    this.camera.updateProjectionMatrix()
    this.pixelsPerUnit = scale
  }

  /* ---------- animation ---------- */

  frame(now) {
    const minGap = this.mobile ? 1000 / 40 : 1000 / 60
    if (now - this.lastFrame < minGap - 1) return
    const dt = Math.min(0.05, (now - (this.lastFrame || now)) / 1000)
    this.lastFrame = now
    if (document.hidden || !this.board) return
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  // Advance every animation by dt seconds; exposed so tests can step the scene.
  update(dt) {
    this.time += dt
    const t = this.time

    // Intro: the warren pops up burrow by burrow.
    if (this.intro < 1) this.intro = Math.min(1, this.intro + dt / 1.2)
    this.burrows.forEach((entry, i) => {
      const local = clamp(this.intro * 2.2 - i * (1.2 / this.burrows.length), 0, 1)
      const s = local >= 1 ? 1 : easeOutBack(local)
      entry.group.scale.setScalar(Math.max(0.001, s))
    })

    for (const entry of this.burrows) {
      // door swings open when the carrots arrive
      if (entry.doorDelay > 0) entry.doorDelay -= dt
      else entry.door.open = THREE.MathUtils.damp(entry.door.open, entry.doorTarget ?? 0, 6, dt)
      entry.door.hinge.rotation.y = -entry.door.open * 1.9
      entry.door.glow.material.opacity = entry.door.open * 0.6
      entry.door.inside.material = entry.door.open > 0.05 ? M.glow : M.dark
      // a little shake when a burrow has too many paths
      if (entry.shake > 0) {
        entry.shake = Math.max(0, entry.shake - dt * 2)
        entry.bob.rotation.z = Math.sin(t * 40) * 0.05 * entry.shake
      }
      // selection ring
      const selected = this.selected === entry.burrow.index
      const candidate = this.candidates?.includes(entry.burrow.index)
      const targetOpacity = selected ? 0.75 + Math.sin(t * 5) * 0.2 : candidate ? 0.35 + Math.sin(t * 5) * 0.12 : 0
      entry.selection.material.opacity = THREE.MathUtils.damp(entry.selection.material.opacity, targetOpacity, 10, dt)
      entry.selection.scale.setScalar(selected ? 1 + Math.sin(t * 5) * 0.03 : 1)
      // baskets hop between the mound top and the path mouths
      for (const basket of entry.baskets) {
        if (basket.t < 1) {
          basket.t = Math.min(1, basket.t + dt / 0.38)
          const k = smooth(basket.t)
          basket.object.position.lerpVectors(basket.from, basket.to, k)
          basket.object.position.y += bump(basket.t) * 0.16
          basket.object.rotation.y = bump(basket.t) * 0.8
        } else basket.object.position.copy(basket.to)
        const carrots = basket.object.userData.carrots
        if (basket.filled) {
          if (basket.fillDelay > 0) basket.fillDelay -= dt
          else basket.fill = Math.min(1, basket.fill + dt / 0.35)
        } else basket.fill = Math.max(0, basket.fill - dt / 0.2)
        carrots.visible = basket.fill > 0.001
        carrots.scale.setScalar(Math.max(0.001, basket.fill >= 1 ? 1 : easeOutBack(basket.fill)))
      }
      for (const spill of entry.spills) {
        spill.userData.t += dt
        spill.userData.puff.material.opacity = Math.max(0, 0.7 - spill.userData.t * 1.2)
        spill.userData.puff.scale.setScalar(0.18 + spill.userData.t * 0.3)
      }
      // Grandma's chimney smoke
      if (entry.chimney) {
        entry.smokeTimer -= dt
        if (entry.smokeTimer < 0) {
          entry.smokeTimer = 0.55 + Math.random() * 0.4
          const puff = sprite(puffTexture, 0.08, { opacity: 0.75 })
          const p = new THREE.Vector3()
          entry.chimney.getWorldPosition(p)
          puff.position.copy(this.world.worldToLocal(p)).add(new THREE.Vector3(0, 0.18, 0))
          this.world.add(puff)
          this.effects.push({ object: puff, velocity: new THREE.Vector3(0.05 + Math.random() * 0.04, 0.22, -0.02), life: 2.6, age: 0, grow: 0.12, fade: 0.75 })
        }
      }
      // gentle idle look toward the nearest happening
      entry.bunny.update(dt)
    }

    // paths: stones pop in one after another, and sink away when removed
    for (const path of this.paths) {
      if (!path) continue
      for (const lane of path.lanes) {
        if (lane.t < 1) lane.t = Math.min(1, lane.t + dt / 0.45)
        const k = lane.active ? lane.t : 1 - lane.t
        lane.group.visible = k > 0.001
        if (!lane.group.visible) continue
        lane.strip.scale.set(Math.max(0.001, clamp(k * 1.4, 0, 1)), 1, 1)
        lane.stones.forEach((stone, i) => {
          const local = clamp(k * 1.6 - (i / lane.stones.length) * 0.6, 0, 1)
          const s = local >= 1 ? 1 : easeOutBack(local)
          stone.scale.copy(stone.userData.scale).multiplyScalar(Math.max(0.001, s))
        })
        lane.blooms.forEach((bloom, i) => bloom.scale.setScalar(Math.max(0.001, clamp(k * 1.5 - i * 0.1, 0, 1))))
      }
      if (path.wobble > 0) {
        path.wobble = Math.max(0, path.wobble - dt * 2)
        path.group.position.y = Math.abs(Math.sin(t * 30)) * 0.03 * path.wobble
      }
    }

    // hint glow
    if (this.hint) {
      this.hint.t += dt
      this.hintMarker.visible = true
      this.hintMarker.material.opacity = 0.35 + Math.sin(this.hint.t * 5) * 0.25
    } else this.hintMarker.visible = false

    // couriers
    for (const courier of this.couriers) {
      courier.bunny.update(dt)
      if (courier.cancel || courier.leaving !== undefined) {
        courier.leaving = (courier.leaving ?? 0) + dt
        const s = Math.max(0.001, 1 - courier.leaving / 0.4)
        courier.bunny.root.scale.setScalar(BUNNY_SCALE * 0.85 * s)
        if (s <= 0.001) {
          courier.done = true
          this.world.remove(courier.bunny.root)
        }
      }
    }
    this.couriers = this.couriers.filter((c) => !c.done)

    // floating effects: smoke, hearts
    for (const effect of this.effects) {
      effect.age += dt
      effect.object.position.addScaledVector(effect.velocity, dt)
      if (!effect.grow) effect.velocity.y -= dt * 1.2
      if (effect.grow) effect.object.scale.setScalar(effect.object.scale.x + effect.grow * dt)
      const remaining = 1 - effect.age / effect.life
      effect.object.material.opacity = Math.max(0, remaining) * (effect.fade ?? 1)
      if (effect.age >= effect.life) this.world.remove(effect.object)
    }
    this.effects = this.effects.filter((e) => e.age < e.life)
  }
}

export { otherEnd }
