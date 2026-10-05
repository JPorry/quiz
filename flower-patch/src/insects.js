import * as THREE from 'three'
import { part, baked } from './look.js'

// Little visitors to the garden: butterflies, bumblebees and ladybirds. Each is
// a chubby toy with a sticker outline, a face and a soft round shadow on the
// ground. They fly from flower to flower with smooth, steered motion, turning
// and banking gently, land on flowers to rest, and wander off again.
//
// A garden keeps a butterfly for every bed in flower, and more visitors drop in
// now and then as flowers open. The finale brings a crowd.

const SPHERE = new THREE.SphereGeometry(1, 14, 10)
const BALL = new THREE.SphereGeometry(1, 8, 6)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10)
const HALF = new THREE.SphereGeometry(1, 10, 8, 0, Math.PI, 0, Math.PI / 2)
const DISC = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2)

const EYE = 0x3a2e3e
const BLUSH = 0xff9fb2
const LINE = 0x4a3a4a
const WINGS = [
  [0xffb3d1, 0xffe3ee], [0xfff0a0, 0xfffbe0], [0xb8e0ff, 0xe8f6ff],
  [0xd9c2ff, 0xf3ecff], [0xffd0a8, 0xfff0e2], [0xb8f0c8, 0xeafff0],
]
const blob = new THREE.MeshBasicMaterial({ color: 0x2a4a20, transparent: true, opacity: 0.16, depthWrite: false })
const shimmer = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })

const damp = THREE.MathUtils.damp
const angleTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d }

// two dot eyes with a glint, and rosy cheeks, on a head facing +z
function face(parts, [x, y, z], s) {
  for (const k of [-1, 1]) {
    parts.push(part(BALL, EYE, [x + k * 0.36 * s, y + 0.1 * s, z + 0.82 * s], [0.17 * s, 0.21 * s, 0.1 * s]))
    parts.push(part(BALL, 0xffffff, [x + k * 0.36 * s + 0.06 * s, y + 0.18 * s, z + 0.9 * s], [0.06 * s, 0.06 * s, 0.04 * s]))
    parts.push(part(BALL, BLUSH, [x + k * 0.62 * s, y - 0.16 * s, z + 0.66 * s], [0.16 * s, 0.09 * s, 0.06 * s]))
  }
}

// a pair of antennae with round tips
function antennae(parts, [x, y, z], s, color) {
  for (const k of [-1, 1]) {
    parts.push(part(CYL, color, [x + k * 0.3 * s, y + 0.9 * s, z + 0.35 * s], [0.06 * s, 0.9 * s, 0.06 * s], [0.5, 0, -k * 0.35]))
    parts.push(part(BALL, color, [x + k * 0.47 * s, y + 1.3 * s, z + 0.6 * s], [0.16 * s, 0.16 * s, 0.16 * s]))
  }
}

/* ---------- the insects ---------- */

class Insect {
  constructor(parent, { home = null, visitor = false, size = 1 } = {}) {
    this.root = new THREE.Group()
    this.body = new THREE.Group()
    this.root.add(this.body)
    this.shadow = new THREE.Mesh(DISC, blob)
    parent.add(this.root, this.shadow)
    this.home = home // a bed it keeps to, or null for the whole garden
    this.visitor = visitor // leaves after a few flowers
    this.size = size
    this.pos = new THREE.Vector3()
    this.vel = new THREE.Vector3()
    this.yaw = 0
    this.bank = 0
    this.state = 'fly' // fly, rest, leave, gone
    this.target = null
    this.timer = 0
    this.visits = 0
    this.phase = Math.random() * 10
    this.fade = 0
    this.leaving = 0
  }

  place(p) { this.pos.copy(p) }

  // steer smoothly toward the target, slowing as it arrives
  steer(dt, speed, ground) {
    const to = this.target.clone().sub(this.pos)
    const dist = to.length()
    const want = dist > 0.001 ? to.multiplyScalar(Math.min(speed, dist * 2.2) / dist) : to
    this.vel.x = damp(this.vel.x, want.x, 3, dt)
    this.vel.y = damp(this.vel.y, want.y, 3, dt)
    this.vel.z = damp(this.vel.z, want.z, 3, dt)
    this.pos.addScaledVector(this.vel, dt)
    const flat = Math.hypot(this.vel.x, this.vel.z)
    if (flat > 0.02) {
      const turn = angleTo(this.yaw, Math.atan2(this.vel.x, this.vel.z))
      this.yaw += turn * Math.min(1, dt * 5)
      this.bank = damp(this.bank, THREE.MathUtils.clamp(-turn * 0.8, -0.45, 0.45), 4, dt)
    } else this.bank = damp(this.bank, 0, 4, dt)
    this.shadow.position.set(this.pos.x, ground + 0.004, this.pos.z)
    return dist
  }

