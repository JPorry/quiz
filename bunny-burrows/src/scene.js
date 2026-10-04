import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Bunny, lookFor, seedLooks, randomFur, makeCarrotMesh, toon } from './bunny.js'

// The warren is a slab of soil seen from the front, like an ant farm: rooms and
// tunnels are carved into its face, the meadow and carrot patch sit on top.
// Holes in the face are cut with the stencil buffer, so tunnels can open up live
// while the player digs.

export const R = 0.6 // room radius
const CX = 1 // column spacing
const TOP = 0.95 // from the grass line down to the first row
const TILT = 15 * Math.PI / 180
const LANE = { 1: [[0, 0.2]], 2: [[-0.15, 0.13], [0.15, 0.13]] } // [offset, radius]
const HOLE_REF = 1

const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp
const rugColors = [0xff9fb8, 0x9fd8ff, 0xc9b6ff, 0xffe07a, 0xa8e6a1]

// Where everyone sits: parents at the back, little ones in front. [x, depth, size, baby]
const LAYOUTS = {
  1: [[0, 0.25, 1, 0]],
  2: [[-0.27, 0.3, 0.82, 0], [0.27, 0.3, 0.82, 0]],
  3: [[-0.28, 0.55, 0.74, 0], [0.28, 0.55, 0.74, 0], [0, 0.12, 0.62, 1]],
  4: [[-0.3, 0.58, 0.7, 0], [0.3, 0.58, 0.7, 0], [-0.19, 0.12, 0.58, 1], [0.19, 0.12, 0.58, 1]],
  5: [[-0.28, 0.6, 0.68, 0], [0.28, 0.6, 0.68, 0], [-0.36, 0.12, 0.54, 1], [0, 0.08, 0.54, 1], [0.36, 0.12, 0.54, 1]],
  6: [[-0.38, 0.6, 0.62, 0], [0, 0.66, 0.62, 0], [0.38, 0.6, 0.62, 0], [-0.36, 0.12, 0.52, 1], [0, 0.08, 0.52, 1], [0.36, 0.12, 0.52, 1]],
  7: [[-0.38, 0.6, 0.6, 0], [0, 0.66, 0.6, 0], [0.38, 0.6, 0.6, 0], [-0.44, 0.14, 0.48, 1], [-0.15, 0.08, 0.48, 1], [0.15, 0.08, 0.48, 1], [0.44, 0.14, 0.48, 1]],
  8: [[-0.45, 0.58, 0.56, 0], [-0.15, 0.66, 0.56, 0], [0.15, 0.66, 0.56, 0], [0.45, 0.58, 0.56, 0], [-0.44, 0.14, 0.48, 1], [-0.15, 0.08, 0.48, 1], [0.15, 0.08, 0.48, 1], [0.44, 0.14, 0.48, 1]],
}

function holeMaterial() {
  return new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false,
    stencilWrite: true, stencilRef: HOLE_REF, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
  })
}
const HOLE = holeMaterial()
const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra })

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
const glowTexture = canvasTexture(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,236,170,0.95)')
  r.addColorStop(0.45, 'rgba(255,205,110,0.35)')
  r.addColorStop(1, 'rgba(255,190,90,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
})
const zTexture = canvasTexture(64, 64, (g) => {
  g.font = '600 40px Fredoka, Nunito, sans-serif'
  g.fillStyle = '#fff6e8'
  g.fillText('z', 8, 50)
  g.font = '600 26px Fredoka, Nunito, sans-serif'
  g.fillText('z', 36, 26)
})
const heartTexture = canvasTexture(64, 64, (g) => {
  g.fillStyle = '#ff7fa0'
  g.beginPath()
  g.moveTo(32, 56)
  g.bezierCurveTo(2, 36, 6, 8, 22, 8)
  g.bezierCurveTo(28, 8, 32, 14, 32, 18)
  g.bezierCurveTo(32, 14, 36, 8, 42, 8)
  g.bezierCurveTo(58, 8, 62, 36, 32, 56)
  g.fill()
})
const sprite = (map, size, extra = {}) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, ...extra }))
  s.scale.setScalar(size)
  return s
}

