import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { part, baked, seeded, toon } from './look.js'

// Each island's city grows a step with every bridge: a cottage, a village, a town
// with shops and a clock tower, apartment blocks, glass towers, skyscrapers, and at
// the top a futuristic skyline with a needle spire and a sail hotel.
// Buildings are built in their own units (an island of radius 1) and scaled in.

const WALLS = [0xfff3e2, 0xffdccf, 0xdcf1ff, 0xe5f8d8, 0xfff2b8, 0xf0e2ff, 0xffe4ef]
const ROOFS = [0xff8270, 0x6fb4ff, 0xffad4d, 0x76cf88, 0xbf8bff, 0xff8fb8]
const GLASS = [0x9fdcff, 0xb5ecff, 0x8fcbe8, 0xc4e4ff, 0xa9f0e6]
const WINDOW = 0x8fcff0
const DOOR = 0x8a5a44
const TRUNK = 0xa8714a
const LEAF = [0x6ccf6b, 0x8fdc72, 0x55b85d]
const LINE = 0x5e4a58

const BOX = new RoundedBoxGeometry(1, 1, 1, 2, 0.12)
const CRISP = new THREE.BoxGeometry(1, 1, 1)
const SPHERE = new THREE.SphereGeometry(1, 16, 12)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const HEX = new THREE.CylinderGeometry(1, 1, 1, 6)
const CONE = new THREE.ConeGeometry(1, 1, 20)
const PYRAMID = new THREE.ConeGeometry(1, 1, 4)
const PRISM = (() => {
  const s = new THREE.Shape()
  s.moveTo(-0.5, 0)
  s.lineTo(0.5, 0)
  s.lineTo(0, 0.5)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5)
})()
const SAIL = (() => {
  // a curved sail, like the hotel on its own little island
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(0.55, 0.45, 0.08, 1)
  s.lineTo(0, 1)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 16 }).translate(0, 0, -0.11)
})()

/* ---------- building kits: each returns coloured parts, standing on y = 0 ---------- */

function windowsOn(parts, w, h, d, floors, y0 = 0, color = WINDOW) {
  for (let f = 0; f < floors; f++) {
    const y = y0 + (f + 0.55) * (h / floors)
    for (const x of [-w * 0.25, w * 0.25]) parts.push(part(CRISP, color, [x, y, d / 2 + 0.005], [w * 0.22, h / floors * 0.42, 0.02]))
  }
}

