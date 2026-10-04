import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { part, merge, toon, outline, seeded } from './look.js'

// The islands themselves. Each one is a little plateau with layered cliffs, a
// grassy top that drips over the edge, a sandy beach curving out on one side
// with a dock and a rowboat, rocks along the cliffs, and the animals that live
// there wandering the beach. Something drifts through the air above it too:
// petals, snow, leaves or butterflies, depending on its biome.

const LINE = 0x5e4a58
const SPHERE = new THREE.SphereGeometry(1, 16, 12)
const CAPSULE = new THREE.CapsuleGeometry(1, 1, 4, 12)
const CONE = new THREE.ConeGeometry(1, 1, 12)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const ROCK = new THREE.DodecahedronGeometry(1, 1)
const DOME = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)
const PETAL = new THREE.CircleGeometry(1, 8)
const SOFT = new RoundedBoxGeometry(1, 1, 1, 2, 0.3)

// colours of the cliff layers (top to bottom), the beach, and who lives here
export const LOOKS = {
  meadow: { strata: [0xf2d3a0, 0xe4bb88, 0xcfa07a], sand: 0xfbe7bb, path: 0xf6e2b8, critter: 'sheep', air: 'butterfly', decor: ['flower', 'flower', 'mushroom'] },
  tropical: { strata: [0xfbe6b8, 0xf0cf98, 0xdfb684], sand: 0xfff1cc, path: 0xfff3d2, critter: 'crab', air: null, decor: ['hibiscus', 'hibiscus', 'flower'] },
  snowy: { strata: [0xe4ecf7, 0xc8d6ea, 0xaabcd6], sand: 0xf6f9ff, path: 0xd6e2f2, critter: 'penguin', air: 'snow', decor: ['mound', 'crystal', 'mound'] },
  blossom: { strata: [0xf6dcc8, 0xeac4b4, 0xd6a9ae], sand: 0xfdebd2, path: 0xf9dccb, critter: 'bunny', air: 'petal', decor: ['petals', 'flower', 'petals'] },
  desert: { strata: [0xf3b47c, 0xdd8d5e, 0xc4704e], sand: 0xfff0cc, path: 0xe8b585, critter: 'tortoise', air: null, decor: ['pebbles', 'barrel', 'pebbles'] },
  autumn: { strata: [0xedcf9e, 0xd8ae7b, 0xbd916a], sand: 0xf8e2b6, path: 0xebcb9c, critter: 'hedgehog', air: 'leaf', decor: ['mushroom', 'leaves', 'mushroom'] },
}