/* ---------- a carved lane: one tunnel, live-resizable ---------- */

// only the back half of each tube is drawn: the front is open to the viewer
const UNIT_TUBE = new THREE.CylinderGeometry(1, 1, 1, 22, 1, true, Math.PI / 2, Math.PI).rotateZ(Math.PI / 2)
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1)
const UNIT_RIM = new THREE.CylinderGeometry(1, 1, 1, 8).rotateZ(Math.PI / 2)
class Lane {
  constructor(parent, radius, { fresh = false } = {}) {
    this.group = new THREE.Group()
    parent.add(this.group)
    this.radius = radius
    this.wall = lambert(fresh ? 0xf2cf9c : 0xd9a06a, { side: THREE.BackSide })
    this.tube = new THREE.Mesh(UNIT_TUBE, this.wall)
    this.tube.receiveShadow = true
    this.mask = new THREE.Mesh(UNIT_PLANE, HOLE)
    this.mask.renderOrder = -10
    this.rimMat = lambert(0xc48a58)
    this.rims = [0, 1].map(() => new THREE.Mesh(UNIT_RIM, this.rimMat))
    this.group.add(this.tube, this.mask, ...this.rims)
    this.lights = null
  }

  // from a to b (Vector2 on the face), horizontal or vertical
  span(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.max(0.001, Math.hypot(dx, dy))
    const angle = Math.atan2(dy, dx)
    this.group.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0)
    this.base = this.group.position.clone()
    this.group.rotation.z = angle
    const r = this.radius
    this.tube.scale.set(len, r, r)
    this.mask.scale.set(len, r * 2, 1)
    this.mask.position.z = 0.001
    this.rims.forEach((rim, k) => {
      rim.scale.set(len, 0.035, 0.035)
      rim.position.set(0, (k ? 1 : -1) * r, 0.0)
    })
    this.length = len
  }

  setLit(lit) {
    if (lit && !this.lights) {
      const n = Math.max(2, Math.floor(this.length / 0.17))
      const geo = new THREE.SphereGeometry(0.028, 8, 6)
      const colors = [0xffd34d, 0xff9fb8, 0x9fd8ff, 0xb8f0a8]
      this.lights = new THREE.Group()
      for (let i = 1; i < n; i++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % 4] }))
        const x = -this.length / 2 + (i / n) * this.length
        m.position.set(x, this.radius * 0.72, -this.radius * 0.55)
        const glow = sprite(glowTexture, 0.16, { blending: THREE.AdditiveBlending, opacity: 0.7 })
        glow.position.copy(m.position)
        this.lights.add(m, glow)
      }
      this.group.add(this.lights)
    }
    if (this.lights) this.lights.visible = lit
    this.wall.color.setHex(lit ? 0xeab884 : 0xd9a06a)
  }

  dispose() {
    this.group.removeFromParent()
  }
}

/* ---------- the scene ---------- */

