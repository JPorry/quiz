import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { toon, part, baked, seeded } from './look.js'

// The little world around the garden: a cottage with a puffing chimney, puffy
// trees, a pond with a duck, mushrooms, a gnome, stepping stones, and critters
// pottering about. It fills whatever lawn the screen shows around the fence.
// Everything is chunky, round and soft, with sticker outlines.

const SPHERE = new THREE.SphereGeometry(1, 14, 10)
const BALL = new THREE.SphereGeometry(1, 8, 6)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14)
const CONE = new THREE.ConeGeometry(1, 1, 14)
const SOFT = new RoundedBoxGeometry(1, 1, 1, 3, 0.2)
const DOME = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)
const TORUS = new THREE.TorusGeometry(1, 0.42, 8, 16)
const CAPSULE = new THREE.CapsuleGeometry(1, 1.4, 4, 8)
const DISC = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2)

const LINE = 0x4a4056
const EYE = 0x3a2e3e
const BLUSH = 0xff9fb2
const TREE_GREENS = [0x7fd67a, 0x6cc96e, 0x93e08a, 0x86d98f]
const BLOSSOM = [0xffc4d8, 0xffb0cb, 0xfff0f5]

/* ---------- scenery pieces, each a list of parts around (0, 0) ---------- */

function cottage(rand) {
  const roof = [0xff8f8f, 0xc9a6ff, 0x8fc8ff][Math.floor(rand() * 3)]
  return [
    part(SOFT, 0xfff3e0, [0, 0.28, 0], [0.9, 0.56, 0.7]),
    // a round, thatched-looking roof, set back so the front shows
    part(SPHERE, roof, [0, 0.66, -0.06], [0.55, 0.3, 0.42]),
    part(SPHERE, roof, [0, 0.6, -0.04], [0.56, 0.16, 0.44]),
    part(CYL, 0xd98a7a, [0.24, 0.86, -0.1], [0.07, 0.24, 0.07]),
    part(CYL, 0xc7786a, [0.24, 0.98, -0.1], [0.085, 0.03, 0.085]),
    // a round door, two round windows with flower boxes
    part(DOME, 0xb87a52, [0, 0, 0.352], [0.13, 0.32, 0.03], [Math.PI / 2, 0, 0]),
    part(CYL, 0xb87a52, [0, 0.1, 0.352], [0.13, 0.2, 0.03], [Math.PI / 2, 0, 0]),
    part(BALL, 0xffd36e, [0.07, 0.14, 0.38], [0.018, 0.018, 0.018]),
    ...[-0.29, 0.29].flatMap((x) => [
      part(CYL, 0xbfe6ff, [x, 0.33, 0.352], [0.09, 0.02, 0.09], [Math.PI / 2, 0, 0]),
      part(TORUS, 0xffffff, [x, 0.33, 0.36], [0.09, 0.09, 0.09]),
      part(SOFT, 0xa8724a, [x, 0.2, 0.39], [0.22, 0.06, 0.07]),
      ...[-0.06, 0, 0.06].map((d, k) => part(BALL, [0xff7fa8, 0xffd36e, 0xff9f6e][k], [x + d, 0.25, 0.4], [0.03, 0.03, 0.03])),
    ]),
  ]
}

function tree(rand) {
  const green = TREE_GREENS[Math.floor(rand() * TREE_GREENS.length)]
  const blossom = rand() < 0.4
  const size = 0.75 + rand() * 0.45
  const parts = [part(CYL, 0xb98458, [0, 0.2 * size, 0], [0.06 * size, 0.4 * size, 0.06 * size])]
  for (const [x, y, z, r] of [[0, 0.62, 0, 0.3], [-0.2, 0.5, 0.05, 0.22], [0.2, 0.52, -0.02, 0.23], [0.02, 0.48, 0.18, 0.2]]) {
    parts.push(part(SPHERE, blossom ? BLOSSOM[Math.floor(rand() * 2)] : green, [x * size, y * size, z * size], [r * size, r * size * 0.92, r * size]))
  }
  // a few apples or blossom dots
  for (let k = 0; k < 5; k++) {
    const a = rand() * Math.PI * 2, h = 0.45 + rand() * 0.3
    parts.push(part(BALL, blossom ? 0xffffff : 0xff6b6b, [Math.cos(a) * 0.26 * size, h * size, Math.sin(a) * 0.2 * size + 0.12 * size], [0.035, 0.035, 0.035]))
  }
  return parts
}

