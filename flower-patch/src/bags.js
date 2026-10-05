import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { clay, part, merge } from './look.js'
import { NUM, PIPS } from './flowers.js'

// The seed bags in the tray: little 3D sacks of seeds in the same soft clay as
// the flowers, one per number, drawn on a canvas behind the tray's buttons.
// Each sits over its button. Picking one makes it squash, hop and wiggle; a
// seedling pops up out of its top and waves, and a few seeds tumble out.

const ROUND = new THREE.SphereGeometry(1, 18, 14)
const STEM = new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0)
const LABEL = new RoundedBoxGeometry(1, 1, 1, 3, 0.3)
const TWINE = new THREE.TorusGeometry(1, 0.16, 10, 28).rotateX(Math.PI / 2)
// the sack: a round-bottomed bag pinched in at the neck, turned on a lathe
const SACK = new THREE.LatheGeometry([
  [0, 0], [0.2, 0.012], [0.33, 0.06], [0.41, 0.16], [0.44, 0.3], [0.42, 0.44],
  [0.35, 0.58], [0.25, 0.68], [0.18, 0.74], [0.17, 0.78], [0, 0.78],
].map(([x, y]) => new THREE.Vector2(x, y)), 36)
const SEED = new THREE.SphereGeometry(1, 10, 8)

// the same clay as the flowers, with a touch more fill light so the bags read
// as bright as the buttons around them
const BRIGHT = clay({ fill: 0.8, key: 1.2 })
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex()

// one bag for seed n, its parts baked into a mesh; the seedling is its own
// mesh so it can grow out of the top
function build(n) {
  const c = NUM[n]
  const pale = n === 6
  const body = pale ? 0xfbf6ec : mix(c, 0xffffff, 0.42)
  const frill = pale ? 0xffffff : mix(c, 0xffffff, 0.62)
  const parts = []
  const add = (g, color, p, s, r) => parts.push(part(g, color, p, s, r))
  // the sack, a little flatter front to back
  add(SACK, body, [0, 0, 0], [1, 1, 0.82])
  // the gathered top: a ring of soft ruffles flaring out, and the dark opening
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    add(ROUND, frill, [Math.cos(a) * 0.17, 0.86, Math.sin(a) * 0.15], [0.085, 0.07, 0.085], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5])
  }
  add(ROUND, mix(body, 0x6b4a3a, 0.55), [0, 0.88, 0], [0.13, 0.03, 0.11])
  // twine round the neck, tied in a bow at the front
  add(TWINE, 0xd2a06a, [0, 0.77, 0], [0.185, 0.18, 0.16])
  for (const s of [-1, 1]) add(ROUND, 0xe0b07a, [s * 0.07, 0.785, 0.165], [0.065, 0.04, 0.03], [0, 0, s * 0.35])
  add(ROUND, 0xc98f58, [0, 0.78, 0.175], [0.03, 0.03, 0.026])
  // the label on the front, with the die face in the seed's own colour
  add(LABEL, 0xfffaf2, [0, 0.33, 0.345], [0.42, 0.36, 0.05], [-0.12, 0, 0])
  const r = n === 1 ? 0.075 : 0.048
  for (const [x, z] of PIPS[n]) add(ROUND, c, [x * 0.5, 0.33 - z * 0.5, 0.39 + z * 0.06], [r, r, r * 0.5], [-0.12, 0, 0])
  const mesh = new THREE.Mesh(merge(parts), BRIGHT)
  // the seedling, growing from inside the bag's opening
  const leaf = []
  leaf.push(part(STEM, 0x6bbd52, [0, 0, 0], [0.026, 0.2, 0.026]))
  for (const s of [-1, 1]) leaf.push(part(ROUND, s < 0 ? 0x7fcf5c : 0x9be070, [s * 0.1, 0.2, 0], [0.11, 0.04, 0.07], [0, 0, s * 0.45]))
  const sprout = new THREE.Mesh(merge(leaf), BRIGHT)
  sprout.position.y = 0.84
  sprout.scale.setScalar(0.001)
  // a few seeds that hop out of the top
  const seeds = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(SEED, BRIGHT)
    m.geometry = part(SEED, mix(c, 0x8a5a3b, 0.3), [0, 0, 0], [0.05, 0.065, 0.05])
    m.visible = false
    return m
  })
  const group = new THREE.Group()
  const bag = new THREE.Group()
  bag.add(mesh, sprout)
  group.add(bag, ...seeds)
  return { group, bag, sprout, seeds, n, hop: -1, on: false, grow: 0 }
}