export class WarrenScene {
  constructor(container) {
    this.container = container
    this.mobile = matchMedia('(pointer: coarse)').matches
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true, preserveDrawingBuffer: new URLSearchParams(location.search).has('capture') })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 2 : 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    container.append(this.renderer.domElement)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200)
    this.scene.add(new THREE.HemisphereLight(0xfff4e2, 0xb98a60, 1.55))
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.7)
    sun.position.set(-4, 7, 9)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0008
    sun.shadow.normalBias = 0.02
    sun.shadow.radius = 3
    this.scene.add(sun, sun.target)
    this.sun = sun
    this.world = new THREE.Group()
    this.scene.add(this.world)
    this.time = 0
    this.fx = []
    this.carrots = []
    this.ray = new THREE.Raycaster()
    this.face = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    new ResizeObserver(() => this.resize()).observe(container)
  }

  /* ---------- building a level ---------- */

  load(board, { seed = 1 } = {}) {
    this.world.clear()
    this.fx = []
    this.carrots = []
    this.board = board
    const { width, height } = board.level
    this.width = width
    this.height = height
    // rows stretch to fill tall phone screens
    const box = this.container.getBoundingClientRect()
    const aspect = box.width ? box.height / box.width : 1.6
    this.left = -width * CX / 2 + 0.5 - R - 0.32
    this.right = width * CX / 2 - 0.5 + R + 0.32
    // stretch the rows so the warren fills the screen's height
    const room = (this.right - this.left) * aspect / Math.cos(TILT) - TOP - R - 0.5 - 1.0
    this.CY = height > 1 ? clamp(room / (height - 1), 1.3, 2.2) : 1.6
    this.bottom = -(TOP + (height - 1) * this.CY + R + 0.5)
    seedLooks(seed)
    this.buildSoil()
    this.buildMeadow()
    this.rooms = board.burrows.map((b) => this.buildRoom(b))
    this.lanes = board.edges.map(() => [])
    this.counts = board.edges.map(() => 0)
    // the shaft from the carrot patch down into the pantry room
    const s = this.pos(board.source)
    const shaft = new Lane(this.world, 0.2)
    shaft.span(new THREE.Vector2(s.x, 0.2), new THREE.Vector2(s.x, s.y + R - 0.1))
    shaft.setLit(true)
    this.preview = null
    const reach = Math.max(this.right - this.left, -this.bottom) + 2
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: 60 })
    this.sun.shadow.camera.updateProjectionMatrix()
    this.sun.target.position.set(0, this.bottom / 2, 0)
    this.resize()
  }

  pos(i) {
    const b = this.board.burrows[i]
    return new THREE.Vector3((b.column + 0.5) * CX - this.width * CX / 2, -(TOP + b.row * this.CY), 0)
  }

  buildSoil() {
    const w = this.right - this.left + 4, h = -this.bottom + 3
    // the front face, painted with soil layers and pebbles; holes are cut by the stencil
    const tex = canvasTexture(1024, Math.round(1024 * h / w), (g, W, H) => {
      const grd = g.createLinearGradient(0, 0, 0, H)
      grd.addColorStop(0, '#c48b5a')
      grd.addColorStop(0.5, '#b07548')
      grd.addColorStop(1, '#8f5a35')
      g.fillStyle = grd
      g.fillRect(0, 0, W, H)
      let seed = 7
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (let k = 0; k < 7; k++) {
        const y = (k + 0.5) * H / 7
        g.fillStyle = k % 2 ? 'rgba(120,70,35,.16)' : 'rgba(230,190,140,.14)'
        g.beginPath()
        g.moveTo(0, y)
        for (let x = 0; x <= W; x += W / 12) g.quadraticCurveTo(x + W / 24, y + (r() - 0.5) * 28, x + W / 12, y)
        g.lineTo(W, y + 40)
        g.lineTo(0, y + 40)
        g.fill()
      }
      for (let i = 0; i < 380; i++) {
        const x = r() * W, y = r() * H, s = 2 + r() * 7
        g.fillStyle = ['#d9aa7c', '#8a5532', '#e6c39c', '#a46a40'][i % 4]
        g.globalAlpha = 0.65
        g.beginPath()
        g.ellipse(x, y, s, s * 0.7, r() * 3, 0, Math.PI * 2)
        g.fill()
        if (i % 3 === 0) {
          g.fillStyle = '#fff'
          g.globalAlpha = 0.25
          g.beginPath()
          g.ellipse(x - s * 0.3, y - s * 0.3, s * 0.35, s * 0.2, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
      g.globalAlpha = 1
    })
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({
      map: tex,
      stencilWrite: true, stencilRef: HOLE_REF, stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
    }))
    face.position.set((this.left + this.right) / 2, -h / 2 + 0.05, 0)
    face.receiveShadow = true
    face.renderOrder = 0
    this.world.add(face)
    this.faceMesh = face
    // a few roots dangling from the meadow, and pebbles half-buried in the face
    const rootMat = lambert(0x8a5a36)
    for (let i = 0; i < this.width; i++) {
      const x = this.left + 0.4 + ((i + 0.5) / this.width) * (this.right - this.left - 0.8) + Math.sin(i * 7) * 0.2
      if (this.board.burrows.some((b) => b.row === 0 && Math.abs(this.pos(b.index).x - x) < R + 0.15)) continue
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0, 0.02), new THREE.Vector3(x + 0.08, -0.25, 0.03), new THREE.Vector3(x - 0.05, -0.45, 0.02), new THREE.Vector3(x + 0.04, -0.62, 0.02)])
      const root = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.018, 6), rootMat)
      this.world.add(root)
    }
  }

  buildMeadow() {
    const w = this.right - this.left + 4
    const grass = new THREE.Mesh(new RoundedBoxGeometry(w, 0.24, 2.2, 3, 0.08), lambert(0x8fd677))
    grass.position.set((this.left + this.right) / 2, 0.1, -1.08)
    grass.receiveShadow = true
    this.world.add(grass)
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, w, 10).rotateZ(Math.PI / 2), lambert(0x7cc566))
    lip.position.set((this.left + this.right) / 2, 0.0, 0.02)
    this.world.add(lip)
    // tufts and flowers along the meadow
    const tuft = new THREE.ConeGeometry(0.025, 0.12, 5)
    const tuftMat = lambert(0x6fbf5c)
    const flowerColors = [0xff9fb8, 0xffffff, 0xffe07a, 0xc9b6ff]
    let seed = 3
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < w * 9; i++) {
      const x = this.left - 1.5 + r() * (w - 1), z = -0.1 - r() * 1.6
      const m = new THREE.Mesh(tuft, tuftMat)
      m.position.set(x, 0.27, z)
      m.rotation.z = (r() - 0.5) * 0.5
      this.world.add(m)
      if (i % 4 === 0) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lambert(flowerColors[i % 4]))
        f.position.set(x + 0.05, 0.31, z)
        f.castShadow = true
        this.world.add(f)
      }
    }
    // the carrot patch above the source room
    const s = this.pos(this.board.source)
    const patch = new THREE.Group()
    patch.position.set(s.x, 0.22, -0.55)
    this.world.add(patch)
    const bed = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.16, 0.7, 3, 0.05), lambert(0xa8713f))
    bed.castShadow = true
    patch.add(bed)
    const soil = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.08, 0.58, 2, 0.03), lambert(0x7a4a28))
    soil.position.y = 0.06
    patch.add(soil)
    const leaf = new THREE.ConeGeometry(0.03, 0.22, 6)
    for (let i = 0; i < 6; i++) {
      const cx = -0.4 + (i % 3) * 0.4 + (i > 2 ? 0.2 : 0), cz = i > 2 ? 0.14 : -0.12
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xff9437))
      top.position.set(cx, 0.09, cz)
      top.scale.y = 0.7
      patch.add(top)
      for (const a of [-0.45, 0, 0.45]) {
        const l = new THREE.Mesh(leaf, toon(0x55b45a))
        l.position.set(cx + Math.sin(a) * 0.05, 0.22, cz)
        l.rotation.z = a
        l.castShadow = true
        patch.add(l)
      }
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), lambert(0x8a5a36))
    post.position.set(0.5, 0.18, -0.36)
    patch.add(post)
    const sign = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.22, 0.04, 2, 0.02), lambert(0xfff6e8))
    sign.position.set(0.5, 0.42, -0.33)
    patch.add(sign)
    const icon = makeCarrotMesh()
    icon.scale.setScalar(0.32)
    icon.rotation.z = -0.9
    icon.position.set(0.5, 0.42, -0.29)
    patch.add(icon)
  }

  buildRoom(b) {
    const p = this.pos(b.index)
    const group = new THREE.Group()
    group.position.copy(p)
    this.world.add(group)
    const inner = new THREE.Group()
    group.add(inner)
    // the cavity: the back of a sphere, warmly lit when the carrots arrive
    const wall = lambert(0xb98457, { side: THREE.BackSide })
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28, Math.PI, Math.PI), wall)
    cavity.scale.z = 0.95
    cavity.receiveShadow = true
    inner.add(cavity)
    const mask = new THREE.Mesh(new THREE.CircleGeometry(R, 48), HOLE)
    mask.position.z = 0.001
    mask.renderOrder = -10
    group.add(mask)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.045, 10, 48), lambert(0xc48a58))
    inner.add(rim)
    // a flat floor with a little rug
    const fy = -R * 0.55
    const fr = Math.sqrt(R * R - fy * fy)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(fr, 40, 0, Math.PI).rotateX(-Math.PI / 2), lambert(0xf0cc98))
    floor.position.y = fy
    floor.receiveShadow = true
    inner.add(floor)
    // the floor's thick front edge fills the bowl below it
    const edge = new THREE.Shape()
    const a0 = Math.asin(fy / R)
    edge.moveTo(-fr, fy)
    edge.absarc(0, 0, R, Math.PI - a0, Math.PI * 2 + a0, false)
    edge.lineTo(-fr, fy)
    const skirt = new THREE.Mesh(new THREE.ShapeGeometry(edge, 24), lambert(0xd7a06c))
    skirt.position.z = -0.004
    skirt.receiveShadow = true
    inner.add(skirt)
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, fr * 2, 8).rotateZ(Math.PI / 2), lambert(0xf5d6a8))
    lip.position.set(0, fy - 0.005, 0)
    inner.add(lip)
    const rug = new THREE.Mesh(new THREE.CircleGeometry(fr * 0.7, 32, 0, Math.PI).rotateX(-Math.PI / 2), lambert(rugColors[b.index % rugColors.length]))
    rug.position.set(0, fy + 0.006, -0.02)
    rug.scale.z = 0.8
    rug.receiveShadow = true
    inner.add(rug)
    // a hanging lamp
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0xffb02e, emissiveIntensity: 0.15 })
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.09, 14, 1, true), lampMat)
    lamp.position.set(0, R * 0.62, -R * 0.45)
    inner.add(lamp)
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), lambert(0x5e3a20))
    cord.position.set(0, R * 0.62 + 0.11, -R * 0.45)
    inner.add(cord)
    const glow = sprite(glowTexture, 0.6, { blending: THREE.AdditiveBlending, opacity: 0 })
    glow.position.set(0, R * 0.6, -R * 0.5)
    inner.add(glow)
    // the family: one bunny for every tunnel this room needs
    const layout = LAYOUTS[Math.min(8, b.value)]
    const parents = [randomFur(), randomFur()]
    const family = new THREE.Group()
    inner.add(family)
    // bigger families: the grown-ups sit up on a cushioned bench at the back
    const bench = b.value > 2
    if (bench) {
      const seat = new THREE.Mesh(new RoundedBoxGeometry(fr * 1.7, R * 0.2, R * 0.42, 3, 0.05), lambert(0xd98f6a))
      seat.position.set(0, fy + R * 0.1, -R * 0.6)
      seat.castShadow = seat.receiveShadow = true
      inner.add(seat)
      const cushion = new THREE.Mesh(new RoundedBoxGeometry(fr * 1.6, R * 0.07, R * 0.36, 3, 0.03), lambert(rugColors[(b.index + 2) % rugColors.length]))
      cushion.position.set(0, fy + R * 0.23, -R * 0.58)
      cushion.receiveShadow = true
      inner.add(cushion)
    }
    const bunnies = layout.map(([x, depth, size, baby]) => {
      const bunny = new Bunny(lookFor(!!baby, b.value > 2 ? parents : null))
      bunny.root.position.set(x * R, fy + (bench && !baby ? R * 0.2 : 0), -depth * R)
      bunny.root.scale.setScalar(size * R * 0.92)
      bunny.root.rotation.y = -x * 0.35
      family.add(bunny.root)
      return bunny
    })
    const z = sprite(zTexture, 0.32)
    z.position.set(R * 0.55, R * 0.45, 0.1)
    group.add(z)
    // carrots that do not fit spill on the floor
    const spill = new THREE.Group()
    inner.add(spill)
    return { b, group, inner, wall, lamp: lampMat, glow, bunnies, family, z, spill, lit: 0, litTarget: 0, bounce: -1, worried: false }
  }

  /* ---------- state ---------- */

  // counts per possible path, and which tunnels have carrots flowing
  setTunnels(counts, litEdges) {
    this.board.edges.forEach((e, i) => {
      const want = counts[i]
      if (this.lanes[i].length !== want) {
        this.lanes[i].forEach((l) => l.dispose())
        this.lanes[i] = (LANE[want] ?? []).map(([offset, radius]) => {
          const lane = new Lane(this.world, radius)
          const [a, b] = this.laneEnds(i, offset)
          lane.span(a, b)
          return lane
        })
      }
      this.lanes[i].forEach((l) => l.setLit(litEdges.has(i)))
    })
    this.counts = counts.slice()
  }

  laneEnds(edgeIndex, offset = 0, fromRoom = null) {
    const e = this.board.edges[edgeIndex]
    let a = this.pos(e.a), b = this.pos(e.b)
    if (fromRoom === e.b) [a, b] = [b, a]
    const dir = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize()
    const side = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(offset)
    const inset = R - 0.12
    return [
      new THREE.Vector2(a.x + dir.x * inset + side.x, a.y + dir.y * inset + side.y),
      new THREE.Vector2(b.x - dir.x * inset + side.x, b.y - dir.y * inset + side.y),
    ]
  }

  // per room: { states: ['sleep'|'wait'|'fed'...], lit, worried, spill }
  setRooms(rooms) {
    rooms.forEach((r, i) => {
      const room = this.rooms[i]
      room.bunnies.forEach((bunny, k) => bunny.setState(r.states[k]))
      room.litTarget = r.lit ? 1 : 0
      room.worried = r.worried
      room.z.visible = r.states.includes('sleep')
      if (room.spill.children.length !== r.spill) {
        room.spill.clear()
        for (let k = 0; k < r.spill; k++) {
          const c = makeCarrotMesh()
          c.scale.setScalar(0.42)
          c.rotation.set(Math.PI / 2, 0, 0.8 + k)
          c.position.set(-R * 0.5 + k * 0.14, -R * 0.52, -0.05)
          room.spill.add(c)
        }
      }
    })
  }

  bounce(i, amount = 1) {
    const room = this.rooms[i]
    room.bounce = 0
    room.bounceAmount = amount
  }

  hop(i) {
    for (const bunny of this.rooms[i].bunnies) bunny.hop(0.3 + Math.random() * 0.1)
  }

  sendCarrot(route, onArrive) {
    const carrot = makeCarrotMesh()
    carrot.scale.setScalar(0.5)
    this.world.add(carrot)
    this.carrots.push({ mesh: carrot, route, t: 0, onArrive })
  }

  /* ---------- digging preview ---------- */

  setPreview(p) {
    if (!p) {
      if (this.preview) { this.preview.lane?.dispose(); this.preview.paw?.removeFromParent() }
      this.preview = null
      return
    }
    if (!this.preview || this.preview.key !== `${p.edge}-${p.from}-${p.lane}`) {
      this.setPreview(null)
      const [offset, radius] = p.lane
      const lane = new Lane(this.world, radius, { fresh: true })
      const paw = new THREE.Group()
      const pawMat = toon(0xfff6ee)
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), pawMat)
      pad.scale.set(1, 1.1, 0.7)
      paw.add(pad)
      for (const [x, y] of [[-0.06, 0.08], [0, 0.1], [0.06, 0.08]]) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), pawMat)
        toe.position.set(x, y, 0)
        paw.add(toe)
      }
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), toon(0xffb3c4))
      bean.position.set(0, -0.01, 0.05)
      bean.scale.z = 0.4
      paw.add(bean)
      this.world.add(paw)
      this.preview = { key: `${p.edge}-${p.from}-${p.lane}`, lane, paw, offset }
    }
    const [a, b] = this.laneEnds(p.edge, this.preview.offset, p.from)
    const tip = a.clone().lerp(b, clamp(p.progress, 0.02, 1))
    this.preview.lane.span(a, tip)
    this.preview.lane.wall.color.setHex(p.blocked ? 0xe8a090 : 0xf2cf9c)
    const dir = b.clone().sub(a)
    this.preview.paw.position.set(tip.x, tip.y, 0.08)
    this.preview.paw.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2
    this.preview.paw.visible = p.progress < 0.98
    return tip
  }

  crumbs(x, y, n = 3, power = 1) {
    const geo = new THREE.SphereGeometry(1, 6, 5)
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geo, lambert([0xe2b585, 0x9c6a42, 0xf2d0a0][k % 3]))
      const s = 0.02 + Math.random() * 0.03
      m.scale.setScalar(s)
      m.position.set(x, y, 0.06)
      this.world.add(m)
      this.fx.push({ mesh: m, v: new THREE.Vector3((Math.random() - 0.5) * 1.8 * power, (1 + Math.random() * 1.5) * power, Math.random() * 0.8), life: 0.6 + Math.random() * 0.4, age: 0, gravity: 9 })
    }
  }

  dust(edgeIndex, n = 20) {
    const [a, b] = this.laneEnds(edgeIndex)
    for (let k = 0; k < n; k++) {
      const p = a.clone().lerp(b, Math.random())
      this.crumbs(p.x, p.y, 1, 0.8)
    }
  }

  shake(edgeIndex) {
    for (const lane of this.lanes[edgeIndex]) lane.shake = 0.4
  }

  hearts(i) {
    const p = this.pos(i)
    for (let k = 0; k < 5; k++) {
      const s = sprite(heartTexture, 0.16 + Math.random() * 0.1)
      s.position.set(p.x + (Math.random() - 0.5) * 0.6, p.y, 0.2)
      this.world.add(s)
      this.fx.push({ mesh: s, v: new THREE.Vector3((Math.random() - 0.5) * 0.6, 1 + Math.random() * 0.6, 0), life: 1.6, age: 0, gravity: -0.3, fade: true })
    }
  }

  /* ---------- picking ---------- */

  toBoard(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    return this.ray.ray.intersectPlane(this.face, hit) ? hit : null
  }

  toScreen(v) {
    const p = v.clone().project(this.camera)
    const rect = this.renderer.domElement.getBoundingClientRect()
    return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height }
  }

  roomAt(p) {
    let best = null, bd = R + 0.15
    this.board.burrows.forEach((b) => {
      const d = this.pos(b.index).distanceTo(new THREE.Vector3(p.x, p.y, 0))
      if (d < bd) { bd = d; best = b.index }
    })
    return best
  }

  tunnelAt(p) {
    let best = null, bd = 0.28
    this.board.edges.forEach((e) => {
      if (!this.counts[e.index]) return
      const a = this.pos(e.a), b = this.pos(e.b)
      const inside = e.horizontal ? p.x > Math.min(a.x, b.x) + R && p.x < Math.max(a.x, b.x) - R : p.y < Math.max(a.y, b.y) - R && p.y > Math.min(a.y, b.y) + R
      const d = e.horizontal ? Math.abs(p.y - a.y) : Math.abs(p.x - a.x)
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
    const look = new THREE.Vector3((this.left + this.right) / 2, this.bottom / 2, 0)
    this.camera.position.set(look.x, look.y + Math.sin(TILT) * 40, Math.cos(TILT) * 40)
    this.camera.lookAt(look)
    this.camera.updateMatrixWorld()
    const view = this.camera.matrixWorldInverse
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const [x, y, z] of [[this.left, 0.55, -1.2], [this.right, 0.55, -1.2], [this.left, this.bottom, 0], [this.right, this.bottom, 0], [this.left, 0.3, 0.1], [this.right, 0.3, 0.1]]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(view)
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y)
    }
    const s = Math.min(w / (maxX - minX), h / (maxY - minY))
    const cx = (minX + maxX) / 2
    this.camera.left = cx - w / 2 / s
    this.camera.right = cx + w / 2 / s
    this.camera.top = maxY
    this.camera.bottom = maxY - h / s
    this.camera.updateProjectionMatrix()
  }

  /* ---------- animation ---------- */

  update(dt) {
    this.time += dt
    if (!this.board) return
    for (const room of this.rooms) {
      room.lit = THREE.MathUtils.damp(room.lit, room.litTarget, 3, dt)
      room.wall.color.setRGB(lerp(0.55, 0.96, room.lit), lerp(0.4, 0.74, room.lit), lerp(0.27, 0.5, room.lit)).convertSRGBToLinear()
      room.lamp.emissiveIntensity = 0.15 + room.lit * 1.4
      room.glow.material.opacity = room.lit * 0.5
      if (room.bounce >= 0) {
        room.bounce += dt / 0.4
        const k = Math.min(1, room.bounce)
        const w = Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.06 * (room.bounceAmount ?? 1)
        room.inner.scale.set(1 + w, 1 - w, 1)
        if (k >= 1) { room.bounce = -1; room.inner.scale.set(1, 1, 1) }
      }
      room.z.position.y = R * 0.45 + Math.sin(this.time * 1.6) * 0.05
      room.z.material.opacity = 0.65 + Math.sin(this.time * 1.6) * 0.3
      for (const bunny of room.bunnies) bunny.update(dt, room.worried)
    }
    for (const lanes of this.lanes) for (const lane of lanes) {
      if (lane.shake > 0) {
        lane.shake -= dt
        lane.group.position.x = lane.base.x + (lane.shake > 0 ? Math.sin(this.time * 70) * 0.025 : 0)
      }
    }
    // carrots rolling down the tunnels
    for (let k = this.carrots.length - 1; k >= 0; k--) {
      const c = this.carrots[k]
      c.t += dt * 4.2
      let left = c.t, p = c.route[c.route.length - 1], done = true
      for (let s = 1; s < c.route.length; s++) {
        const a = c.route[s - 1], b = c.route[s], L = a.distanceTo(b)
        if (left <= L) { p = a.clone().lerp(b, left / L); done = false; break }
        left -= L
      }
      c.mesh.position.set(p.x, p.y, -0.08)
      c.mesh.rotation.z = c.t * 3
      if (done) {
        c.mesh.removeFromParent()
        this.carrots.splice(k, 1)
        c.onArrive?.()
      }
    }
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const f = this.fx[k]
      f.age += dt
      f.v.y -= f.gravity * dt
      f.mesh.position.addScaledVector(f.v, dt)
      if (f.fade) f.mesh.material.opacity = Math.max(0, 1 - f.age / f.life)
      else f.mesh.scale.multiplyScalar(1 - dt * 0.8)
      if (f.age > f.life) { f.mesh.removeFromParent(); this.fx.splice(k, 1) }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