const KITS = {
  tree(r) {
    const s = 0.7 + r() * 0.5
    const c = LEAF[Math.floor(r() * LEAF.length)]
    return [part(CYL, TRUNK, [0, 0.07 * s, 0], [0.025 * s, 0.14 * s, 0.025 * s]), part(SPHERE, c, [0, 0.2 * s, 0], [0.1 * s, 0.11 * s, 0.1 * s]), part(SPHERE, c, [0.05 * s, 0.26 * s, 0.02], [0.065 * s, 0.065 * s, 0.065 * s])]
  },
  palm(r) {
    const s = 0.8 + r() * 0.4
    const parts = [part(CYL, 0xc9905c, [0, 0.16 * s, 0], [0.018 * s, 0.32 * s, 0.018 * s], [0, 0, 0.12])]
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      parts.push(part(SPHERE, 0x55c06a, [Math.cos(a) * 0.07 * s + 0.02, 0.32 * s, Math.sin(a) * 0.07 * s], [0.08 * s, 0.018 * s, 0.03 * s], [0, -a, -0.35]))
    }
    return parts
  },
  cottage(r) {
    const wall = WALLS[Math.floor(r() * WALLS.length)], roof = ROOFS[Math.floor(r() * ROOFS.length)]
    const w = 0.2, h = 0.15
    return [
      part(BOX, wall, [0, h / 2, 0], [w, h, w * 0.9]),
      part(PRISM, roof, [0, h, 0], [w * 1.2, w * 0.7, w * 1.05]),
      part(CRISP, roof, [w * 0.25, h + w * 0.25, -w * 0.15], [0.035, 0.09, 0.035]),
      part(CRISP, DOOR, [0, 0.045, w * 0.45 + 0.004], [0.045, 0.075, 0.01]),
      part(CRISP, WINDOW, [-w * 0.3, h * 0.6, w * 0.45 + 0.004], [0.04, 0.04, 0.01]),
      part(CRISP, WINDOW, [w * 0.3, h * 0.6, w * 0.45 + 0.004], [0.04, 0.04, 0.01]),
    ]
  },
  house(r) {
    const wall = WALLS[Math.floor(r() * WALLS.length)], roof = ROOFS[Math.floor(r() * ROOFS.length)]
    const w = 0.22, h = 0.26
    const parts = [part(BOX, wall, [0, h / 2, 0], [w, h, w]), part(PYRAMID, roof, [0, h + 0.06, 0], [w * 0.82, 0.12, w * 0.82], [0, Math.PI / 4, 0])]
    windowsOn(parts, w, h * 0.9, w, 2)
    parts.push(part(CRISP, DOOR, [0, 0.04, w / 2 + 0.006], [0.05, 0.07, 0.01]))
    return parts
  },
  shop(r) {
    const wall = WALLS[Math.floor(r() * WALLS.length)], awn = ROOFS[Math.floor(r() * ROOFS.length)]
    const w = 0.26, h = 0.22
    const parts = [part(BOX, wall, [0, h / 2, 0], [w, h, w * 0.8]), part(CRISP, 0xfff8ee, [0, h + 0.012, 0], [w * 1.02, 0.025, w * 0.82])]
    // striped awning over the shop window
    for (let k = 0; k < 4; k++) parts.push(part(CRISP, k % 2 ? 0xffffff : awn, [-w * 0.375 + k * w * 0.25, h * 0.55, w * 0.46], [w * 0.25, 0.018, 0.08], [0.5, 0, 0]))
    parts.push(part(CRISP, WINDOW, [0, h * 0.25, w * 0.4 + 0.005], [w * 0.7, 0.07, 0.01]))
    return parts
  },
  clock(r) {
    const wall = WALLS[Math.floor(r() * 3)]
    return [
      part(BOX, wall, [0, 0.25, 0], [0.14, 0.5, 0.14]),
      part(CYL, 0xffffff, [0, 0.4, 0.072], [0.045, 0.012, 0.045], [Math.PI / 2, 0, 0]),
      part(CRISP, 0x5a4a5a, [0, 0.41, 0.08], [0.006, 0.03, 0.004]),
      part(PYRAMID, 0x6fb4ff, [0, 0.56, 0], [0.11, 0.14, 0.11], [0, Math.PI / 4, 0]),
    ]
  },
  apartment(r, s = 1) {
    const wall = WALLS[Math.floor(r() * WALLS.length)]
    const floors = Math.round((3 + r() * 2) * s)
    const w = 0.24, h = floors * 0.09
    const parts = [part(BOX, wall, [0, h / 2, 0], [w, h, w])]
    windowsOn(parts, w, h, w, floors)
    windowsOn(parts, w, h, w, floors) // (both sides read the same from above)
    parts.push(part(CYL, 0x8fdc72, [0, h + 0.01, 0], [w * 0.38, 0.02, w * 0.38]))
    if (r() < 0.6) parts.push(part(CYL, 0xd9a06a, [w * 0.25, h + 0.05, -w * 0.25], [0.025, 0.06, 0.025]))
    return parts
  },
  glass(r, s = 1) {
    const g = GLASS[Math.floor(r() * GLASS.length)]
    const h = (0.6 + r() * 0.3) * s
    const parts = [part(CYL, g, [0, h / 2, 0], [0.11, h, 0.11])]
    for (let y = 0.08; y < h; y += 0.08) parts.push(part(CYL, 0xffffff, [0, y, 0], [0.113, 0.012, 0.113]))
    parts.push(part(CYL, 0xffffff, [0, h + 0.015, 0], [0.08, 0.03, 0.08]))
    return parts
  },
  skyscraper(r, s = 1) {
    const g = GLASS[Math.floor(r() * GLASS.length)], trim = 0xffffff
    const h = (0.85 + r() * 0.3) * s
    const parts = []
    // stepped setbacks, each with bands of windows
    const tiers = [[0.22, h * 0.5], [0.17, h * 0.3], [0.12, h * 0.2]]
    let y = 0
    for (const [w, th] of tiers) {
      parts.push(part(BOX, g, [0, y + th / 2, 0], [w, th, w]))
      for (let k = 0.06; k < th; k += 0.07) parts.push(part(CRISP, trim, [0, y + k, 0], [w + 0.006, 0.012, w + 0.006]))
      y += th
    }
    parts.push(part(CYL, 0xdfe6ee, [0, y + 0.08, 0], [0.008, 0.16, 0.008]))
    parts.push(part(SPHERE, 0xff6b7a, [0, y + 0.17, 0], [0.018, 0.018, 0.018]))
    return parts
  },
  twist(r, s = 1) {
    const g = GLASS[Math.floor(r() * GLASS.length)]
    const n = Math.round(12 * s)
    const parts = []
    for (let k = 0; k < n; k++) parts.push(part(BOX, k % 3 === 2 ? 0xffffff : g, [0, 0.04 + k * 0.08, 0], [0.18, 0.075, 0.18], [0, k * 0.12, 0]))
    parts.push(part(CONE, 0xffffff, [0, n * 0.08 + 0.06, 0], [0.06, 0.12, 0.06]))
    return parts
  },
  spire(r, s = 1) {
    // a needle tower in shrinking hexagonal stages, like the tallest in the world
    const parts = []
    let y = 0, w = 0.2
    const stages = Math.round(7 * s)
    for (let k = 0; k < stages; k++) {
      const h = 0.18
      parts.push(part(HEX, k % 2 ? 0xd8ecff : 0xb5dcff, [0, y + h / 2, 0], [w, h, w]))
      parts.push(part(HEX, 0xffffff, [0, y + h, 0], [w + 0.01, 0.012, w + 0.01]))
      y += h
      w *= 0.84
    }
    parts.push(part(CYL, 0xe6eef6, [0, y + 0.22, 0], [0.012, 0.44, 0.012]))
    parts.push(part(SPHERE, 0x7ff0ff, [0, y + 0.45, 0], [0.02, 0.02, 0.02]))
    return parts
  },
  sail(r, s = 1) {
    // the white sail, its mast and a little helipad near the top
    return [
      part(SAIL, 0xffffff, [0, 0, 0], [0.5 * s, 0.9 * s, 0.9]),
      part(CYL, 0xdfe6ee, [0.01, 0.48 * s, 0], [0.018, 0.96 * s, 0.018]),
      part(CYL, 0xc8d3dd, [-0.08, 0.72 * s, 0], [0.07, 0.012, 0.07]),
    ]
  },
  ring(r, s = 1) {
    // a hoop-shaped landmark
    return [
      part(new THREE.TorusGeometry(0.22 * s, 0.045, 10, 32), 0xffd166, [0, 0.3 * s, 0]),
      part(CYL, 0xdfe6ee, [0, 0.04, 0], [0.12, 0.08, 0.12]),
    ]
  },
  park() {
    const parts = [part(CYL, 0x8fdc72, [0, 0.01, 0], [0.16, 0.02, 0.16]), part(CYL, 0xd9f6ff, [0, 0.03, 0], [0.06, 0.02, 0.06]), part(CYL, 0xffffff, [0, 0.06, 0], [0.012, 0.06, 0.012])]
    return parts
  },
}