  pose(bob = 0) {
    this.root.position.set(this.pos.x, this.pos.y + bob, this.pos.z)
    this.root.rotation.set(0, this.yaw, 0)
    this.body.rotation.z = this.bank
    // pop in when arriving, shrink away when leaving for good
    const s = this.size * Math.min(this.fade, 1 - this.leaving)
    this.root.scale.setScalar(Math.max(0.001, s))
    const h = Math.max(0, this.pos.y - this.ground)
    this.shadow.scale.setScalar(Math.max(0.001, (0.035 - h * 0.012) * this.size * Math.min(this.fade, 1 - this.leaving)))
  }

  dispose() { this.root.removeFromParent(); this.shadow.removeFromParent() }
}

// A chubby butterfly: a round body with a face and antennae, and two pairs of
// rounded wings, each with a paler spot. It flaps in little bursts and glides
// between them, banks as it turns, and lands on flowers to fan its wings.
class Butterfly extends Insect {
  constructor(parent, opts) {
    super(parent, { size: 2.6, ...opts })
    const [wing, spot] = WINGS[Math.floor(Math.random() * WINGS.length)]
    const s = 0.018
    const bodyParts = [
      part(SPHERE, 0x6b5070, [0, 0, -0.6 * s], [0.55 * s, 0.55 * s, 1.5 * s]),
      part(SPHERE, 0x7a5d80, [0, 0.15 * s, 1.1 * s], [0.75 * s, 0.75 * s, 0.75 * s]),
    ]
    face(bodyParts, [0, 0.15 * s, 1.1 * s], 0.75 * s)
    antennae(bodyParts, [0, 0.15 * s, 1.1 * s], s, 0x6b5070)
    this.body.add(baked(bodyParts, { line: LINE, width: 0.004, shadow: false }))
    // a wing on each side, hinged along the body
    this.wings = [-1, 1].map((k) => {
      const parts = [
        part(SPHERE, wing, [k * 2.3 * s, 0, 0.9 * s], [2.2 * s, 0.25 * s, 1.9 * s], [0, k * 0.25, 0]),
        part(SPHERE, spot, [k * 2.6 * s, 0.12 * s, 1.0 * s], [0.9 * s, 0.2 * s, 0.8 * s]),
        part(SPHERE, wing, [k * 1.7 * s, 0, -1.5 * s], [1.5 * s, 0.25 * s, 1.4 * s], [0, -k * 0.35, 0]),
        part(SPHERE, spot, [k * 1.9 * s, 0.12 * s, -1.6 * s], [0.55 * s, 0.2 * s, 0.5 * s]),
      ]
      const hinge = new THREE.Group()
      hinge.add(baked(parts, { line: LINE, width: 0.004, shadow: false }))
      this.body.add(hinge)
      return { hinge, k }
    })
    this.beat = 0
    this.gliding = 0
    this.burst = 0.8
  }

  update(dt, time, garden) {
    this.ground = garden.ground
    this.fade = Math.min(1, this.fade + dt * 1.5)
    let open = 0.3
    if (this.state === 'rest') {
      // sitting on a flower, slowly fanning its wings
      this.timer -= dt
      open = 0.15 + (0.5 + 0.5 * Math.sin(time * 2.2 + this.phase)) * 1.05
      this.pose(0)
      if (this.timer <= 0) this.takeOff(garden)
    } else {
      if (!this.target) this.pickTarget(garden)
      const speed = this.state === 'leave' ? 1.1 : 0.85
      const dist = this.steer(dt, speed, garden.ground)
      // flap in bursts, glide in between
      if (this.gliding > 0) {
        this.gliding -= dt
        open = 0.42 + Math.sin(time * 3 + this.phase) * 0.08
        if (this.gliding <= 0) this.burst = 0.6 + Math.random() * 0.8
      } else {
        this.beat += dt * 10
        open = 0.2 + (0.5 + 0.5 * Math.sin(this.beat * Math.PI * 2)) * 1.0
        this.burst -= dt
        if (this.burst <= 0 && this.vel.y <= 0.1) this.gliding = 0.25 + Math.random() * 0.4
      }
      // a soft bob in time with the wings
      const bob = Math.sin(this.beat * Math.PI * 2 - 1) * 0.012
      this.pose(bob)
      if (this.state === 'leave') {
        if (dist < 0.3 || this.leaving > 0) this.leaving = Math.min(1, this.leaving + dt * 1.5)
        if (this.leaving >= 1) this.state = 'gone'
      } else if (dist < 0.025) this.land(garden)
    }
    // wings rise together over the back
    for (const { hinge, k } of this.wings) hinge.rotation.z = k * open
  }

