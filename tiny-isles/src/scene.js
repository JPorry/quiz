import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { City, makeIsland } from './city.js'
import { toon, outline, part, merge, canvasTexture, seeded } from './look.js'

// A tilted diorama of a turquoise sea. Islands sit on a grid; bridges are built
// plank by plank between them; tiny cars drive across once a bridge is open;
// each city grows with every bridge its island gets.

const CX = 1
const ELEVATION = 52 * Math.PI / 180
const DECK_Y = 0.13
const LINE = 0x5e4a58
const CAR_COLORS = [0xff8fa3, 0x7fc8ff, 0xffd166, 0x8ee39b, 0xc7a3ff, 0xffa96b, 0xffffff]
const clamp = THREE.MathUtils.clamp
export const islandRadius = (value) => 0.36 + value * 0.038

/* ---------- the sea ---------- */

const MAX_ISLANDS = 24
function seaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIslands: { value: Array.from({ length: MAX_ISLANDS }, () => new THREE.Vector3(999, 999, 0)) },
      uDeep: { value: new THREE.Color(0x4fc3d6) },
      uShallow: { value: new THREE.Color(0x9ff0e6) },
      uFoam: { value: new THREE.Color(0xffffff) },
      uDusk: { value: 0 },
    },
    vertexShader: `varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uIslands[${MAX_ISLANDS}]; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uDusk;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz;
        float d = 99.0;
        for (int i = 0; i < ${MAX_ISLANDS}; i++) {
          vec3 is = uIslands[i];
          d = min(d, length(p - is.xy) - is.z * 1.2);
        }
        float shallow = 1.0 - smoothstep(0.0, 0.45, d);
        vec3 col = mix(uDeep, uShallow, shallow * 0.85);
        // soft swells and sparkles
        float w = sin(p.x * 3.1 + uTime * 0.7) * sin(p.y * 2.7 - uTime * 0.6);
        col += vec3(0.05, 0.07, 0.07) * smoothstep(0.55, 0.95, w);
        float ripple = sin(d * 28.0 - uTime * 2.2);
        float ring = smoothstep(0.75, 1.0, ripple) * (1.0 - smoothstep(0.02, 0.32, d));
        float lip = 1.0 - smoothstep(0.0, 0.05, abs(d - 0.02));
        col = mix(col, uFoam, clamp(ring * 0.55 + lip * 0.85, 0.0, 1.0));
        col = mix(col, col * vec3(1.15, 0.78, 0.72) + vec3(0.06, 0.02, 0.05), uDusk);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

/* ---------- bridges ---------- */

const PLANK = new RoundedBoxGeometry(1, 1, 1, 2, 0.2)
const POST = new THREE.CylinderGeometry(1, 1, 1, 8)

class Bridge {
  // a: start point, b: end point on the water plane (Vector3), lanes: 1 or 2
  constructor(parent, a, b, lanes, { color = 0xfff0d8, rail = 0xff8a8a } = {}) {
    this.group = new THREE.Group()
    parent.add(this.group)
    this.a = a.clone()
    this.b = b.clone()
    this.lanes = lanes
    const len = a.distanceTo(b)
    this.length = len
    const dir = b.clone().sub(a).normalize()
    this.group.position.copy(a)
    this.group.rotation.y = -Math.atan2(dir.z, dir.x)
    const width = lanes === 2 ? 0.3 : 0.17
    this.width = width
    const n = Math.max(4, Math.round(len / 0.07))
    this.planks = []
    const deck = toon(color, { rim: 0.12 })
    const deckLine = outline(LINE, 0.006)
    const railMat = toon(rail)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = t * len
      const y = this.heightAt(t)
      const g = new THREE.Group()
      g.position.set(x, y, 0)
      g.rotation.z = Math.atan(this.slopeAt(t))
      const plank = new THREE.Mesh(PLANK, deck)
      plank.scale.set(len / n * 0.96, 0.035, width)
      plank.castShadow = true
      g.add(plank)
      const edge = new THREE.Mesh(PLANK, deckLine)
      edge.scale.copy(plank.scale)
      g.add(edge)
      if (lanes === 2 && i % 2 === 0) {
        const dash = new THREE.Mesh(PLANK, toon(0xffd166))
        dash.scale.set(len / n * 0.6, 0.038, 0.018)
        g.add(dash)
      }
      // railing posts on both sides, every other plank
      if (i % 3 === 0) for (const side of [-1, 1]) {
        const post = new THREE.Mesh(POST, railMat)
        post.scale.set(0.006, 0.05, 0.006)
        post.position.set(0, 0.025, side * (width / 2 - 0.008))
        g.add(post)
      }
      g.scale.setScalar(0.001)
      this.group.add(g)
      this.planks.push({ g, t })
    }
    // hand rails along the arch
    this.rails = new THREE.Group()
    for (const side of [-1, 1]) {
      const pts = []
      for (let k = 0; k <= 20; k++) pts.push(new THREE.Vector3((k / 20) * len, this.heightAt(k / 20) + 0.05, side * (width / 2 - 0.008)))
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.009, 6), railMat)
      this.rails.add(tube)
    }
    // little lamp posts at each end
    for (const x of [0.02, len - 0.02]) for (const side of [-1, 1]) {
      const lamp = new THREE.Group()
      lamp.position.set(x, this.heightAt(x / len), side * (width / 2 + 0.01))
      const pole = new THREE.Mesh(POST, toon(0x6b5a6e))
      pole.scale.set(0.008, 0.14, 0.008)
      pole.position.y = 0.07
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1a8 }))
      bulb.position.y = 0.15
      lamp.add(pole, bulb)
      this.rails.add(lamp)
    }
    this.rails.visible = false
    this.group.add(this.rails)
    this.built = 0 // how much of the bridge stands, 0..1
    this.target = 0
  }

  heightAt(t) {
    return DECK_Y + Math.sin(t * Math.PI) * Math.min(0.14, this.length * 0.08)
  }

  slopeAt(t) {
    return Math.cos(t * Math.PI) * Math.PI * Math.min(0.14, this.length * 0.08) / this.length
  }

  // a point on the deck, lane -1 or 1 for two-lane bridges
  pointAt(t, lane = 0) {
    const local = new THREE.Vector3(t * this.length, this.heightAt(t) + 0.018, lane * this.width * 0.25)
    return this.group.localToWorld(local)
  }

  update(dt) {
    // planks pop in one after another as the bridge is built
    const speed = this.target > this.built ? 2.6 : 3.5
    this.built += clamp(this.target - this.built, -dt * speed, dt * speed)
    for (const p of this.planks) {
      const local = clamp((this.built - p.t) * 8 + 1, 0, 1)
      const s = local >= 1 ? 1 : local <= 0 ? 0.001 : 1 + 2.4 * (local - 1) ** 3 + 1.4 * (local - 1) ** 2
      p.g.scale.setScalar(Math.max(0.001, s))
    }
    this.rails.visible = this.built > 0.999
    return this.built
  }

  dispose() {
    this.group.removeFromParent()
  }
}

/* ---------- cars ---------- */

function carGeometry(color) {
  const body = new RoundedBoxGeometry(1, 1, 1, 3, 0.3)
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
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), seaMaterial())
    this.sea.position.y = -0.02
    this.scene.add(this.sea)
    this.world = new THREE.Group()
    this.scene.add(this.world)
    this.ray = new THREE.Raycaster()
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1)
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
      group.add(makeIsland(r, seed * 13 + b.index * 7))
      const city = new City(seed * 17 + b.index * 11)
      city.group.scale.setScalar(r)
      city.group.position.y = 0.105
      group.add(city.group)
      city.setTier(0)
      city.settle()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 128
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
      badge.scale.setScalar(0.42)
      badge.position.set(p.x - r * 0.72, 0.16, p.z + r * 0.95)
      badge.renderOrder = 10
      this.world.add(badge)
      const entry = { b, r, group, city, badge, canvas, tex, bounce: -1, key: '' }
      this.drawBadge(entry, 0, false, false)
      return entry
    })
    const u = this.sea.material.uniforms.uIslands.value
    u.forEach((v, i) => {
      const is = this.islands[i]
      if (is) v.set(is.group.position.x, is.group.position.z, is.r)
      else v.set(999, 999, 0)
    })
    this.bridges = board.edges.map(() => null)
    this.counts = board.edges.map(() => 0)
    this.preview = null
    const reach = Math.max(width, height * this.CZ) + 3
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
      if ((cur?.lanes ?? 0) === want && !cur?.dying) return
      if (cur) { cur.target = 0; cur.dying = true }
      if (want) {
        const [a, b, from] = this.ends(i)
        const br = new Bridge(this.world, a, b, want)
        br.target = 1
        br.from = from
        br.edge = i
        this.bridges[i] = br
        if (cur) this.retire(cur)
      } else if (cur) {
        this.bridges[i] = null
        this.retire(cur)
      }
    })
    this.counts = counts.slice()
  }

  retire(bridge) {
    this.retiring = this.retiring ?? []
    this.retiring.push(bridge)
    for (const car of this.cars) if (car.bridge === bridge) car.gone = true
  }

  // per island: { tier, have, done, over }
  setIslands(states) {
    states.forEach((s, i) => {
      const is = this.islands[i]
      if (is.city.setTier(s.tier)) is.bounce = 0
      this.drawBadge(is, s.have, s.done, s.over)
    })
  }

  setPreview(p) {
    if (!p) {
      if (this.preview) { this.preview.bridge.dispose() }
      this.preview = null
      return null
    }
    const key = `${p.edge}-${p.from}-${p.lanes}`
    if (!this.preview || this.preview.key !== key) {
      this.setPreview(null)
      const [a, b] = this.ends(p.edge, p.from)
      const bridge = new Bridge(this.world, a, b, p.lanes, { color: 0xffffff, rail: 0xffb3b3 })
      this.preview = { key, bridge, a, b }
    }
    const br = this.preview.bridge
    br.target = p.progress
    br.built = p.progress
    br.update(0)
    br.planks.forEach((pl) => pl.g.children[0].material.color?.setHex?.(p.blocked ? 0xffb0a0 : 0xffffff))
    return br.pointAt(clamp(p.progress, 0, 1))
  }

  bounce(i) { this.islands[i].bounce = 0 }

  splash(edgeIndex, n = 14) {
    const [a, b] = this.ends(edgeIndex)
    for (let k = 0; k < n; k++) {
      const p = a.clone().lerp(b, Math.random())
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), toon(0xe9fbff))
      drop.position.set(p.x + (Math.random() - 0.5) * 0.1, 0.05, p.z + (Math.random() - 0.5) * 0.1)
      this.world.add(drop)
      this.fx.push({ mesh: drop, v: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1 + Math.random(), (Math.random() - 0.5) * 0.8), life: 0.7, age: 0, gravity: 6 })
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
    const hw = this.width * CX / 2 + 0.2, hd = this.height * this.CZ / 2 + 0.25
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

  /* ---------- animation ---------- */

  update(dt) {
    this.time += dt
    this.sea.material.uniforms.uTime.value = this.time
    this.dusk = THREE.MathUtils.damp(this.dusk, this.duskTarget, 1.2, dt)
    this.sea.material.uniforms.uDusk.value = this.dusk * 0.6
    this.sun.color.setHex(0xfff1dc).lerp(new THREE.Color(0xffb27a), this.dusk)
    this.sky.color.setHex(0xf2f8ff).lerp(new THREE.Color(0xffd9c9), this.dusk)
    if (!this.board) return
    for (const is of this.islands) {
      is.city.update(dt)
      if (is.bounce >= 0) {
        is.bounce += dt / 0.45
        const k = Math.min(1, is.bounce)
        const w = Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.06
        is.group.scale.set(1 + w, 1 - w, 1 + w)
        if (k >= 1) { is.bounce = -1; is.group.scale.set(1, 1, 1) }
      }
      is.badge.position.y = 0.16 + Math.sin(this.time * 2 + is.b.index) * 0.012
    }
    for (const br of this.bridges) {
      if (!br) continue
      const was = br.built
      br.update(dt)
      if (was < 1 && br.built >= 1) br.opened = true
      if (br.shake > 0) {
        br.shake -= dt
        br.group.position.y = Math.abs(Math.sin(this.time * 40)) * 0.03 * Math.max(0, br.shake)
      }
    }
    if (this.retiring) {
      for (const br of this.retiring) br.update(dt)
      this.retiring = this.retiring.filter((br) => { if (br.built <= 0.001) { br.dispose(); return false } return true })
    }
    this.traffic(dt)
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const f = this.fx[k]
      f.age += dt
      f.v.y -= f.gravity * dt
      f.mesh.position.addScaledVector(f.v, dt)
      f.mesh.scale.multiplyScalar(1 - dt * 1.5)
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
        mesh.castShadow = true
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