// What stands on an island with this many bridges. Slot 0 is the middle; slots
// 1-5 ring it; 6-13 sit near the shore.
const PLAN = [
  { 0: 'cottage', 6: 'tree', 9: 'tree' },
  { 0: 'cottage', 2: 'cottage', 6: 'tree', 9: 'tree', 12: 'tree' },
  { 0: 'house', 1: 'cottage', 3: 'shop', 6: 'tree', 8: 'tree', 11: 'tree', 13: 'park' },
  { 0: 'clock', 1: 'house', 2: 'shop', 3: 'apartment', 4: 'cottage', 6: 'tree', 9: 'tree', 11: 'tree' },
  { 0: 'glass', 1: 'apartment', 2: 'apartment', 3: 'shop', 4: 'house', 5: 'shop', 7: 'tree', 10: 'tree', 12: 'park' },
  { 0: 'skyscraper', 1: 'glass', 2: 'apartment', 3: 'glass', 4: 'apartment', 5: 'shop', 7: 'tree', 9: 'park', 12: 'tree' },
  { 0: 'skyscraper', 1: 'twist', 2: 'glass', 3: 'skyscraper', 4: 'apartment', 5: 'glass', 7: 'palm', 9: 'park', 11: 'palm', 13: 'palm' },
  { 0: 'spire', 1: 'twist', 2: 'glass', 3: 'sail', 4: 'skyscraper', 5: 'glass', 6: 'palm', 8: 'palm', 10: 'ring', 12: 'palm' },
  { 0: 'spire', 1: 'twist', 2: 'skyscraper', 3: 'sail', 4: 'twist', 5: 'glass', 6: 'palm', 8: 'ring', 10: 'palm', 12: 'palm', 13: 'park' },
]
const SLOTS = [[0, 0], ...[0, 1, 2, 3, 4].map((k) => [0.46, k * 1.2566 + 0.6]), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [0.8, k * 0.785 + 0.2])]
// taller buildings get a little taller as the city grows
// buildings are drawn at this size on an island of radius 1
const SIZE = 1.55
const GROW = { apartment: [1, 1.15, 1.3], glass: [0.85, 1, 1.15], skyscraper: [0.85, 1, 1.15], twist: [0.8, 0.95, 1.05], spire: [0.85, 0.9, 1], sail: [0.9, 0.9, 1], ring: [1, 1, 1] }

