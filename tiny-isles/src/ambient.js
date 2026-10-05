import * as THREE from 'three'
import { part, merge, toon, outline } from './look.js'

// Life on the open water: little sailboats tacking in slow circles with a wake
// behind them, and gulls wheeling overhead.

const LINE = 0x5e4a58
const SPHERE = new THREE.SphereGeometry(1, 12, 8)
const SAIL = (() => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0, 0.7, 0, 0], 3))
  g.computeVertexNormals()
  return g
})()
const SAILS = [0xff8fa3, 0xffd166, 0xffffff, 0x7fc8ff, 0xc7a3ff]

function sailboat(color) {
  return merge([
    part(SPHERE, 0xffffff, [0, 0.0, 0], [0.09, 0.035, 0.038]),
    part(SPHERE, 0x5a8fd6, [0, -0.008, 0], [0.092, 0.028, 0.04]),
    part(SPHERE, 0xd9a273, [0, 0.022, 0], [0.07, 0.008, 0.028]),
    part(new THREE.CylinderGeometry(1, 1, 1, 6), 0xa8714a, [0.01, 0.11, 0], [0.005, 0.18, 0.005]),
    part(SAIL, color, [0.012, 0.035, 0], [0.13, 0.16, 1]),
    part(SAIL, 0xff6f6f, [0.012, 0.19, 0], [0.03, 0.025, 1]),
  ])
}

const GULL_BODY = merge([
  part(SPHERE, 0xffffff, [0, 0, 0], [0.03, 0.014, 0.014]),
  part(SPHERE, 0xffffff, [0.026, 0.006, 0], [0.012, 0.011, 0.011]),
  part(new THREE.ConeGeometry(1, 1, 6), 0xffb347, [0.042, 0.004, 0], [0.004, 0.014, 0.004], [0, 0, -Math.PI / 2]),
])
const WING = merge([part(SPHERE, 0xf2f4f8, [0, 0, 0.03], [0.016, 0.004, 0.032]), part(SPHERE, 0x9aa3b8, [0, 0, 0.058], [0.012, 0.004, 0.008])])

export class Ambient {
  constructor(parent) {
    this.group = new THREE.Group()
    parent.add(this.group)
    this.boats = []
    this.gulls = []
    this.wake = []
  }

  // distance(x, z) gives how far a point is from the nearest shore
  setup(distance, bounds) {
    this.group.clear()
    this.boats = []
    this.gulls = []
    this.wake = []
    const [minX, maxX, minZ, maxZ] = bounds
    // find quiet patches of sea that a small circle fits in
    for (let tries = 0; tries < 200 && this.boats.length < 3; tries++) {
      const x = minX + Math.random() * (maxX - minX), z = minZ + Math.random() * (maxZ - minZ)
      const room = distance(x, z)
      if (room < 0.75) continue
      if (this.boats.some((b) => Math.hypot(b.cx - x, b.cz - z) < 1.6)) continue
      const radius = Math.min(0.5, room - 0.4)
      const mesh = new THREE.Group()
      const geo = sailboat(SAILS[this.boats.length % SAILS.length])
      const m = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true }))
      mesh.add(m, new THREE.Mesh(geo, outline(LINE, 0.004)))
      mesh.scale.setScalar(1.8)
      this.group.add(mesh)
      this.boats.push({ mesh, cx: x, cz: z, radius, a: Math.random() * 6, speed: (0.12 + Math.random() * 0.06) / radius * (Math.random() < 0.5 ? 1 : -1), puff: 0 })
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2
    for (let k = 0; k < 2; k++) {
      const body = new THREE.Group()
      const b = new THREE.Mesh(GULL_BODY, toon(0xffffff, { vertexColors: true }))
      body.add(b)
      const wings = [1, -1].map((s) => {
        const w = new THREE.Mesh(WING, toon(0xffffff, { vertexColors: true }))
        w.scale.z = s
        body.add(w)
        return w
      })
      body.scale.setScalar(1.6)
      this.group.add(body)
      this.gulls.push({ body, wings, cx: cx + (Math.random() - 0.5) * 2, cz: cz + (Math.random() - 0.5) * 2, radius: 1 + Math.random() * 1.2, a: Math.random() * 6, speed: 0.35 + Math.random() * 0.15, y: 1.1 + k * 0.25, t: Math.random() * 5 })
    }
  }

  update(dt) {
    for (const b of this.boats) {
      b.a += b.speed * dt
      const x = b.cx + Math.cos(b.a) * b.radius, z = b.cz + Math.sin(b.a) * b.radius
      b.mesh.position.set(x, Math.sin(b.a * 7) * 0.006, z)
      // heading along the circle, leaning into the turn
      b.mesh.rotation.set(Math.sign(b.speed) * 0.12, -(b.a + Math.sign(b.speed) * Math.PI / 2), 0, 'YXZ')
      b.puff -= dt
      if (b.puff < 0) {
        b.puff = 0.18
        const w = new THREE.Mesh(SPHERE, toon(0xffffff, { rim: 0 }))
        w.position.set(x, -0.01, z)
        w.scale.set(0.03, 0.006, 0.03)
        this.group.add(w)
        this.wake.push({ mesh: w, age: 0 })
      }
    }
    for (const w of this.wake) {
      w.age += dt
      const s = 0.03 + w.age * 0.05
      w.mesh.scale.set(s, 0.006, s)
      w.mesh.position.y = -0.01 - w.age * 0.02
      if (w.age > 1.2) w.mesh.removeFromParent()
    }
    this.wake = this.wake.filter((w) => w.age <= 1.2)
    for (const g of this.gulls) {
      g.t += dt
      g.a += (g.speed / g.radius) * dt
      g.body.position.set(g.cx + Math.cos(g.a) * g.radius, g.y + Math.sin(g.t * 0.7) * 0.08, g.cz + Math.sin(g.a) * g.radius)
      g.body.rotation.set(0.25, -(g.a + Math.PI / 2), 0, 'YXZ')
      // flap for a moment, then glide
      const flapping = Math.sin(g.t * 0.9) > 0.2
      const flap = flapping ? Math.sin(g.t * 14) * 0.7 : 0.12
      g.wings[0].rotation.x = -flap
      g.wings[1].rotation.x = flap
    }
  }
}