function bush(rand) {
  const green = TREE_GREENS[Math.floor(rand() * TREE_GREENS.length)]
  const flower = [0xff8fb0, 0xfff1a8, 0xc9a6ff, 0xffffff][Math.floor(rand() * 4)]
  const parts = [[0, 0.14, 0, 0.18], [-0.15, 0.1, 0.04, 0.13], [0.15, 0.1, 0.02, 0.14]].map(([x, y, z, r]) => part(SPHERE, green, [x, y, z], [r, r * 0.85, r]))
  for (let k = 0; k < 6; k++) {
    const a = rand() * Math.PI * 2
    parts.push(part(BALL, flower, [Math.cos(a) * 0.17, 0.12 + rand() * 0.12, Math.sin(a) * 0.1 + 0.08], [0.028, 0.028, 0.028]))
  }
  return parts
}

function mushrooms(rand) {
  const parts = []
  const n = 2 + Math.floor(rand() * 2)
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * 0.13, z = rand() * 0.08, s = 0.7 + rand() * 0.6
    parts.push(part(CYL, 0xfff3e0, [x, 0.05 * s, z], [0.03 * s, 0.1 * s, 0.03 * s]))
    parts.push(part(DOME, k % 2 ? 0xff9ec0 : 0xff6b6b, [x, 0.09 * s, z], [0.075 * s, 0.06 * s, 0.075 * s]))
    for (let d = 0; d < 3; d++) {
      const a = d * 2.1 + k
      parts.push(part(BALL, 0xffffff, [x + Math.cos(a) * 0.04 * s, 0.135 * s, z + Math.sin(a) * 0.04 * s], [0.012 * s, 0.008 * s, 0.012 * s]))
    }
  }
  return parts
}

function gnome() {
  return [
    part(SPHERE, 0x6fa8ff, [0, 0.1, 0], [0.09, 0.1, 0.08]),
    part(SPHERE, 0xffd9c2, [0, 0.2, 0.01], [0.055, 0.05, 0.05]),
    part(SPHERE, 0xffffff, [0, 0.17, 0.04], [0.05, 0.05, 0.03]),
    part(BALL, 0xff9a8a, [0, 0.205, 0.058], [0.018, 0.016, 0.016]),
    part(CONE, 0xff5f6d, [0, 0.31, 0], [0.065, 0.16, 0.065], [-0.25, 0, 0]),
    part(BALL, EYE, [-0.02, 0.215, 0.05], [0.007, 0.009, 0.006]),
    part(BALL, EYE, [0.02, 0.215, 0.05], [0.007, 0.009, 0.006]),
  ]
}

function pebblesPath(rand, length) {
  const parts = []
  for (let k = 0; k < length; k++) {
    parts.push(part(SPHERE, k % 2 ? 0xf2e8d8 : 0xe6dccb, [(rand() - 0.5) * 0.12, 0.012, k * 0.34], [0.13, 0.025, 0.1], [0, rand() * 3, 0]))
  }
  return parts
}

function pond(rand) {
  const parts = [
    part(DISC, 0xd8cfc0, [0, 0.004, 0], [0.62, 1, 0.42]),
    part(DISC, 0x7fd0e8, [0, 0.008, 0], [0.55, 1, 0.36]),
    part(DISC, 0xa8e2f0, [-0.12, 0.01, -0.06], [0.3, 1, 0.16]),
  ]
  // stones round the edge, and lily pads
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2
    parts.push(part(SPHERE, k % 2 ? 0xe9e1d3 : 0xd6ccbc, [Math.cos(a) * 0.6, 0.02, Math.sin(a) * 0.4], [0.07, 0.04, 0.06], [0, rand() * 3, 0]))
  }
  for (const [x, z] of [[0.25, 0.12], [-0.3, 0.1], [0.32, -0.12]]) {
    parts.push(part(new THREE.CircleGeometry(1, 16, 0.3, Math.PI * 1.8).rotateX(-Math.PI / 2), 0x6cc96e, [x, 0.014, z], [0.09, 1, 0.09]))
  }
  parts.push(part(BALL, 0xffb7d0, [0.25, 0.03, 0.12], [0.03, 0.025, 0.03]))
  return parts
}