export class City {
  constructor(seed) {
    this.group = new THREE.Group()
    this.seed = seed
    this.slots = SLOTS.map(() => null) // { key, group, t, dying }
    this.tier = -1
    this.retiring = []
  }

  setTier(tier) {
    tier = Math.max(0, Math.min(PLAN.length - 1, tier))
    if (tier === this.tier) return false
    const growing = tier > this.tier
    this.tier = tier
    const plan = PLAN[tier]
    const stretch = tier >= 7 ? 2 : tier >= 5 ? 1 : 0
    let delay = 0
    SLOTS.forEach(([rad, ang], i) => {
      const kind = plan[i] ?? null
      const scale = GROW[kind]?.[stretch] ?? 1
      const key = kind && `${kind}-${scale}`
      const cur = this.slots[i]
      if ((cur?.key ?? null) === key) return
      if (cur) { cur.t = 0; this.retiring.push(cur) }
      this.slots[i] = null
      if (!kind) return
      const r = seeded(this.seed * 31 + i * 7 + (kind.length * 13))
      const group = baked(KITS[kind](r, scale), { line: LINE, width: 0.008 })
      group.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad)
      group.rotation.y = -ang + Math.PI / 2 + (r() - 0.5) * 0.4
      group.scale.set(SIZE, 0.001, SIZE)
      this.group.add(group)
      this.slots[i] = { key, group, t: 0, delay: growing ? delay : delay * 0.5 }
      delay += 0.07
    })
    return true
  }

  update(dt) {
    for (const s of this.slots) {
      if (!s) continue
      if (s.delay > 0) { s.delay -= dt; continue }
      if (s.t < 1) {
        s.t = Math.min(1, s.t + dt / 0.5)
        const k = s.t
        const back = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2 // ease out, overshooting
        s.group.scale.set(SIZE * (1 + Math.sin(k * Math.PI) * 0.08), SIZE * Math.max(0.001, back), SIZE * (1 + Math.sin(k * Math.PI) * 0.08))
      }
    }
    if (this.retiring.length) {
      for (const s of this.retiring) {
        s.t += dt / 0.3
        s.group.scale.set(SIZE * (1 - s.t * 0.3), SIZE * Math.max(0.001, 1 - s.t), SIZE * (1 - s.t * 0.3))
        if (s.t >= 1) s.group.removeFromParent()
      }
      this.retiring = this.retiring.filter((s) => s.t < 1)
    }
  }

  // jump straight to the finished look (for a restored game)
  settle() {
    for (const s of this.slots) if (s) { s.t = 1; s.delay = 0; s.group.scale.setScalar(SIZE) }
    for (const s of this.retiring) s.group.removeFromParent()
    this.retiring = []
  }
}

// A round island: a sandy beach under a soft grassy top, slightly irregular.
export function makeIsland(radius, seed) {
  const r = seeded(seed)
  const group = new THREE.Group()
  const wobble = (geo, amount) => {
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      const a = Math.atan2(z, x)
      const k = 1 + Math.sin(a * 3 + seed) * amount + Math.sin(a * 5 + seed * 2) * amount * 0.6
      p.setX(i, x * k)
      p.setZ(i, z * k)
    }
    geo.computeVertexNormals()
    return geo
  }
  const sand = new THREE.Mesh(wobble(new THREE.CylinderGeometry(radius * 1.12, radius * 1.24, 0.16, 48, 2), 0.035), toonMat(0xf6dfae))
  sand.position.y = -0.04
  sand.receiveShadow = true
  const grass = new THREE.Mesh(wobble(new THREE.CylinderGeometry(radius * 0.98, radius * 1.04, 0.07, 48, 1), 0.04), toonMat(0x9edc78))
  grass.position.y = 0.07
  grass.receiveShadow = true
  group.add(sand, grass)
  // a few pebbles on the beach
  for (let k = 0; k < 5; k++) {
    const a = r() * Math.PI * 2
    const p = new THREE.Mesh(SPHERE, toonMat(0xe9e2d6))
    p.position.set(Math.cos(a) * radius * 1.1, 0.04, Math.sin(a) * radius * 1.1)
    p.scale.set(0.03, 0.018, 0.025)
    group.add(p)
  }
  return group
}
const toonMat = (c) => toon(c)