  pickTarget(garden) {
    const spot = garden.flowerSpot(this.home)
    if (!spot) { this.target = garden.wanderSpot(this.home); this.wander = true; return }
    this.target = spot.clone().add(new THREE.Vector3(0, 0.02, 0))
    this.wander = false
  }

  land(garden) {
    if (this.wander) { this.target = null; return }
    this.state = 'rest'
    this.vel.set(0, 0, 0)
    this.bank = 0
    this.timer = 1.8 + Math.random() * 2.6
    this.visits++
    garden.onLand?.(this)
  }

  takeOff(garden) {
    if (this.visitor && this.visits >= 2 + Math.floor(this.phase % 2)) return this.leave(garden)
    this.state = 'fly'
    this.target = null
    // a little hop up before heading off
    this.vel.set(0, 0.5, 0)
    this.pickTarget(garden)
  }

  leave(garden) {
    this.state = 'leave'
    this.target = garden.exitSpot(this.pos)
  }
}

// A round, fuzzy bumblebee with stripes, a face and shimmering wings. It zips
// from flower to flower and hovers over each one, bobbing.
class Bee extends Insect {
  constructor(parent, opts) {
    super(parent, { size: 2.8, ...opts })
    const s = 0.02
    const parts = [
      part(SPHERE, 0xffd23f, [0, 0, -0.3 * s], [1.15 * s, 1.05 * s, 1.35 * s]),
      part(CYL, 0x4a3a3a, [0, 0, -0.55 * s], [1.08 * s, 0.35 * s, 1.08 * s], [Math.PI / 2, 0, 0]),
      part(CYL, 0x4a3a3a, [0, 0, -1.2 * s], [0.82 * s, 0.3 * s, 0.82 * s], [Math.PI / 2, 0, 0]),
      part(SPHERE, 0x4a3a3a, [0, 0.05 * s, 1.05 * s], [0.75 * s, 0.72 * s, 0.7 * s]),
      part(BALL, 0x4a3a3a, [0, -0.1 * s, -1.75 * s], [0.18 * s, 0.18 * s, 0.25 * s]),
      // a fluffy collar
      part(SPHERE, 0xfff1b0, [0, 0.1 * s, 0.55 * s], [0.95 * s, 0.85 * s, 0.4 * s]),
    ]
    for (const k of [-1, 1]) {
      parts.push(part(BALL, 0xffffff, [k * 0.3 * s, 0.2 * s, 1.6 * s], [0.2 * s, 0.24 * s, 0.1 * s]))
      parts.push(part(BALL, EYE, [k * 0.3 * s, 0.2 * s, 1.68 * s], [0.12 * s, 0.15 * s, 0.06 * s]))
      parts.push(part(BALL, BLUSH, [k * 0.55 * s, -0.12 * s, 1.5 * s], [0.14 * s, 0.08 * s, 0.05 * s]))
    }
    antennae(parts, [0, 0.05 * s, 1.05 * s], 0.7 * s, 0x4a3a3a)
    this.body.add(baked(parts, { line: LINE, width: 0.004, shadow: false }))
    this.wings = [-1, 1].map((k) => {
      const hinge = new THREE.Group()
      const w = new THREE.Mesh(SPHERE, shimmer)
      w.scale.set(1.1 * s, 0.08 * s, 0.75 * s)
      w.position.set(k * 1.1 * s, 0, 0)
      hinge.add(w)
      hinge.position.set(0, 0.95 * s, 0.1 * s)
      this.body.add(hinge)
      return { hinge, k }
    })
    this.hover = 0
  }