function tufts(rand) {
  const parts = []
  for (let b = 0; b < 3; b++) {
    const a = rand() * 6
    parts.push(part(SPHERE, b % 2 ? 0x6fbf55 : 0x5aae48, [Math.cos(a) * 0.03, 0.035, Math.sin(a) * 0.03], [0.014, 0.075, 0.014], [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]))
  }
  return parts
}

function flowersPatch(rand) {
  const parts = []
  const colors = [0xffffff, 0xfff1a8, 0xffb7d0, 0xc9a6ff]
  for (let k = 0; k < 5; k++) {
    const x = (rand() - 0.5) * 0.3, z = (rand() - 0.5) * 0.2
    parts.push(part(CYL, 0x6fbf55, [x, 0.03, z], [0.006, 0.06, 0.006]))
    parts.push(part(BALL, colors[Math.floor(rand() * colors.length)], [x, 0.065, z], [0.025, 0.014, 0.025]))
    parts.push(part(BALL, 0xffd23f, [x, 0.074, z], [0.009, 0.006, 0.009]))
  }
  return parts
}

const PIECES = { cottage, tree, bush, mushrooms, gnome, pond, tufts, flowers: flowersPatch }
// how much room each piece needs, as a radius
// everything out on the lawn is drawn a size up, chunky and toy-like
const BIG = 1.35
const ROOM = { cottage: 0.72, pond: 0.72, tree: 0.38, bush: 0.26, mushrooms: 0.2, gnome: 0.14, tufts: 0.06, flowers: 0.18 }

/* ---------- critters ---------- */

// A critter is a baked mesh that moves about on the lawn. Its soft round
// shadow is a dark disc that follows it, so moving critters cost no shadow map.
const CRITTER = 1.7
const blob = new THREE.MeshBasicMaterial({ color: 0x2a5a20, transparent: true, opacity: 0.18, depthWrite: false })

class Critter {
  constructor(parent, parts, { shadow = 0.12, line = LINE } = {}) {
    this.group = new THREE.Group()
    this.body = baked(parts, { line, width: 0.006, shadow: false })
    this.body.scale.setScalar(CRITTER)
    this.inner = new THREE.Group()
    this.inner.add(this.body)
    this.group.add(this.inner)
    this.shadow = new THREE.Mesh(DISC, blob)
    this.shadow.scale.setScalar(shadow * CRITTER)
    this.shadow.position.y = 0.006
    parent.add(this.group, this.shadow)
    this.boing = -1
  }

  place(x, z, y = 0) {
    this.group.position.set(x, y, z)
    this.shadow.position.x = x
    this.shadow.position.z = z
  }

  // a tap makes a critter jump with joy
  poke() { this.boing = 0 }

  bounce(dt) {
    if (this.boing < 0) return 0
    this.boing += dt / 0.6
    if (this.boing >= 1) { this.boing = -1; return 0 }
    return Math.sin(this.boing * Math.PI) * 0.25
  }
}