// how a picked bag moves over its 0.62 s hop: [time, rise, squash x, squash y, tilt]
const HOP = [
  [0, 0, 1, 1, 0], [0.14, -0.04, 1.14, 0.84, 0], [0.36, 0.3, 0.92, 1.12, -0.14],
  [0.52, 0.22, 1.04, 0.98, 0.12], [0.68, 0.06, 1.12, 0.9, -0.05], [0.84, 0.12, 1.06, 1.1, 0.02], [1, 0.1, 1.08, 1.08, 0],
]
const ease = (t) => t * t * (3 - 2 * t)
function hopAt(t) {
  for (let k = 1; k < HOP.length; k++) {
    if (t <= HOP[k][0]) {
      const a = HOP[k - 1], b = HOP[k], u = ease((t - a[0]) / (b[0] - a[0]))
      return a.map((v, i) => v + (b[i] - v) * u)
    }
  }
  return HOP[HOP.length - 1]
}

export class SeedBags {
  constructor(canvas, tray) {
    this.canvas = canvas
    this.tray = tray
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -500, 500)
    // the same light as the garden, so the bags match the flowers
    const sky = new THREE.HemisphereLight(0xf6fbff, 0xb9dca0, 1.5)
    const sun = new THREE.DirectionalLight(0xfff3df, 1.9)
    sun.position.set(-4, 10, 8)
    this.scene.add(sky, sun)
    this.bags = new Map()
    this.time = 0
    this.last = performance.now()
    new ResizeObserver(() => this.layout()).observe(tray)
    const tick = (now) => {
      this.update(Math.min(0.05, (now - this.last) / 1000))
      this.last = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  // matches the bags to the tray's buttons: one per seed, over its button
  layout() {
    const box = this.canvas.getBoundingClientRect()
    if (!box.width) return
    this.renderer.setSize(box.width, box.height, false)
    Object.assign(this.camera, { left: 0, right: box.width, top: 0, bottom: -box.height })
    this.camera.updateProjectionMatrix()
    const seen = new Set()
    for (const b of this.tray.querySelectorAll('.packet[data-seed]')) {
      const n = Number(b.dataset.seed)
      if (!n) continue
      seen.add(n)
      if (!this.bags.has(n)) { const bag = build(n); this.bags.set(n, bag); this.scene.add(bag.group) }
      const bag = this.bags.get(n)
      const r = b.getBoundingClientRect()
      const size = Math.min(r.width * 1.05, 54)
      bag.group.position.set(r.left - box.left + r.width / 2, -(r.top - box.top + r.height - 16), 0)
      bag.group.scale.setScalar(size)
      bag.size = size
    }
    for (const [n, bag] of this.bags) bag.group.visible = seen.has(n)
  }

  // n is now in hand; `hop` plays the picking animation
  select(n, hop = true) {
    for (const [k, bag] of this.bags) {
      bag.on = k === n
      if (bag.on && hop && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        bag.hop = 0
        bag.seeds.forEach((s, i) => {
          s.visible = true
          s.position.set(0, 0.88, 0)
          const a = (i - 1.5) * 0.55
          s.userData = { v: new THREE.Vector3(Math.sin(a) * 1.1, 2.3 + Math.random() * 0.5, 0.4), spin: (Math.random() - 0.5) * 12, age: -0.12 - i * 0.04 }
        })
      }
    }
  }

  update(dt) {
    this.time += dt
    for (const bag of this.bags.values()) {
      if (!bag.group.visible) continue
      // a gentle sway while in hand, and the hop on top
      let [rise, sx, sy, tilt] = [bag.on ? 0.1 : 0, bag.on ? 1.08 : 1, bag.on ? 1.08 : 1, 0]
      if (bag.hop >= 0) {
        bag.hop += dt / 0.62
        if (bag.hop >= 1) bag.hop = -1
        else [, rise, sx, sy, tilt] = hopAt(bag.hop)
      }
      if (bag.on) tilt += Math.sin(this.time * 2.2 + bag.n) * 0.04
      bag.bag.position.y = rise
      bag.bag.scale.set(sx, sy, sx)
      // turned a little towards the camera so you see its top and its label
      bag.bag.rotation.set(0.32, -0.12, tilt)
      // the seedling pops up with an overshoot and waves while in hand
      bag.grow += ((bag.on ? 1 : 0) - bag.grow) * Math.min(1, dt * (bag.on ? 9 : 14))
      const pop = bag.grow * (1 + Math.sin(Math.min(1, bag.grow) * Math.PI) * 0.35)
      bag.sprout.scale.setScalar(Math.max(0.001, pop))
      bag.sprout.rotation.z = bag.on ? Math.sin(this.time * 2.6) * 0.15 : 0
      for (const s of bag.seeds) {
        if (!s.visible) continue
        const u = s.userData
        u.age += dt
        if (u.age < 0) { s.scale.setScalar(0.001); continue }
        u.v.y -= 7 * dt
        s.position.addScaledVector(u.v, dt)
        s.rotation.z += u.spin * dt
        s.scale.setScalar(Math.max(0.001, 1 - Math.max(0, u.age - 0.45) * 3))
        if (u.age > 0.8) s.visible = false
      }
    }
    this.renderer.render(this.scene, this.camera)
  }
}