// little things dotted around the top of an island, about 0.03 across
const DECOR = {
  flower: (r) => {
    const c = [0xffffff, 0xffd166, 0xff9fb8, 0xc7a3ff][Math.floor(r() * 4)]
    return [part(CYL, 0x6cbf5f, [0, 0.012, 0], [0.003, 0.024, 0.003]), ...[0, 1, 2, 3, 4].map((k) => part(SPHERE, c, [Math.cos(k * 1.256) * 0.008, 0.026, Math.sin(k * 1.256) * 0.008], [0.0065, 0.004, 0.0065])), part(SPHERE, 0xffb347, [0, 0.028, 0], [0.005, 0.004, 0.005])]
  },
  hibiscus: (r) => {
    const c = r() < 0.5 ? 0xff5f6d : 0xffb347
    return [part(SPHERE, 0x5fbf6a, [0, 0.01, 0], [0.018, 0.012, 0.018]), ...[0, 1, 2, 3, 4].map((k) => part(SPHERE, c, [Math.cos(k * 1.256) * 0.01, 0.022, Math.sin(k * 1.256) * 0.01], [0.009, 0.004, 0.009])), part(SPHERE, 0xffe066, [0, 0.025, 0], [0.004, 0.006, 0.004])]
  },
  mushroom: (r) => {
    const s = 0.8 + r() * 0.5
    return [part(CYL, 0xfff6ea, [0, 0.01 * s, 0], [0.006 * s, 0.02 * s, 0.006 * s]), part(DOME, 0xe8506b, [0, 0.018 * s, 0], [0.016 * s, 0.013 * s, 0.016 * s]), part(SPHERE, 0xffffff, [0.006 * s, 0.028 * s, 0.004 * s], [0.003, 0.002, 0.003]), part(SPHERE, 0xffffff, [-0.006 * s, 0.026 * s, -0.004 * s], [0.003, 0.002, 0.003])]
  },
  mound: (r) => [part(SPHERE, 0xffffff, [0, 0, 0], [0.03 + r() * 0.01, 0.018, 0.026]), part(SPHERE, 0xffffff, [0.022, 0, 0.008], [0.016, 0.012, 0.015])],
  crystal: () => [part(CONE, 0xbfe6ff, [0, 0.016, 0], [0.008, 0.034, 0.008]), part(CONE, 0xd9f2ff, [0.01, 0.011, 0.004], [0.006, 0.022, 0.006], [0, 0, -0.4]), part(CONE, 0xa9dcff, [-0.009, 0.01, -0.003], [0.006, 0.02, 0.006], [0, 0, 0.4])],
  petals: () => [0, 1, 2, 3, 4, 5].map((k) => part(SPHERE, k % 2 ? 0xffb7cf : 0xffd3e2, [Math.cos(k * 2.4) * 0.016, 0.002, Math.sin(k * 2.4) * 0.016], [0.009, 0.003, 0.007], [0, k, 0])),
  pebbles: (r) => [part(ROCK, 0xd99b6a, [0, 0.006, 0], [0.014, 0.01, 0.012], [r(), r(), 0]), part(ROCK, 0xc4704e, [0.016, 0.004, 0.006], [0.009, 0.007, 0.009], [r(), r(), 0])],
  barrel: () => [part(SPHERE, 0x6cc47a, [0, 0.014, 0], [0.016, 0.016, 0.016]), part(SPHERE, 0xff8fb8, [0, 0.03, 0], [0.006, 0.004, 0.006])],
  leaves: () => [0, 1, 2, 3, 4].map((k) => part(SPHERE, [0xff9a3d, 0xf26b4a, 0xffc24d][k % 3], [Math.cos(k * 2.4) * 0.014, 0.003, Math.sin(k * 2.4) * 0.014], [0.011, 0.003, 0.007], [0, k, 0])),
}
const DIRECTION = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }

/* ---------- critters: all face +x, about 0.07 long ---------- */

const eyes = (x, y, z, s = 0.008) => [part(SPHERE, 0x3a2a30, [x, y, z], [s, s, s]), part(SPHERE, 0x3a2a30, [x, y, -z], [s, s, s])]
const legs = (color, h = 0.016) => [[-0.018, 0.016], [-0.018, -0.016], [0.018, 0.016], [0.018, -0.016]].map(([x, z]) => part(CYL, color, [x, h / 2, z], [0.007, h, 0.007]))