const faceParts = (x, y, z, s = 1) => [
  part(BALL, EYE, [x - 0.03 * s, y, z], [0.012 * s, 0.015 * s, 0.01 * s]),
  part(BALL, EYE, [x + 0.03 * s, y, z], [0.012 * s, 0.015 * s, 0.01 * s]),
  part(BALL, 0xffffff, [x - 0.026 * s, y + 0.006 * s, z + 0.006 * s], [0.004 * s, 0.004 * s, 0.003 * s]),
  part(BALL, 0xffffff, [x + 0.034 * s, y + 0.006 * s, z + 0.006 * s], [0.004 * s, 0.004 * s, 0.003 * s]),
  part(BALL, BLUSH, [x - 0.05 * s, y - 0.018 * s, z - 0.004 * s], [0.014 * s, 0.008 * s, 0.006 * s]),
  part(BALL, BLUSH, [x + 0.05 * s, y - 0.018 * s, z - 0.004 * s], [0.014 * s, 0.008 * s, 0.006 * s]),
]

// A bunny hops from spot to spot, pausing to look about.
class Bunny extends Critter {
  constructor(parent, area, rand, color = 0xfffaf3) {
    super(parent, [
      part(SPHERE, color, [0, 0.1, -0.02], [0.11, 0.1, 0.13]),
      part(SPHERE, color, [0, 0.19, 0.09], [0.085, 0.08, 0.08]),
      ...[-1, 1].flatMap((s) => [
        part(CAPSULE, color, [s * 0.035, 0.31, 0.06], [0.024, 0.06, 0.016], [-0.2, 0, s * -0.18]),
        part(CAPSULE, 0xffc4d4, [s * 0.035, 0.31, 0.072], [0.012, 0.045, 0.006], [-0.2, 0, s * -0.18]),
        part(SPHERE, color, [s * 0.06, 0.03, 0.06], [0.035, 0.025, 0.045]),
      ]),
      part(SPHERE, 0xffffff, [0, 0.12, -0.15], [0.04, 0.04, 0.04]),
      part(BALL, 0xff9fb2, [0, 0.19, 0.168], [0.012, 0.009, 0.008]),
      ...faceParts(0, 0.205, 0.158, 0.9),
    ], { shadow: 0.13 })
    this.area = area
    this.rand = rand
    this.radius = 0.2
    this.at = new THREE.Vector2(...area.spot(this.radius))
    this.from = this.at.clone()
    this.to = this.at.clone()
    area.movers.push(this)
    this.hop = 1
    this.wait = rand() * 2
    this.place(this.at.x, this.at.y)
  }

  update(dt, time) {
    if (this.hop >= 1) {
      this.wait -= dt
      if (this.wait <= 0) {
        // pick a nearby spot, a few hops away
        const [x, z] = this.area.near(this.at.x, this.at.y, 0.9, this.radius, this)
        this.from.copy(this.at)
        this.to.set(x, z)
        this.hops = Math.max(1, Math.round(this.from.distanceTo(this.to) / 0.22))
        this.hop = this.from.equals(this.to) ? 1 : 0
        this.group.rotation.y = Math.atan2(x - this.at.x, z - this.at.y)
      }
    } else {
      this.hop = Math.min(1, this.hop + dt / (0.38 * this.hops))
      this.at.lerpVectors(this.from, this.to, this.hop)
      if (this.hop >= 1) this.wait = 1 + this.rand() * 3
    }
    // if it couldn't find anywhere to go, it just sits a while longer
    if (this.hop >= 1 && this.from.equals(this.to)) this.wait = Math.max(this.wait, 0.5)
    const phase = (this.hop * this.hops) % 1
    const lift = this.hop < 1 ? Math.sin(phase * Math.PI) * 0.09 : 0
    this.place(this.at.x, this.at.y, lift + this.bounce(dt))
    const squash = this.hop < 1 ? 1 + Math.sin(phase * Math.PI * 2) * 0.08 : 1 + Math.sin(time * 3) * 0.015
    this.inner.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash))
  }
}

Bunny.prototype.spots = function () { return [[this.at.x, this.at.y], [this.to.x, this.to.y]] }