  update(dt, time, garden) {
    this.ground = garden.ground
    this.fade = Math.min(1, this.fade + dt * 1.5)
    if (!this.target) this.pickTarget(garden)
    const hovering = this.state === 'rest'
    if (hovering) {
      // hovering over a flower, drifting in a tiny figure of eight
      this.timer -= dt
      const t = time * 2.4 + this.phase
      this.pos.x = this.target.x + Math.sin(t) * 0.02
      this.pos.z = this.target.z + Math.sin(t * 2) * 0.012
      this.pos.y = this.target.y + Math.sin(t * 1.7) * 0.012
      this.shadow.position.set(this.pos.x, garden.ground + 0.004, this.pos.z)
      this.yaw += angleTo(this.yaw, Math.sin(t * 0.5) * 0.6 + this.restYaw) * Math.min(1, dt * 3)
      this.bank = damp(this.bank, 0, 4, dt)
      if (this.timer <= 0) {
        if (this.visitor && this.visits >= 3) { this.state = 'leave'; this.target = garden.exitSpot(this.pos) } else { this.state = 'fly'; this.pickTarget(garden) }
      }
    } else {
      const dist = this.steer(dt, this.state === 'leave' ? 1.4 : 1.15, garden.ground)
      if (this.state === 'leave') {
        if (dist < 0.3 || this.leaving > 0) this.leaving = Math.min(1, this.leaving + dt * 1.5)
        if (this.leaving >= 1) this.state = 'gone'
      } else if (dist < 0.03) {
        this.state = 'rest'
        this.restYaw = this.yaw
        this.timer = 1 + Math.random() * 1.6
        this.visits++
        garden.onLand?.(this)
      }
    }
    this.pose(Math.sin(time * 9 + this.phase) * 0.006)
    // fast, shimmering wing beats
    const beat = Math.sin(time * 70 + this.phase)
    for (const { hinge, k } of this.wings) hinge.rotation.z = k * (0.25 + beat * 0.45)
  }

  pickTarget(garden) {
    const spot = garden.flowerSpot(this.home)
    this.target = spot ? spot.clone().add(new THREE.Vector3(0, 0.07, 0)) : garden.wanderSpot(this.home)
  }
}

// A round little ladybird. It flutters over with its spotted shell lifted and
// its wings buzzing, then settles on a flower, closes up, and potters about.
class Ladybird extends Insect {
  constructor(parent, opts) {
    super(parent, { size: 3, ...opts })
    const s = 0.017
    const head = [part(SPHERE, 0x3a2e3e, [0, 0.1 * s, 1.0 * s], [0.6 * s, 0.5 * s, 0.5 * s])]
    for (const k of [-1, 1]) {
      head.push(part(BALL, 0xffffff, [k * 0.25 * s, 0.25 * s, 1.4 * s], [0.14 * s, 0.16 * s, 0.08 * s]))
      head.push(part(BALL, EYE, [k * 0.25 * s, 0.25 * s, 1.46 * s], [0.08 * s, 0.1 * s, 0.05 * s]))
    }
    antennae(head, [0, 0.1 * s, 1.0 * s], 0.6 * s, 0x3a2e3e)
    head.push(part(SPHERE, 0x3a2e3e, [0, 0, 0], [0.9 * s, 0.4 * s, 1.0 * s]))
    this.body.add(baked(head, { line: LINE, width: 0.004, shadow: false }))
    // the two halves of the shell, each hinged at the middle
    this.shell = [-1, 1].map((k) => {
      const parts = [part(HALF, 0xff4f5e, [0, 0, 0], [1.05 * s, 0.9 * s, 1.15 * s], [0, k > 0 ? 0 : Math.PI, 0])]
      for (const [x, z, r] of [[0.45, 0.35, 0.22], [0.55, -0.45, 0.2], [0.2, -0.05, 0.16]]) parts.push(part(BALL, 0x3a2e3e, [k * x * s, 0.62 * s, z * s], [r * s, 0.12 * s, r * s]))
      const hinge = new THREE.Group()
      hinge.add(baked(parts, { line: LINE, width: 0.004, shadow: false }))
      hinge.position.y = 0.05 * s
      this.body.add(hinge)
      return { hinge, k }
    })
    this.wings = [-1, 1].map((k) => {
      const hinge = new THREE.Group()
      const w = new THREE.Mesh(SPHERE, shimmer)
      w.scale.set(1.3 * s, 0.06 * s, 0.6 * s)
      w.position.set(k * 1.2 * s, 0, -0.2 * s)
      hinge.add(w)
      hinge.position.y = 0.3 * s
      this.body.add(hinge)
      return { hinge, k }
    })
    this.lift = 1
  }