const CRITTERS = {
  sheep: () => [
    ...legs(0x4a3d48),
    ...[[0, 0.042, 0, 0.032], [-0.022, 0.04, 0.012, 0.022], [-0.022, 0.04, -0.012, 0.022], [0.016, 0.046, 0.012, 0.02], [0.016, 0.046, -0.012, 0.02], [0, 0.06, 0, 0.022]].map(([x, y, z, s]) => part(SPHERE, 0xffffff, [x, y, z], [s, s, s])),
    part(SPHERE, 0x4a3d48, [0.04, 0.05, 0], [0.016, 0.017, 0.014]),
    part(SPHERE, 0x4a3d48, [0.036, 0.058, 0.015], [0.009, 0.004, 0.006], [0, 0, -0.4]),
    part(SPHERE, 0x4a3d48, [0.036, 0.058, -0.015], [0.009, 0.004, 0.006], [0, 0, -0.4]),
    ...eyes(0.05, 0.054, 0.008, 0.004),
  ],
  crab: () => [
    part(SPHERE, 0xff7a5c, [0, 0.016, 0], [0.026, 0.014, 0.032]),
    part(SPHERE, 0xff7a5c, [0.026, 0.02, 0.03], [0.012, 0.01, 0.01]),
    part(SPHERE, 0xff7a5c, [0.026, 0.02, -0.03], [0.012, 0.01, 0.01]),
    part(CYL, 0xff7a5c, [0.012, 0.032, 0.008], [0.0025, 0.016, 0.0025]),
    part(CYL, 0xff7a5c, [0.012, 0.032, -0.008], [0.0025, 0.016, 0.0025]),
    part(SPHERE, 0xffffff, [0.012, 0.042, 0.008], [0.006, 0.006, 0.006]),
    part(SPHERE, 0xffffff, [0.012, 0.042, -0.008], [0.006, 0.006, 0.006]),
    part(SPHERE, 0x3a2a30, [0.016, 0.043, 0.008], [0.003, 0.003, 0.003]),
    part(SPHERE, 0x3a2a30, [0.016, 0.043, -0.008], [0.003, 0.003, 0.003]),
  ],
  penguin: () => [
    part(CAPSULE, 0x3d4560, [0, 0.04, 0], [0.02, 0.03, 0.019]),
    part(SPHERE, 0xffffff, [0.01, 0.036, 0], [0.013, 0.024, 0.015]),
    part(CONE, 0xffa23d, [0.026, 0.058, 0], [0.006, 0.014, 0.006], [0, 0, -Math.PI / 2]),
    part(SPHERE, 0xffa23d, [0.008, 0.004, 0.009], [0.009, 0.004, 0.006]),
    part(SPHERE, 0xffa23d, [0.008, 0.004, -0.009], [0.009, 0.004, 0.006]),
    part(SPHERE, 0x3d4560, [0, 0.036, 0.021], [0.006, 0.018, 0.004], [0.3, 0, 0]),
    part(SPHERE, 0x3d4560, [0, 0.036, -0.021], [0.006, 0.018, 0.004], [-0.3, 0, 0]),
    ...eyes(0.017, 0.064, 0.008, 0.0035),
    part(SPHERE, 0xff9db6, [0.017, 0.054, 0.013], [0.003, 0.003, 0.003]),
    part(SPHERE, 0xff9db6, [0.017, 0.054, -0.013], [0.003, 0.003, 0.003]),
  ],
  bunny: () => [
    part(SPHERE, 0xffffff, [-0.006, 0.022, 0], [0.024, 0.02, 0.02]),
    part(SPHERE, 0xffffff, [0.02, 0.038, 0], [0.016, 0.015, 0.015]),
    part(CAPSULE, 0xffffff, [0.014, 0.064, 0.007], [0.0045, 0.013, 0.0045], [0.15, 0, 0.2]),
    part(CAPSULE, 0xffffff, [0.014, 0.064, -0.007], [0.0045, 0.013, 0.0045], [-0.15, 0, 0.2]),
    part(CAPSULE, 0xffb7cf, [0.016, 0.064, 0.007], [0.002, 0.009, 0.002], [0.15, 0, 0.2]),
    part(CAPSULE, 0xffb7cf, [0.016, 0.064, -0.007], [0.002, 0.009, 0.002], [-0.15, 0, 0.2]),
    part(SPHERE, 0xffffff, [-0.03, 0.026, 0], [0.008, 0.008, 0.008]),
    part(SPHERE, 0xff8fb0, [0.035, 0.038, 0], [0.003, 0.003, 0.003]),
    ...eyes(0.03, 0.043, 0.007, 0.003),
  ],
  tortoise: () => [
    ...legs(0x9fcf7a, 0.012),
    part(DOME, 0x5faa6a, [0, 0.01, 0], [0.03, 0.026, 0.026]),
    part(SPHERE, 0x7cc07a, [0, 0.03, 0], [0.012, 0.006, 0.012]),
    part(CYL, 0xf2d79b, [0, 0.011, 0], [0.031, 0.004, 0.027]),
    part(SPHERE, 0x9fcf7a, [0.036, 0.02, 0], [0.011, 0.01, 0.01]),
    ...eyes(0.044, 0.024, 0.005, 0.0025),
  ],
  hedgehog: () => [
    part(SPHERE, 0x8a5a44, [-0.004, 0.022, 0], [0.026, 0.02, 0.022]),
    ...[0, 1, 2, 3, 4, 5, 6].map((k) => part(CONE, 0x6e4636, [-0.01 + Math.cos(k) * 0.006, 0.036 + Math.sin(k * 2) * 0.004, (k - 3) * 0.006], [0.006, 0.016, 0.006], [(k - 3) * 0.25, 0, 0.9])),
    part(SPHERE, 0xf3d6b0, [0.02, 0.02, 0], [0.013, 0.012, 0.013]),
    part(SPHERE, 0x3a2a30, [0.034, 0.021, 0], [0.004, 0.004, 0.004]),
    ...eyes(0.026, 0.027, 0.006, 0.0028),
  ],
}