// A snail glides very slowly back and forth.
class Snail extends Critter {
  constructor(parent, area, rand) {
    const shell = [0xffb07a, 0xffc4d8, 0xc9a6ff][Math.floor(rand() * 3)]
    super(parent, [
      part(CAPSULE, 0xd9f0a8, [0, 0.03, 0], [0.03, 0.06, 0.03], [Math.PI / 2, 0, 0]),
      part(SPHERE, shell, [0, 0.085, -0.03], [0.065, 0.065, 0.045], [0, Math.PI / 2, 0]),
      part(TORUS, 0xffffff, [0, 0.085, -0.03], [0.035, 0.035, 0.035], [0, Math.PI / 2, 0]),
      ...[-1, 1].flatMap((s) => [
        part(CYL, 0xd9f0a8, [s * 0.015, 0.08, 0.07], [0.006, 0.05, 0.006], [0.3, 0, s * -0.3]),
        part(BALL, EYE, [s * 0.022, 0.105, 0.077], [0.01, 0.01, 0.01]),
      ]),
      part(BALL, BLUSH, [0, 0.03, 0.095], [0.01, 0.006, 0.004]),
    ], { shadow: 0.08 })
    this.area = area
    this.radius = 0.12
    const [x, z] = area.spot(this.radius)
    this.x = x
    this.z = z
    area.movers.push(this)
    this.dir = rand() < 0.5 ? 1 : -1
    this.place(x, z)
    this.group.rotation.y = this.dir * Math.PI / 2
    this.t = rand() * 10
  }

  update(dt) {
    this.t += dt
    const nx = this.x + this.dir * dt * 0.03
    if (!this.area.free(nx + this.dir * 0.04, this.z, this.radius, this)) {
      this.dir *= -1
      this.group.rotation.y = this.dir * Math.PI / 2
    } else this.x = nx
    this.place(this.x, this.z, this.bounce(dt))
    this.inner.scale.z = 1 + Math.sin(this.t * 3) * 0.06
  }
}

Snail.prototype.spots = function () { return [[this.x, this.z]] }

// A duck paddles round the pond in slow circles, bobbing.
class Duck extends Critter {
  constructor(parent, cx, cz, rand) {
    super(parent, [
      part(SPHERE, 0xffe066, [0, 0.05, 0], [0.08, 0.06, 0.1]),
      part(SPHERE, 0xffe066, [0, 0.12, 0.07], [0.05, 0.05, 0.05]),
      part(SPHERE, 0xffad42, [0, 0.11, 0.12], [0.025, 0.012, 0.025]),
      part(SPHERE, 0xffd23f, [0, 0.07, -0.09], [0.03, 0.03, 0.03], [0.6, 0, 0]),
      ...faceParts(0, 0.135, 0.108, 0.6),
    ], { shadow: 0 })
    this.shadow.visible = false
    this.cx = cx
    this.cz = cz
    this.t = rand() * 10
  }

  update(dt, time) {
    this.t += dt * 0.25
    const x = this.cx + Math.cos(this.t) * 0.28, z = this.cz + Math.sin(this.t) * 0.16
    this.place(x, z, Math.sin(time * 2.4) * 0.008 + this.bounce(dt) * 0.5)
    this.group.rotation.y = Math.atan2(-Math.sin(this.t) * 0.28, Math.cos(this.t) * 0.16)
    this.group.rotation.z = Math.sin(time * 1.7) * 0.06
  }
}

// A ladybird scurries in little loops.
class Ladybird extends Critter {
  constructor(parent, area, rand) {
    super(parent, [
      part(DOME, 0xff4f5e, [0, 0, 0], [0.045, 0.04, 0.05]),
      part(SPHERE, 0x3a2e3e, [0, 0.012, 0.045], [0.022, 0.018, 0.018]),
      ...[[0.018, 0.02, 0.01], [-0.018, 0.02, 0.01], [0.02, 0.018, -0.022], [-0.02, 0.018, -0.022]].map(([x, y, z]) => part(BALL, 0x3a2e3e, [x, y + 0.012, z], [0.008, 0.004, 0.008])),
      part(BALL, 0xffffff, [-0.008, 0.02, 0.06], [0.004, 0.004, 0.004]),
      part(BALL, 0xffffff, [0.008, 0.02, 0.06], [0.004, 0.004, 0.004]),
    ], { shadow: 0.05 })
    this.area = area
    // it scurries round a loop about 0.17 across, so it needs a clear circle
    this.radius = 0.24
    ;[this.cx, this.cz] = area.spot(this.radius)
    area.movers.push(this)
    this.t = rand() * 10
    this.speed = 0.8 + rand() * 0.5
  }