  update(dt, time, garden) {
    this.ground = garden.ground
    this.fade = Math.min(1, this.fade + dt * 1.5)
    if (!this.target) this.target = (garden.flowerSpot(this.home) ?? garden.wanderSpot(this.home)).clone()
    if (this.state === 'rest') {
      // settled: shell closed, pottering in a small circle on the petals
      this.timer -= dt
      this.lift = damp(this.lift, 0, 6, dt)
      const t = time * 0.8 + this.phase
      this.pos.x = this.target.x + Math.cos(t) * 0.035
      this.pos.z = this.target.z + Math.sin(t) * 0.035
      this.yaw = t + Math.PI
      this.shadow.position.set(this.pos.x, garden.ground + 0.004, this.pos.z)
      if (this.timer <= 0) {
        this.state = this.visitor && this.visits >= 2 ? 'leave' : 'fly'
        this.target = this.state === 'leave' ? garden.exitSpot(this.pos) : null
      }
      this.pose(0)
    } else {
      this.lift = damp(this.lift, 1, 6, dt)
      const dist = this.target ? this.steer(dt, this.state === 'leave' ? 1 : 0.7, garden.ground) : 1
      this.pose(Math.sin(time * 12 + this.phase) * 0.008)
      if (this.state === 'leave') {
        if (dist < 0.3 || this.leaving > 0) this.leaving = Math.min(1, this.leaving + dt * 1.5)
        if (this.leaving >= 1) this.state = 'gone'
      } else if (dist < 0.02) {
        this.state = 'rest'
        this.timer = 3 + Math.random() * 3
        this.visits++
        garden.onLand?.(this)
      }
    }
    // the shell lifts and the wings buzz while flying
    for (const { hinge, k } of this.shell) hinge.rotation.z = k * this.lift * 0.6
    const beat = Math.sin(time * 60 + this.phase)
    for (const { hinge, k } of this.wings) {
      hinge.visible = this.lift > 0.2
      hinge.rotation.z = k * (0.2 + beat * 0.5) * this.lift
    }
    if (this.state !== 'rest') this.body.rotation.x = -0.35 * this.lift
    else this.body.rotation.x = 0
  }
}

const KINDS = { butterfly: Butterfly, bee: Bee, ladybird: Ladybird }

/* ---------- the swarm ---------- */

export class Insects {
  // garden: { ground, flowerSpot(bed), wanderSpot(bed), exitSpot(pos), entrySpot() }
  constructor(parent, garden) {
    this.parent = parent
    this.garden = garden
    this.all = []
  }

  clear() {
    for (const f of this.all) f.dispose()
    this.all = []
  }

  get visitors() { return this.all.filter((f) => f.visitor && f.state !== 'gone').length }

  // A new insect, flying in from the edge of the garden, or already settled.
  add(kind, { home = null, visitor = false, settled = false } = {}) {
    const f = new KINDS[kind](this.parent, { home, visitor })
    f.ground = this.garden.ground
    if (settled) {
      const spot = this.garden.flowerSpot(home) ?? this.garden.wanderSpot(home)
      f.place(spot.clone().add(new THREE.Vector3(0, 0.02, 0)))
      f.fade = 1
    } else f.place(this.garden.entrySpot())
    f.yaw = Math.random() * Math.PI * 2
    this.all.push(f)
    return f
  }

  // a random visitor, if the garden isn't already busy
  visit(kind = null, limit = 6) {
    if (this.visitors >= limit) return null
    const r = Math.random()
    return this.add(kind ?? (r < 0.45 ? 'bee' : r < 0.75 ? 'butterfly' : 'ladybird'), { visitor: true })
  }

  // the bed's own butterfly flies off when its flowers go
  release(home) {
    for (const f of this.all) if (f.home === home && !f.visitor) { f.visitor = true; f.home = null; f.state = 'leave'; f.target = this.garden.exitSpot(f.pos) }
  }

  has(home) { return this.all.some((f) => f.home === home && !f.visitor && f.state !== 'gone') }

  update(dt, time) {
    for (const f of this.all) f.update(dt, time, this.garden)
    for (const f of this.all.filter((x) => x.state === 'gone')) f.dispose()
    this.all = this.all.filter((x) => x.state !== 'gone')
  }
}