const critterGeos = new Map()
function critterGeo(kind) {
  if (!critterGeos.has(kind)) critterGeos.set(kind, merge(CRITTERS[kind]()))
  return critterGeos.get(kind)
}

const BOAT = merge([
  part(SPHERE, 0xffffff, [0, 0.0, 0], [0.085, 0.038, 0.04]),
  part(SPHERE, 0xff8270, [0, -0.008, 0], [0.087, 0.03, 0.042]),
  part(SPHERE, 0xa8714a, [0, 0.022, 0], [0.068, 0.012, 0.03]),
  part(BOX, 0xd9a273, [0.0, 0.03, 0], [0.012, 0.006, 0.06]),
  part(CYL, 0xc98d55, [-0.02, 0.04, 0.02], [0.004, 0.06, 0.004], [0.9, 0, 0.3]),
])

/* ---------- the island ---------- */

export class Island {
  constructor(radius, seed, biome, top) {
    const look = LOOKS[biome]
    const r = seeded(seed)
    this.group = new THREE.Group()
    this.radius = radius
    this.look = look
    const bulge = (a) => 1 + Math.sin(a * 3 + seed) * 0.035 + Math.sin(a * 5 + seed * 2) * 0.02 + Math.sin(a * 2 + seed * 3) * 0.025
    const cliff = (a) => radius * 1.15 * bulge(a)

    // a beach curving out on one side: never toward a bridge (those leave
    // straight up, down, left or right) or under the number badge (front right)
    const beachAt = [Math.PI * 0.75, -Math.PI * 0.25, -Math.PI * 0.75][Math.floor(r() * 3)] + (r() - 0.5) * 0.25
    const beachHalf = 0.5
    const beachWide = radius * (0.32 + r() * 0.12)
    const around = (a) => Math.atan2(Math.sin(a - beachAt), Math.cos(a - beachAt))
    const beachBump = (a) => {
      const d = Math.abs(around(a)) / beachHalf
      return d >= 1 ? 0 : Math.cos(d * Math.PI / 2) ** 2
    }
    // how far the shore is from the middle at this angle: the sea foams along it
    this.shore = (a) => cliff(a) + beachWide * beachBump(a) + 0.02

    // the cliffs, in layers stepping in toward the top
    const steps = [[0, -0.3], [1.13, -0.3], [1.15, -0.03], [1.13, 0.0], [1.125, 0.055], [1.1, 0.07], [1.09, 0.115], [1.06, 0.13], [1.05, 0.18], [0, 0.18]]
    const pts = steps.map(([x, y]) => new THREE.Vector2(Math.max(0.001, x * radius), y))
    const body = new THREE.LatheGeometry(pts, 64)
    const pos = body.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const strata = look.strata.map((c) => new THREE.Color(c))
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const k = bulge(Math.atan2(z, x))
      pos.setX(i, x * k)
      pos.setZ(i, z * k)
      const c = y > 0.1 ? strata[0] : y > 0.04 ? strata[1] : strata[2]
      colors.set([c.r, c.g, c.b], i * 3)
    }
    body.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    body.computeVertexNormals()
    const bodyMesh = new THREE.Mesh(body, toon(0xffffff, { vertexColors: true, rim: 0.18 }))
    bodyMesh.receiveShadow = true
    this.group.add(bodyMesh, new THREE.Mesh(body, outline(LINE, 0.012)))