  update(dt) {
    this.t += dt * this.speed
    const x = this.cx + Math.cos(this.t) * 0.12 + Math.cos(this.t * 2.3) * 0.04
    const z = this.cz + Math.sin(this.t) * 0.09
    this.place(x, z, this.bounce(dt) * 0.4)
    this.group.rotation.y = Math.atan2(-Math.sin(this.t), Math.cos(this.t) * 0.75)
  }
}

Ladybird.prototype.spots = function () { return [[this.cx, this.cz]] }

/* ---------- laying it all out ---------- */

// The lawn the screen shows, minus the garden and whatever has been placed.
class Area {
  constructor(bounds, garden, rand) {
    this.bounds = bounds // [minX, maxX, minZ, maxZ]
    this.garden = garden // [minX, maxX, minZ, maxZ], the fence
    this.rand = rand
    this.taken = []
    // critters that move about: each keeps clear of the others, where they are
    // and where they are heading
    this.movers = []
  }

  free(x, z, r, self = null) {
    const [x0, x1, z0, z1] = this.bounds
    const [g0, g1, h0, h1] = this.garden
    if (x - r < x0 || x + r > x1 || z - r < z0 || z + r > z1) return false
    if (x + r > g0 && x - r < g1 && z + r > h0 && z - r < h1) return false
    if (!this.taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > r + tr)) return false
    return this.movers.every((m) => m === self || m.spots().every(([mx, mz]) => Math.hypot(x - mx, z - mz) > r + m.radius))
  }

  // the whole way from one spot to another is clear
  clear(x0, z0, x1, z1, r, self) {
    const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.08))
    for (let k = 1; k <= steps; k++) {
      const t = k / steps
      if (!this.free(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, r, self)) return false
    }
    return true
  }

  spot(r = 0.1, filter = () => true) {
    const [x0, x1, z0, z1] = this.bounds
    for (let k = 0; k < 200; k++) {
      const x = x0 + this.rand() * (x1 - x0), z = z0 + this.rand() * (z1 - z0)
      if (filter(x, z) && this.free(x, z, r)) return [x, z]
    }
    return [x0 + 0.2, z1 - 0.2]
  }

  // a spot a short way off that a critter of radius r can get to without
  // bumping into anything or anyone
  near(x, z, reach, r = 0.12, self = null) {
    for (let k = 0; k < 30; k++) {
      const a = this.rand() * Math.PI * 2, d = 0.3 + this.rand() * reach
      const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d
      if (this.free(nx, nz, r, self) && this.clear(x, z, nx, nz, r * 0.8, self)) return [nx, nz]
    }
    return [x, z]
  }

  take(x, z, r) { this.taken.push([x, z, r]) }
}

export class World {
  constructor(scene) {
    this.group = new THREE.Group()
    scene.add(this.group)
    this.critters = []
    this.smoke = []
  }