    // grassy (or snowy, or sandy) top that drips over the edge
    const topGeo = new THREE.CylinderGeometry(radius * 1.0, radius * 1.05, 0.05, 64)
    const tp = topGeo.attributes.position
    for (let i = 0; i < tp.count; i++) {
      const k = bulge(Math.atan2(tp.getZ(i), tp.getX(i)))
      tp.setX(i, tp.getX(i) * k)
      tp.setZ(i, tp.getZ(i) * k)
    }
    topGeo.computeVertexNormals()
    const topMesh = new THREE.Mesh(topGeo, toon(top.top, { rim: 0.15 }))
    topMesh.position.y = 0.18
    topMesh.receiveShadow = true
    this.group.add(topMesh)
    const drips = []
    const n = Math.round(12 + radius * 12)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.2
      const rr = radius * 1.045 * bulge(a)
      drips.push(part(CAPSULE, top.drip, [Math.cos(a) * rr, 0.15, Math.sin(a) * rr], [0.028, 0.02 + r() * 0.045, 0.028]))
    }
    const dripMesh = new THREE.Mesh(merge(drips), toon(0xffffff, { vertexColors: true, rim: 0.15 }))
    dripMesh.receiveShadow = true
    this.group.add(dripMesh)

    // flowers, mushrooms and such around the edge of the top, clear of the
    // four directions the bridges and footpaths come from
    const decor = []
    for (let k = 0; k < 12; k++) {
      const a = r() * Math.PI * 2
      const off = Math.abs(((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2) - Math.PI / 4)
      if (off > Math.PI / 4 - 0.3) continue
      const d = radius * (0.86 + r() * 0.1) * bulge(a)
      for (const g of DECOR[look.decor[k % 3]](r)) decor.push(g.applyMatrix4(new THREE.Matrix4().makeScale(1.6, 1.6, 1.6).premultiply(new THREE.Matrix4().makeTranslation(Math.cos(a) * d, 0.205, Math.sin(a) * d))))
    }
    if (decor.length) {
      const geo = merge(decor)
      const m = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true }))
      m.castShadow = true
      this.group.add(m, new THREE.Mesh(geo, outline(LINE, 0.003)))
    }

    // footpaths from each bridge into town, hidden until a bridge arrives
    this.paths = {}
    for (const [dir, a] of Object.entries(DIRECTION)) {
      const outer = radius * 1.04 * bulge(a), inner = radius * 0.5
      const len = outer - inner
      const stones = []
      stones.push(part(SOFT, look.strata[1], [-len / 2, 0, 0], [len, 0.008, 0.1]))
      stones.push(part(SOFT, look.path, [-len / 2, 0.003, 0], [len, 0.01, 0.08]))
      for (let k = 0; k < Math.floor(len / 0.05); k++) stones.push(part(SOFT, 0xffffff, [-0.028 - k * 0.05, 0.007, (k % 2 ? 1 : -1) * 0.016], [0.026, 0.008, 0.022]))
      const geo = merge(stones)
      const pivot = new THREE.Group()
      pivot.rotation.y = -a
      const g = new THREE.Group()
      g.position.set(outer, 0.207, 0)
      const m = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, rim: 0.05 }))
      m.receiveShadow = true
      g.add(m)
      g.scale.set(0.001, 1, 1)
      g.visible = false
      pivot.add(g)
      this.group.add(pivot)
      this.paths[dir] = { g, k: 0, on: false }
    }

    // the beach: a soft slab of sand from under the cliff out into the sea
    const shape = new THREE.Shape()
    const a0 = beachAt - beachHalf - 0.05, a1 = beachAt + beachHalf + 0.05
    const N = 40
    for (let k = 0; k <= N; k++) {
      const a = a0 + (a1 - a0) * (k / N)
      const d = Math.max(cliff(a) * 0.98, this.shore(a) - 0.03)
      const fn = k ? 'lineTo' : 'moveTo'
      shape[fn](Math.cos(a) * d, -Math.sin(a) * d)
    }
    for (let k = N; k >= 0; k--) {
      const a = a0 + (a1 - a0) * (k / N)
      shape.lineTo(Math.cos(a) * radius * 0.8, -Math.sin(a) * radius * 0.8)
    }
    const beach = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.025, bevelSegments: 3, curveSegments: 4 })
    beach.rotateX(-Math.PI / 2).translate(0, -0.03, 0)
    const beachMesh = new THREE.Mesh(beach, toon(look.sand, { rim: 0.12 }))
    beachMesh.receiveShadow = true
    this.group.add(beachMesh, new THREE.Mesh(beach, outline(LINE, 0.008)))
    this.beachY = 0.03

    // a little dock from the beach out over the water, with a rowboat tied up
    const edge = this.shore(beachAt) - 0.04
    const dockParts = []
    for (let k = 0; k < 5; k++) dockParts.push(part(BOX, k % 2 ? 0xd9a273 : 0xe8b98a, [edge + k * 0.04, 0.045, 0], [0.034, 0.012, 0.07]))
    for (const x of [edge + 0.06, edge + 0.17]) for (const z of [-0.032, 0.032]) dockParts.push(part(CYL, 0xa8714a, [x, 0.01, z], [0.008, 0.09, 0.008]))
    const dockGeo = merge(dockParts)
    const dock = new THREE.Group()
    dock.rotation.y = -beachAt
    const dockMesh = new THREE.Mesh(dockGeo, toon(0xffffff, { vertexColors: true }))
    dockMesh.castShadow = true
    dock.add(dockMesh, new THREE.Mesh(dockGeo, outline(LINE, 0.005)))
    this.boat = new THREE.Group()
    const boatMesh = new THREE.Mesh(BOAT, toon(0xffffff, { vertexColors: true }))
    boatMesh.castShadow = true
    this.boat.add(boatMesh, new THREE.Mesh(BOAT, outline(LINE, 0.005)))
    this.boat.position.set(edge + 0.13, 0.0, 0.085)
    this.boat.rotation.y = 0.15
    dock.add(this.boat)
    this.group.add(dock)

    // rocks along the cliffs, where there is no beach, for the waves to break on
    this.rocks = []
    const rockParts = []
    for (const base of [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.22, Math.PI * 0.78]) {
      if (Math.abs(around(base)) < beachHalf + 0.3 || r() < 0.35) continue
      const a = base + (r() - 0.5) * 0.3
      const size = 0.055 + r() * 0.05
      const d = cliff(a) + size * 0.4
      const x = Math.cos(a) * d, z = Math.sin(a) * d
      rockParts.push(part(ROCK, look.strata[2], [x, 0.0, z], [size, size * 0.9, size * 0.9], [r(), r() * 6, r()]))
      rockParts.push(part(ROCK, look.strata[1], [x + Math.cos(a + 1.4) * size * 1.2, -0.01, z + Math.sin(a + 1.4) * size * 1.2], [size * 0.55, size * 0.5, size * 0.55], [r(), r() * 6, 0]))
      if (biome === 'snowy') rockParts.push(part(SPHERE, 0xffffff, [x, size * 0.65, z], [size * 0.75, size * 0.25, size * 0.7]))
      this.rocks.push({ x, z, r: size * 0.95 })
    }
    if (rockParts.length) {
      const geo = merge(rockParts)
      const rocks = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, rim: 0.15 }))
      rocks.castShadow = rocks.receiveShadow = true
      this.group.add(rocks, new THREE.Mesh(geo, outline(LINE, 0.008)))
    }

    // the locals: two or three animals pottering about on the beach
    this.critters = []
    const geo = critterGeo(look.critter)
    const count = 2 + Math.floor(r() * 2)
    for (let k = 0; k < count; k++) {
      const g = new THREE.Group()
      const m = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true }))
      m.castShadow = true
      g.add(m, new THREE.Mesh(geo, outline(LINE, 0.004)))
      g.scale.setScalar(1.7)
      this.group.add(g)
      const at = (r() - 0.5) * beachHalf * 1.2
      this.critters.push({ g, at, to: at, wait: r() * 2, hop: 0, out: 0.45 + r() * 0.25 })
    }
    this.beachAt = beachAt
    this.beachHalf = beachHalf
    this.cliff = cliff

    // things drifting through the air: petals, snow, leaves or butterflies
    this.air = []
    if (look.air) {
      const color = { petal: 0xffb7cf, snow: 0xffffff, leaf: 0xff9a3d, butterfly: 0xffd166 }[look.air]
      for (let k = 0; k < 6; k++) {
        const mat = new THREE.MeshBasicMaterial({ color: k % 2 && look.air === 'leaf' ? 0xf26b4a : k % 3 === 1 && look.air === 'butterfly' ? 0xff9fb8 : color, side: THREE.DoubleSide })
        let mesh
        if (look.air === 'butterfly') {
          mesh = new THREE.Group()
          for (const s of [-1, 1]) {
            const w = new THREE.Mesh(PETAL, mat)
            w.scale.set(0.014, 0.018, 1)
            w.position.z = s * 0.012
            w.rotation.x = Math.PI / 2
            const pivot = new THREE.Group()
            pivot.add(w)
            mesh.add(pivot)
          }
        } else {
          mesh = new THREE.Mesh(look.air === 'snow' ? SPHERE : PETAL, mat)
          mesh.scale.setScalar(look.air === 'snow' ? 0.009 : 0.014)
        }
        this.group.add(mesh)
        this.air.push({ mesh, t: r() * 10, life: 0, seed: r() })
        this.respawn(this.air[k], r() * 1)
      }
    }
    this.happy = false
    this.time = r() * 10
    this.update(0)
  }

  respawn(p, phase = 0) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * this.radius * 1.1
    p.x = Math.cos(a) * d
    p.z = Math.sin(a) * d
    p.y = 0.35 + Math.random() * 0.45
    p.life = phase * 4
    p.mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0)
  }

  // a happy island's animals bounce about
  setHappy(happy) { this.happy = happy }

  setPaths(dirs) {
    for (const [dir, p] of Object.entries(this.paths)) p.on = dirs.includes(dir)
  }

  update(dt) {
    this.time += dt
    const t = this.time
    this.boat.position.y = Math.sin(t * 1.6) * 0.008
    this.boat.rotation.z = Math.sin(t * 1.3) * 0.08
    for (const p of Object.values(this.paths)) {
      p.k = THREE.MathUtils.clamp(p.k + (p.on ? dt / 0.6 : -dt / 0.3), 0, 1)
      p.g.visible = p.k > 0
      p.g.scale.x = Math.max(0.001, 1 - (1 - p.k) ** 3)
    }
    for (const c of this.critters) {
      if (c.wait > 0) {
        c.wait -= dt
        if (c.wait <= 0) c.to = (Math.random() - 0.5) * this.beachHalf * 1.3
      } else {
        const step = Math.sign(c.to - c.at) * dt * 0.12
        if (Math.abs(c.to - c.at) <= Math.abs(step)) { c.at = c.to; c.wait = 1 + Math.random() * 3 } else c.at += step
      }
      const a = this.beachAt + c.at
      const bump = Math.cos(Math.min(1, Math.abs(c.at) / this.beachHalf) * Math.PI / 2) ** 2
      const d = this.cliff(a) + (this.shore(a) - 0.02 - this.cliff(a)) * c.out * Math.max(0.3, bump) + 0.01
      const moving = c.wait <= 0
      c.hop += dt * (moving ? 14 : this.happy ? 9 : 0)
      const lift = moving || this.happy ? Math.abs(Math.sin(c.hop)) * (this.happy ? 0.03 : 0.012) : 0
      c.g.position.set(Math.cos(a) * d, this.beachY + lift, Math.sin(a) * d)
      // face along the beach while walking, out to sea while resting
      const facing = moving ? -(a + Math.sign(c.to - c.at) * Math.PI / 2) : -a
      c.g.rotation.y = THREE.MathUtils.lerp(c.g.rotation.y, facing, Math.min(1, dt * 8))
    }
    for (const p of this.air) {
      p.life += dt
      const kind = this.look.air
      const fall = kind === 'butterfly' ? 0 : kind === 'snow' ? 0.05 : 0.07
      p.y -= fall * dt
      const sway = kind === 'butterfly' ? 0.1 : 0.05
      p.mesh.position.set(p.x + Math.sin(p.life * 1.3 + p.seed * 6) * sway, p.y + (kind === 'butterfly' ? Math.sin(p.life * 2.2) * 0.05 : 0), p.z + Math.cos(p.life * 1.1 + p.seed * 6) * sway)
      if (kind === 'butterfly') {
        const flap = Math.sin(p.life * 22) * 0.9
        p.mesh.children[0].rotation.x = flap
        p.mesh.children[1].rotation.x = -flap
        p.mesh.rotation.y = p.life * 0.8
        if (p.life > 8) this.respawn(p)
      } else {
        p.mesh.rotation.x += dt * 1.5
        p.mesh.rotation.y += dt * 1.1
        if (p.y < 0.2) this.respawn(p)
      }
    }
  }
}