  // bounds: the lawn on screen; garden: the fence. Both [minX, maxX, minZ, maxZ].
  build(bounds, garden, seed) {
    this.group.clear()
    this.critters = []
    this.smoke = []
    const rand = seeded(seed + 77)
    const area = new Area(bounds, garden, rand)
    const parts = []
    const put = (name, x, z, angle = 0) => {
      const m = new THREE.Matrix4().makeRotationY(angle).scale(new THREE.Vector3(BIG, BIG, BIG)).setPosition(x, 0, z)
      for (const p of PIECES[name](rand)) parts.push(p.applyMatrix4(m))
      area.take(x, z, ROOM[name] * BIG)
    }
    const [, , gz0, gz1] = garden
    const behind = (x, z) => z < gz0
    const before = (x, z) => z > gz1
    // keep a path clear from the front of the garden down the screen
    area.take(0, gz1 + 0.45, 0.32)
    // stepping stones down from the garden's front edge
    if (bounds[3] - gz1 > 0.8) {
      const n = Math.max(2, Math.min(6, Math.floor((bounds[3] - gz1 - 0.3) / 0.34)))
      for (const p of pebblesPath(rand, n)) parts.push(p.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, gz1 + 0.3)))
      for (let k = 0; k < n; k++) area.take(0, gz1 + 0.3 + k * 0.34, 0.16)
    }
    // the cottage sits behind the garden, with its chimney puffing
    if (gz0 - bounds[2] > 1.1) {
      const [x, z] = area.spot(ROOM.cottage * BIG, (x, z) => behind(x, z) && Math.abs(x) < (bounds[1] - bounds[0]) * 0.32)
      put('cottage', x, z)
      for (let k = 0; k < 3; k++) {
        const puff = new THREE.Mesh(SPHERE, toon(0xffffff, { rim: 0.3 }))
        // hidden until its first update places and sizes it
        puff.visible = false
        this.group.add(puff)
        this.smoke.push({ puff, x: x + 0.24 * BIG, z: z - 0.1 * BIG, k: k / 3 })
      }
    }
    // a pond in front, with a duck
    if (bounds[3] - gz1 > 1.2) {
      const [x, z] = area.spot(ROOM.pond * BIG, before)
      put('pond', x, z)
      this.critters.push(new Duck(this.group, x, z, rand))
    }
    const lawn = (bounds[1] - bounds[0]) * (bounds[3] - bounds[2]) - (garden[1] - garden[0]) * (garden[3] - garden[2])
    const count = (n) => Math.round(n * Math.max(0, lawn) / 10)
    for (let k = 0; k < count(1.4); k++) put('tree', ...area.spot(ROOM.tree * BIG, behind))
    for (let k = 0; k < count(0.8); k++) put('tree', ...area.spot(ROOM.tree * BIG))
    for (let k = 0; k < count(1.2); k++) put('bush', ...area.spot(ROOM.bush * BIG), rand() * 6)
    for (let k = 0; k < count(0.7); k++) put('mushrooms', ...area.spot(ROOM.mushrooms * BIG), rand() * 6)
    for (let k = 0; k < count(1.5); k++) put('flowers', ...area.spot(ROOM.flowers * BIG), rand() * 6)
    if (lawn > 6) put('gnome', ...area.spot(ROOM.gnome * BIG, before), (rand() - 0.5) * 0.8)
    for (let k = 0; k < count(6); k++) put('tufts', ...area.spot(ROOM.tufts * BIG), rand() * 6)
    if (parts.length) this.group.add(baked(parts, { line: LINE, width: 0.008 }))
    // a few critters, never crowding: one bunny, one snail, and a ladybird or
    // two on a bigger lawn
    this.critters.push(new Bunny(this.group, area, rand, rand() < 0.5 ? 0xf3e2cf : 0xfffaf3))
    this.critters.push(new Snail(this.group, area, rand))
    const ladybirds = Math.max(1, Math.min(2, Math.round(lawn / 10)))
    for (let k = 0; k < ladybirds; k++) this.critters.push(new Ladybird(this.group, area, rand))
  }

  update(dt, time) {
    for (const c of this.critters) c.update(dt, time)
    for (const s of this.smoke) {
      s.k = (s.k + dt * 0.25) % 1
      s.puff.position.set(s.x + Math.sin(s.k * 4 + time) * 0.04 + s.k * 0.15, 1.3 + s.k * 0.7, s.z)
      s.puff.scale.setScalar(0.04 + s.k * 0.08 * (1 - s.k * 0.6))
      s.puff.visible = s.k < 0.95
    }
  }

  // A critter near this point on the lawn, if any, jumps.
  poke(x, z) {
    let best = null, bd = 0.3
    for (const c of this.critters) {
      const d = Math.hypot(c.group.position.x - x, c.group.position.z - z)
      if (d < bd) { bd = d; best = c }
    }
    best?.poke()
    return best
  }
}
