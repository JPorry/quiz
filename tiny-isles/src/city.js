import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { part, merge, toon, outline, seeded } from './look.js'

// Each island has a personality: a biome with its own colours, trees and landmark,
// and a face that shows how it feels. Its city grows a step with every bridge: a
// cottage, a village, a town with shops and a clock tower, apartment blocks,
// capsule glass towers, skyscrapers, and at the top a futuristic skyline.
// Everything is chunky, rounded and toy-like, built on an island of radius 1.

const LINE = 0x5e4a58
const WHITE = 0xfffdf8
const GLASS = [0x9fdcff, 0xb5ecff, 0x8fd4ee, 0xc4e4ff, 0xa9f0e6]
const DOOR = 0x9a6648
const PANE = 0x9fdcff

export const BIOMES = {
  meadow: { rock: 0xb9b0c9, top: 0x9edc78, drip: 0x8bd068, side: 0xf6dfae, walls: [0xfff3e2, 0xffe0d2, 0xe2f4ff, 0xfff4bf], roofs: [0xff8270, 0xff9fb8, 0x6fb4ff], tree: 'round', landmark: 'windmill' },
  tropical: { rock: 0xd8c6a8, top: 0xaee887, drip: 0x96dc6e, side: 0xfcebc0, walls: [0xfff6e6, 0xd9fbff, 0xfff0c2, 0xffe2ec], roofs: [0x3fc7c7, 0xff9f68, 0xffd166], tree: 'palm', landmark: 'lighthouse' },
  snowy: { rock: 0xa9b6cc, snowcap: true, top: 0xf4fbff, drip: 0xffffff, side: 0xcdd9ea, walls: [0xffe7d6, 0xd6e9ff, 0xfff4e6, 0xe9e1ff], roofs: [0xd9534f, 0x5a8fd6, 0x7b6aa8], tree: 'pine', landmark: 'snowman' },
  blossom: { rock: 0xc2b3c4, top: 0xc9eda6, drip: 0xffc6d8, side: 0xf3dcc0, walls: [0xfff4ef, 0xffe6ee, 0xfffaf0, 0xf2ecff], roofs: [0xe8506b, 0xff8fb0, 0x8a6aa8], tree: 'cherry', landmark: 'pagoda' },
  desert: { rock: 0xd99b6a, top: 0xf2d79b, drip: 0xe9c482, side: 0xe7b47c, walls: [0xffe9cc, 0xf6c99a, 0xfff2df, 0xf3b88f], roofs: [0xd9784a, 0x3fb6a8, 0xf2a03d], tree: 'cactus', landmark: 'dome' },
  autumn: { rock: 0xb7a69a, top: 0xc2d97a, drip: 0xb0cc66, side: 0xe9cfa0, walls: [0xfff1dc, 0xffe2c4, 0xf7efe2, 0xffe9d6], roofs: [0xc8553d, 0x8a5a44, 0xe08a3c], tree: 'autumn', landmark: 'barn' },
}
export const BIOME_NAMES = Object.keys(BIOMES)

/* ---------- shapes ---------- */

const RBOX = new RoundedBoxGeometry(1, 1, 1, 4, 0.3)
const SOFT = new RoundedBoxGeometry(1, 1, 1, 3, 0.16)
const SPHERE = new THREE.SphereGeometry(1, 18, 14)
const DOME = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const DISC = new THREE.CylinderGeometry(1, 1, 1, 20).rotateX(Math.PI / 2) // faces +z
const CONE = new THREE.ConeGeometry(1, 1, 20)
const CAPSULE = new THREE.CapsuleGeometry(1, 1, 6, 16)
const LOAF = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2) // a rounded roof along x
const TORUS = new THREE.TorusGeometry(1, 0.22, 8, 24)
const ARCH = new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2)
const ROCK = new THREE.DodecahedronGeometry(1, 1)
const SAIL = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(0.6, 0.45, 0.08, 1)
  s.lineTo(0, 1)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3, curveSegments: 18 }).translate(0, 0, -0.12)
})()

const pick = (r, list) => list[Math.floor(r() * list.length)]

// a round window with a white frame, on the face at z
const roundWindow = (x, y, z, s = 1, pane = PANE) => [part(DISC, WHITE, [x, y, z], [0.055 * s, 0.055 * s, 0.02]), part(DISC, pane, [x, y, z + 0.008], [0.038 * s, 0.038 * s, 0.02])]
const archDoor = (x, z, h = 0.12, w = 0.07) => [part(SOFT, DOOR, [x, h / 2, z], [w, h, 0.03]), part(ARCH, DOOR, [x, h, z], [w / 2, w / 2, 0.03]), part(SPHERE, 0xffd166, [x + w * 0.28, h * 0.5, z + 0.018], [0.008, 0.008, 0.008])]

/* ---------- trees, by biome ---------- */

const TREES = {
  round(r) {
    const c = pick(r, [0x6ccf6b, 0x8fdc72, 0x5bc070]), s = 0.85 + r() * 0.35
    return [part(CYL, 0xb07a52, [0, 0.07 * s, 0], [0.03 * s, 0.14 * s, 0.03 * s]), part(SPHERE, c, [0, 0.2 * s, 0], [0.12 * s, 0.12 * s, 0.12 * s]), part(SPHERE, c, [0.07 * s, 0.26 * s, 0.02], [0.08 * s, 0.08 * s, 0.08 * s]), part(SPHERE, c, [-0.07 * s, 0.24 * s, -0.02], [0.08 * s, 0.08 * s, 0.08 * s])]
  },
  autumn(r) {
    const c = pick(r, [0xff9a3d, 0xf26b4a, 0xffc24d]), s = 0.85 + r() * 0.35
    return [part(CYL, 0x9a6648, [0, 0.07 * s, 0], [0.03 * s, 0.14 * s, 0.03 * s]), part(SPHERE, c, [0, 0.2 * s, 0], [0.12 * s, 0.12 * s, 0.12 * s]), part(SPHERE, c, [0.07 * s, 0.26 * s, 0.02], [0.08 * s, 0.08 * s, 0.08 * s]), part(SPHERE, 0xff7d5a, [-0.06 * s, 0.25 * s, 0], [0.07 * s, 0.07 * s, 0.07 * s])]
  },
  cherry(r) {
    const s = 0.85 + r() * 0.35
    return [part(CYL, 0x8a5a44, [0, 0.08 * s, 0], [0.028 * s, 0.16 * s, 0.028 * s]), part(SPHERE, 0xffb7cf, [0, 0.22 * s, 0], [0.13 * s, 0.11 * s, 0.13 * s]), part(SPHERE, 0xffd3e2, [0.08 * s, 0.27 * s, 0], [0.08 * s, 0.07 * s, 0.08 * s]), part(SPHERE, 0xff9fbe, [-0.07 * s, 0.26 * s, 0.03], [0.07 * s, 0.06 * s, 0.07 * s])]
  },
  pine(r) {
    const s = 0.85 + r() * 0.35
    return [part(CYL, 0x8a5a44, [0, 0.05 * s, 0], [0.025 * s, 0.1 * s, 0.025 * s]), part(CONE, 0x3f9e6a, [0, 0.16 * s, 0], [0.13 * s, 0.16 * s, 0.13 * s]), part(CONE, 0x4fb07a, [0, 0.25 * s, 0], [0.1 * s, 0.14 * s, 0.1 * s]), part(CONE, WHITE, [0, 0.32 * s, 0], [0.06 * s, 0.08 * s, 0.06 * s])]
  },
  palm(r) {
    const s = 0.9 + r() * 0.3, lean = (r() - 0.5) * 0.4
    const parts = []
    for (let k = 0; k < 4; k++) parts.push(part(CYL, k % 2 ? 0xd9a067 : 0xc98d55, [lean * k * 0.03, 0.04 + k * 0.08 * s, 0], [0.026 * s, 0.085 * s, 0.026 * s], [0, 0, -lean]))
    const top = [lean * 0.12, 0.34 * s, 0]
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      parts.push(part(SPHERE, 0x55c06a, [top[0] + Math.cos(a) * 0.08 * s, top[1] - 0.01, Math.sin(a) * 0.08 * s], [0.1 * s, 0.022 * s, 0.04 * s], [0, -a, -0.35]))
    }
    for (const a of [0.4, 2.5, 4.3]) parts.push(part(SPHERE, 0x8a5a3a, [top[0] + Math.cos(a) * 0.025, top[1] - 0.03, Math.sin(a) * 0.025], [0.022, 0.022, 0.022]))
    return parts
  },
  cactus(r) {
    const s = 0.85 + r() * 0.35
    return [
      part(CAPSULE, 0x6cc47a, [0, 0.16 * s, 0], [0.05 * s, 0.17 * s, 0.05 * s]),
      part(CAPSULE, 0x6cc47a, [0.07 * s, 0.17 * s, 0], [0.028 * s, 0.05 * s, 0.028 * s]),
      part(CAPSULE, 0x6cc47a, [-0.07 * s, 0.13 * s, 0], [0.026 * s, 0.04 * s, 0.026 * s]),
      part(SPHERE, 0xff8fb8, [0, 0.31 * s, 0], [0.03 * s, 0.022 * s, 0.03 * s]),
    ]
  },
}

/* ---------- landmarks: one per biome, so every island has its own look ---------- */

// Each landmark returns { parts, spin? } where spin is a mesh that turns forever.
const LANDMARKS = {
  windmill() {
    const parts = [part(CYL, WHITE, [0, 0.2, 0], [0.09, 0.4, 0.09]), part(CONE, 0xff8270, [0, 0.47, 0], [0.12, 0.16, 0.12]), ...archDoor(0, 0.085, 0.09, 0.05), ...roundWindow(0, 0.28, 0.09, 0.7)]
    const blades = merge([0, 1].map((k) => part(SOFT, 0xffd9a6, [0, 0, 0], [0.04, 0.34, 0.012], [0, 0, k * Math.PI / 2])))
    return { parts, spin: { geometry: blades, at: [0, 0.37, 0.11] } }
  },
  lighthouse() {
    const parts = []
    for (let k = 0; k < 4; k++) parts.push(part(CYL, k % 2 ? 0xff6f6f : WHITE, [0, 0.06 + k * 0.1, 0], [0.085 - k * 0.008, 0.1, 0.085 - k * 0.008]))
    parts.push(part(CYL, 0xfff1a8, [0, 0.47, 0], [0.055, 0.07, 0.055]), part(DOME, 0xff6f6f, [0, 0.505, 0], [0.065, 0.06, 0.065]), part(CYL, WHITE, [0, 0.43, 0], [0.08, 0.015, 0.08]))
    return { parts, glow: [0, 0.47, 0] }
  },
  snowman() {
    return { parts: [
      part(SPHERE, WHITE, [0, 0.08, 0], [0.09, 0.08, 0.09]), part(SPHERE, WHITE, [0, 0.19, 0], [0.065, 0.06, 0.065]),
      part(CONE, 0xff8a2e, [0, 0.19, 0.08], [0.012, 0.05, 0.012], [Math.PI / 2, 0, 0]),
      part(SPHERE, 0x3a2a2a, [-0.022, 0.21, 0.058], [0.009, 0.009, 0.009]), part(SPHERE, 0x3a2a2a, [0.022, 0.21, 0.058], [0.009, 0.009, 0.009]),
      part(TORUS, 0xe8506b, [0, 0.14, 0], [0.06, 0.06, 0.06], [Math.PI / 2, 0, 0]),
      part(CYL, 0x4a3d48, [0, 0.26, 0], [0.045, 0.012, 0.045]), part(CYL, 0x4a3d48, [0, 0.29, 0], [0.032, 0.05, 0.032]),
    ] }
  },
  pagoda() {
    const parts = []
    let y = 0
    for (let k = 0; k < 3; k++) {
      const w = 0.17 - k * 0.035
      parts.push(part(RBOX, 0xfff4ef, [0, y + 0.05, 0], [w, 0.1, w]))
      parts.push(part(CONE, 0xe8506b, [0, y + 0.13, 0], [w * 0.95, 0.07, w * 0.95], [0, Math.PI / 4, 0]))
      y += 0.12
    }
    parts.push(part(CYL, 0xffd166, [0, y + 0.05, 0], [0.006, 0.09, 0.006]))
    return { parts }
  },
  dome() {
    return { parts: [part(RBOX, 0xfff2df, [0, 0.07, 0], [0.22, 0.14, 0.22]), part(SPHERE, 0x3fb6a8, [0, 0.17, 0], [0.09, 0.1, 0.09]), part(CONE, 0xffd166, [0, 0.29, 0], [0.02, 0.06, 0.02]), ...archDoor(0, 0.112, 0.08, 0.05)] }
  },
  barn() {
    return { parts: [
      part(RBOX, 0xd9534f, [0, 0.1, 0], [0.26, 0.2, 0.2]), part(LOAF, 0x8a4a3a, [0, 0.2, 0], [0.3, 0.16, 0.24]),
      part(SOFT, WHITE, [0, 0.07, 0.102], [0.1, 0.12, 0.01]), part(SOFT, 0xd9534f, [0, 0.07, 0.106], [0.07, 0.09, 0.01]),
      part(SPHERE, 0xff8a2e, [0.18, 0.035, 0.08], [0.045, 0.035, 0.045]), part(SPHERE, 0xffa04d, [0.13, 0.03, 0.14], [0.035, 0.028, 0.035]),
    ] }
  },
}

/* ---------- buildings ---------- */

function chimney(x, y, z, color) {
  return [part(SOFT, color, [x, y, z], [0.05, 0.1, 0.05]), part(SOFT, WHITE, [x, y + 0.05, z], [0.06, 0.02, 0.06])]
}

const KITS = {
  cottage(r, s, b) {
    const wall = pick(r, b.walls), roof = pick(r, b.roofs)
    const w = 0.34, h = 0.24, d = 0.3
    return { parts: [
      part(RBOX, wall, [0, h / 2, 0], [w, h, d]),
      part(LOAF, roof, [0, h, 0], [w * 1.18, 0.2, d * 1.18]),
      ...chimney(w * 0.25, h + 0.1, -d * 0.15, roof),
      ...archDoor(-w * 0.18, d / 2 + 0.006),
      ...roundWindow(w * 0.2, h * 0.55, d / 2 + 0.006),
      part(SOFT, 0xa8714a, [w * 0.2, h * 0.3, d / 2 + 0.02], [0.1, 0.025, 0.03]),
      part(SPHERE, 0xff8fb8, [w * 0.17, h * 0.34, d / 2 + 0.03], [0.018, 0.018, 0.018]), part(SPHERE, 0xffd166, [w * 0.24, h * 0.34, d / 2 + 0.03], [0.018, 0.018, 0.018]),
    ], smoke: [w * 0.25, h + 0.17, -d * 0.15] }
  },
  house(r, s, b) {
    const wall = pick(r, b.walls), roof = pick(r, b.roofs)
    const w = 0.34, h = 0.4, d = 0.32
    const parts = [part(RBOX, wall, [0, h / 2, 0], [w, h, d]), part(CONE, roof, [0, h + 0.07, 0], [w * 0.85, 0.18, d * 0.85], [0, Math.PI / 4, 0])]
    for (const y of [h * 0.35, h * 0.72]) for (const x of [-w * 0.24, w * 0.24]) if (!(y < h * 0.5 && x < 0)) parts.push(...roundWindow(x, y, d / 2 + 0.006, 0.9))
    parts.push(...archDoor(-w * 0.24, d / 2 + 0.006), ...chimney(-w * 0.2, h + 0.1, 0, roof))
    return { parts, smoke: [-w * 0.2, h + 0.17, 0] }
  },
  shop(r, s, b) {
    const wall = pick(r, b.walls), awning = pick(r, b.roofs)
    const w = 0.42, h = 0.3, d = 0.32
    const parts = [part(RBOX, wall, [0, h / 2, 0], [w, h, d]), part(SOFT, WHITE, [0, h + 0.015, 0], [w * 1.04, 0.035, d * 1.04])]
    // a scalloped, striped awning
    for (let k = 0; k < 5; k++) {
      const x = -w * 0.4 + k * w * 0.2
      parts.push(part(SOFT, k % 2 ? WHITE : awning, [x, h * 0.66, d / 2 + 0.035], [w * 0.2, 0.02, 0.09], [0.55, 0, 0]))
      parts.push(part(SPHERE, k % 2 ? WHITE : awning, [x, h * 0.6, d / 2 + 0.075], [0.04, 0.025, 0.012]))
    }
    parts.push(part(SOFT, PANE, [w * 0.12, h * 0.3, d / 2 + 0.006], [w * 0.42, 0.11, 0.015]), ...archDoor(-w * 0.28, d / 2 + 0.006, 0.12, 0.065))
    parts.push(part(DISC, WHITE, [0, h + 0.09, 0], [0.07, 0.07, 0.02]), part(DISC, awning, [0, h + 0.09, 0.012], [0.05, 0.05, 0.02]))
    return { parts }
  },
  clock(r, s, b) {
    const wall = pick(r, b.walls), roof = pick(r, b.roofs)
    return { parts: [
      part(RBOX, wall, [0, 0.33, 0], [0.22, 0.66, 0.22]),
      part(DISC, WHITE, [0, 0.52, 0.112], [0.075, 0.075, 0.02]), part(TORUS, 0xffd166, [0, 0.52, 0.118], [0.075, 0.075, 0.075]),
      part(SOFT, 0x4a3d48, [0, 0.545, 0.125], [0.01, 0.05, 0.006]), part(SOFT, 0x4a3d48, [0.015, 0.52, 0.125], [0.035, 0.01, 0.006]),
      part(CONE, roof, [0, 0.76, 0], [0.16, 0.22, 0.16]), part(SPHERE, 0xffd166, [0, 0.88, 0], [0.02, 0.02, 0.02]),
      ...archDoor(0, 0.112, 0.12, 0.07),
    ] }
  },
  apartment(r, s, b) {
    const wall = pick(r, b.walls)
    const floors = Math.round((3 + r() * 2) * s)
    const w = 0.38, fh = 0.14, h = floors * fh, d = 0.36
    const parts = [part(RBOX, wall, [0, h / 2, 0], [w, h, d])]
    for (let f = 0; f < floors; f++) {
      const y = (f + 0.55) * fh
      for (const x of [-w * 0.24, w * 0.24]) parts.push(...roundWindow(x, y, d / 2 + 0.006, 0.85))
      if (f > 0 && f % 2 === 0) {
        parts.push(part(SOFT, WHITE, [w * 0.24, y - fh * 0.42, d / 2 + 0.03], [0.13, 0.018, 0.06]))
        parts.push(part(SPHERE, 0x6ccf6b, [w * 0.24, y - fh * 0.3, d / 2 + 0.045], [0.05, 0.03, 0.025]))
      }
    }
    parts.push(part(SOFT, 0x8fdc72, [0, h + 0.012, 0], [w * 0.8, 0.03, d * 0.8]), part(SPHERE, 0x6ccf6b, [-w * 0.15, h + 0.06, 0], [0.06, 0.06, 0.06]), part(SPHERE, 0x8fdc72, [w * 0.12, h + 0.05, -0.05], [0.045, 0.045, 0.045]))
    return { parts }
  },
  glass(r, s) {
    const g = pick(r, GLASS)
    const h = (0.75 + r() * 0.35) * s
    const parts = [part(CAPSULE, g, [0, h / 2 + 0.13, 0], [0.13, h, 0.13])]
    for (const k of [0.3, 0.62]) parts.push(part(CYL, WHITE, [0, 0.13 + h * k, 0], [0.134, 0.022, 0.134]))
    parts.push(part(CYL, WHITE, [0, 0.06, 0], [0.16, 0.12, 0.16]))
    parts.push(part(SPHERE, 0xffffff, [-0.05, h * 0.75, 0.09], [0.025, h * 0.25, 0.02]))
    return { parts }
  },
  skyscraper(r, s) {
    const g = pick(r, GLASS)
    const h = (1.05 + r() * 0.3) * s
    const parts = []
    const tiers = [[0.34, h * 0.48], [0.27, h * 0.3], [0.2, h * 0.22]]
    let y = 0
    for (const [w, th] of tiers) {
      parts.push(part(RBOX, g, [0, y + th / 2, 0], [w, th, w]))
      parts.push(part(SOFT, WHITE, [0, y + th - 0.012, 0], [w + 0.03, 0.03, w + 0.03]))
      for (const x of [-w * 0.22, w * 0.22]) parts.push(part(SOFT, WHITE, [x, y + th / 2, w / 2 + 0.004], [0.018, th * 0.8, 0.01]))
      y += th
    }
    parts.push(part(DOME, WHITE, [0, y, 0], [0.08, 0.06, 0.08]), part(CYL, 0xdfe6ee, [0, y + 0.13, 0], [0.012, 0.16, 0.012]), part(SPHERE, 0xff6b7a, [0, y + 0.22, 0], [0.025, 0.025, 0.025]))
    return { parts }
  },
  twist(r, s) {
    const g = pick(r, GLASS)
    const n = Math.round(11 * s)
    const parts = []
    for (let k = 0; k < n; k++) parts.push(part(RBOX, k % 3 === 2 ? WHITE : g, [0, 0.055 + k * 0.1, 0], [0.26, 0.095, 0.26], [0, k * 0.13, 0]))
    parts.push(part(DOME, WHITE, [0, n * 0.1 + 0.005, 0], [0.1, 0.1, 0.1]))
    return { parts }
  },
  spire(r, s) {
    // a needle tower rising in rounded stages, like the tallest in the world
    const parts = []
    let y = 0, w = 0.3
    const stages = Math.round(7 * s)
    for (let k = 0; k < stages; k++) {
      const h = 0.2
      parts.push(part(CAPSULE, k % 2 ? 0xd8ecff : 0xb5dcff, [0, y + h / 2, 0], [w / 2, h * 0.7, w / 2]))
      y += h
      w *= 0.84
    }
    parts.push(part(CYL, 0xe6eef6, [0, y + 0.22, 0], [0.016, 0.44, 0.016]), part(SPHERE, 0x7ff0ff, [0, y + 0.46, 0], [0.03, 0.03, 0.03]))
    return { parts, glow: [0, y + 0.46, 0] }
  },
  sail(r, s) {
    return { parts: [part(SAIL, WHITE, [0, 0.02, 0], [0.55 * s, 1.0 * s, 1]), part(CYL, 0xdfe6ee, [0.02, 0.5 * s, 0], [0.022, 1.0 * s, 0.022]), part(DISC, 0xc8d3dd, [-0.1, 0.78 * s, 0], [0.08, 0.08, 0.012], [Math.PI / 2, 0, 0]), part(RBOX, 0xd8ecff, [0.05, 0.05, 0], [0.3, 0.1, 0.3])] }
  },
  bubble(r, s) {
    return { parts: [part(CYL, WHITE, [0, 0.04, 0], [0.2, 0.08, 0.2]), part(DOME, 0xb5ecff, [0, 0.08, 0], [0.18 * s, 0.18 * s, 0.18 * s]), part(TORUS, 0xffd166, [0, 0.08, 0], [0.19, 0.19, 0.19], [Math.PI / 2, 0, 0]), part(SPHERE, 0x6ccf6b, [0, 0.12, 0], [0.06, 0.05, 0.06])] }
  },
  ring(r, s) {
    return { parts: [part(TORUS, 0xffd166, [0, 0.3 * s, 0], [0.22 * s, 0.22 * s, 0.22 * s]), part(RBOX, 0xdfe6ee, [0, 0.05, 0], [0.2, 0.1, 0.2])] }
  },
  park() {
    return { parts: [part(CYL, 0x8fdc72, [0, 0.012, 0], [0.2, 0.024, 0.2]), part(CYL, 0xd9f6ff, [0, 0.035, 0], [0.08, 0.025, 0.08]), part(CAPSULE, 0xd9f6ff, [0, 0.08, 0], [0.012, 0.06, 0.012]), part(SOFT, 0xa8714a, [0.12, 0.04, 0.05], [0.08, 0.02, 0.03])] }
  },
}

// What stands on an island with this many bridges. Slot 0 is the middle; slots
// 1-5 ring it; 6-13 sit near the shore. The biome's landmark always has slot 12,
// and 'tree' means the biome's own kind of tree.
const PLAN = [
  { 0: 'cottage', 6: 'tree', 9: 'tree' },
  { 0: 'cottage', 2: 'cottage', 6: 'tree', 9: 'tree', 7: 'tree' },
  { 0: 'house', 1: 'cottage', 3: 'shop', 6: 'tree', 8: 'tree', 10: 'tree', 13: 'park' },
  { 0: 'clock', 1: 'house', 2: 'shop', 3: 'apartment', 4: 'cottage', 6: 'tree', 9: 'tree', 10: 'tree' },
  { 0: 'glass', 1: 'apartment', 2: 'apartment', 3: 'shop', 4: 'house', 5: 'shop', 7: 'tree', 10: 'tree', 13: 'park' },
  { 0: 'skyscraper', 1: 'glass', 2: 'apartment', 3: 'glass', 4: 'apartment', 5: 'shop', 7: 'tree', 9: 'park', 10: 'tree' },
  { 0: 'skyscraper', 1: 'twist', 2: 'glass', 3: 'skyscraper', 4: 'apartment', 5: 'bubble', 7: 'tree', 9: 'park', 11: 'tree', 13: 'tree' },
  { 0: 'spire', 1: 'twist', 2: 'glass', 3: 'sail', 4: 'skyscraper', 5: 'bubble', 6: 'tree', 8: 'tree', 10: 'ring', 13: 'tree' },
  { 0: 'spire', 1: 'twist', 2: 'skyscraper', 3: 'sail', 4: 'twist', 5: 'glass', 6: 'tree', 8: 'ring', 10: 'bubble', 13: 'tree' },
]
const LANDMARK_SLOT = 12
const SLOTS = [[0, 0], ...[0, 1, 2, 3, 4].map((k) => [0.5, k * 1.2566 + 0.6]), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [0.8, k * 0.785 + 0.2])]
// tall buildings stretch a little as the city grows
const GROW = { apartment: [1, 1.15, 1.3], glass: [0.85, 1, 1.1], skyscraper: [0.85, 1, 1.1], twist: [0.8, 0.95, 1.05], spire: [0.85, 0.9, 1], sail: [0.9, 0.9, 1], ring: [1, 1, 1], bubble: [1, 1.1, 1.2] }

const easeBack = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2

function bake(parts) {
  const geometry = merge(parts)
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh, new THREE.Mesh(geometry, outline(LINE, 0.009)))
  return group
}

export class City {
  constructor(seed, biome) {
    this.group = new THREE.Group()
    this.seed = seed
    this.biome = BIOMES[biome]
    this.slots = SLOTS.map(() => null)
    this.retiring = []
    this.puffs = []
    this.spinners = []
    this.tier = -1
    // the landmark stands from the start: it's what makes this island itself
    const lm = LANDMARKS[this.biome.landmark]()
    const [rad, ang] = SLOTS[LANDMARK_SLOT]
    const g = bake(lm.parts)
    g.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad)
    g.scale.setScalar(1.6)
    if (lm.spin) {
      const blades = new THREE.Mesh(lm.spin.geometry, toon(0xffffff, { vertexColors: true }))
      blades.position.set(...lm.spin.at)
      blades.castShadow = true
      g.add(blades)
      this.spinners.push(blades)
    }
    if (lm.glow) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff6c2, transparent: true, opacity: 0.6 }))
      light.position.set(...lm.glow)
      g.add(light)
      this.beacon = light
    }
    this.group.add(g)
    this.landmark = g
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
      if (i === LANDMARK_SLOT) return
      let kind = plan[i] ?? null
      if (kind === 'tree') kind = `tree:${this.biome.tree}`
      const scale = GROW[kind]?.[stretch] ?? 1
      const key = kind && `${kind}-${scale}`
      const cur = this.slots[i]
      if ((cur?.key ?? null) === key) return
      if (cur) { cur.t = 0; this.retiring.push(cur) }
      this.slots[i] = null
      if (!kind) return
      const r = seeded(this.seed * 31 + i * 7 + kind.length * 13)
      const made = kind.startsWith('tree:') ? { parts: TREES[this.biome.tree](r) } : KITS[kind](r, scale, this.biome)
      const group = bake(made.parts)
      group.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad)
      // buildings turn their fronts out toward the viewer's side of the island
      group.rotation.y = kind.startsWith('tree:') ? r() * 6 : Math.atan2(Math.cos(ang) * 0.5, 1) * -0.6 + (r() - 0.5) * 0.3
      group.scale.set(1, 0.001, 1)
      this.group.add(group)
      this.slots[i] = { key, group, t: 0, delay: growing ? delay : delay * 0.5, smoke: made.smoke, smokeT: r() * 2 }
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
        const squish = Math.sin(k * Math.PI) * 0.1
        s.group.scale.set(1 + squish, Math.max(0.001, easeBack(k)), 1 + squish)
      }
      // chimneys puff little clouds
      if (s.smoke && s.t >= 1) {
        s.smokeT -= dt
        if (s.smokeT < 0) {
          s.smokeT = 1.4 + Math.random() * 1.2
          const p = new THREE.Mesh(SPHERE, toon(0xffffff, { rim: 0.1 }))
          const local = new THREE.Vector3(...s.smoke).applyEuler(s.group.rotation).add(s.group.position)
          p.position.copy(local)
          p.scale.setScalar(0.02)
          this.group.add(p)
          this.puffs.push({ mesh: p, age: 0 })
        }
      }
    }
    for (const p of this.puffs) {
      p.age += dt
      p.mesh.position.y += dt * 0.18
      p.mesh.position.x += dt * 0.05
      p.mesh.scale.setScalar(0.02 + p.age * 0.03)
      if (p.age > 1.6) p.mesh.removeFromParent()
    }
    this.puffs = this.puffs.filter((p) => p.age <= 1.6)
    if (this.retiring.length) {
      for (const s of this.retiring) {
        s.t += dt / 0.3
        s.group.scale.set(1 - s.t * 0.3, Math.max(0.001, 1 - s.t), 1 - s.t * 0.3)
        if (s.t >= 1) s.group.removeFromParent()
      }
      this.retiring = this.retiring.filter((s) => s.t < 1)
    }
    for (const spin of this.spinners) spin.rotation.z += dt * 1.6
    if (this.beacon) this.beacon.material.opacity = 0.45 + Math.sin(performance.now() / 300) * 0.3
  }

  settle() {
    for (const s of this.slots) if (s) { s.t = 1; s.delay = 0; s.group.scale.set(1, 1, 1) }
    for (const s of this.retiring) s.group.removeFromParent()
    this.retiring = []
  }
}

/* ---------- the island itself, with a face ---------- */

// A soft pudding-shaped island with "frosting" that drips over its edge, and a
// little face on the front that shows how it feels.
export class Island {
  constructor(radius, seed, biome) {
    const b = BIOMES[biome]
    const r = seeded(seed)
    this.group = new THREE.Group()
    this.radius = radius
    const bulge = (a, amount) => 1 + Math.sin(a * 3 + seed) * amount + Math.sin(a * 5 + seed * 2) * amount * 0.6
    // how far the shore is from the middle at this angle, where the body meets the sea
    this.shore = (a) => radius * 1.185 * bulge(a, 0.03)
    const wobble = (geo, amount) => {
      const p = geo.attributes.position
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i)
        const k = bulge(Math.atan2(z, x), amount)
        p.setX(i, x * k)
        p.setZ(i, z * k)
      }
      geo.computeVertexNormals()
      return geo
    }
    // the body: a lathe that bulges like a pudding and sinks below the water
    const profile = [[0, -0.3], [1.06, -0.3], [1.16, -0.15], [1.19, 0.03], [1.14, 0.13], [1.03, 0.18], [0, 0.18]]
    const curve = new THREE.SplineCurve(profile.map(([x, y]) => new THREE.Vector2(x * radius, y)))
    const pts = curve.getSpacedPoints(30).map((p) => new THREE.Vector2(Math.max(0.001, p.x), p.y))
    pts[0].x = pts[pts.length - 1].x = 0.001
    const body = new THREE.Mesh(wobble(new THREE.LatheGeometry(pts, 56), 0.03), toon(b.side, { rim: 0.18 }))
    body.receiveShadow = true
    this.group.add(body)
    this.group.add(new THREE.Mesh(body.geometry, outline(LINE, 0.012)))
    const top = new THREE.Mesh(wobble(new THREE.CylinderGeometry(radius * 1.02, radius * 1.07, 0.05, 56), 0.03), toon(b.top, { rim: 0.15 }))
    top.position.y = 0.18
    top.receiveShadow = true
    this.group.add(top)
    // drips of frosting over the edge
    const drips = []
    const n = Math.round(10 + radius * 10)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.2
      const rr = radius * 1.065 * (1 + Math.sin(a * 3 + seed) * 0.03 + Math.sin(a * 5 + seed * 2) * 0.018)
      drips.push(part(CAPSULE, b.drip, [Math.cos(a) * rr, 0.15, Math.sin(a) * rr], [0.03, 0.02 + r() * 0.04, 0.03]))
    }
    const dripMesh = new THREE.Mesh(merge(drips), toon(0xffffff, { vertexColors: true, rim: 0.15 }))
    dripMesh.receiveShadow = true
    this.group.add(dripMesh)
    // a few rocks along the cliffs for the waves to break around; never where a
    // bridge leaves (straight up, down, left or right) or over the face
    this.rocks = []
    const rockParts = []
    const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.22, Math.PI * 0.78].filter(() => r() < 0.6)
    for (const base of angles) {
      const a = base + (r() - 0.5) * 0.3
      const size = 0.06 + r() * 0.05
      const d = this.shore(a) + size * 0.35
      const x = Math.cos(a) * d, z = Math.sin(a) * d
      rockParts.push(part(ROCK, b.rock, [x, 0.0, z], [size, size * 0.85, size * 0.9], [r(), r() * 6, r()]))
      if (r() < 0.6) rockParts.push(part(ROCK, b.rock, [x + Math.cos(a + 1.4) * size * 1.2, -0.01, z + Math.sin(a + 1.4) * size * 1.2], [size * 0.55, size * 0.5, size * 0.55], [r(), r() * 6, 0]))
      if (b.snowcap) rockParts.push(part(SPHERE, 0xffffff, [x, size * 0.62, z], [size * 0.75, size * 0.25, size * 0.7]))
      this.rocks.push({ x, z, r: size * 0.95 })
    }
    if (rockParts.length) {
      const geo = merge(rockParts)
      const rocks = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true, rim: 0.15 }))
      rocks.castShadow = rocks.receiveShadow = true
      this.group.add(rocks, new THREE.Mesh(geo, outline(LINE, 0.008)))
    }
    this.buildFace(radius)
    this.mood = 'sleep'
    this.blink = 1 + r() * 3
    this.t = r() * 10
  }

  buildFace(radius) {
    // the face sits on the island's front, the side that faces the viewer
    const face = new THREE.Group()
    face.position.set(0, 0.115, radius * 1.13)
    face.rotation.x = -0.55
    const s = 1.3 + radius * 1.4
    face.scale.setScalar(s)
    this.group.add(face)
    const ink = new THREE.MeshBasicMaterial({ color: 0x3e2b30 })
    const eyeGeo = new THREE.SphereGeometry(1, 16, 12)
    this.eyes = new THREE.Group()
    for (const x of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(eyeGeo, ink)
      eye.scale.set(0.028, 0.036, 0.014)
      eye.position.set(x, 0.01, 0.01)
      const shine = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }))
      shine.scale.set(0.011, 0.011, 0.005)
      shine.position.set(x + 0.009, 0.022, 0.022)
      this.eyes.add(eye, shine)
    }
    face.add(this.eyes)
    const arc = new THREE.TorusGeometry(0.026, 0.0065, 6, 16, Math.PI)
    const pair = (flip) => {
      const g = new THREE.Group()
      for (const x of [-0.1, 0.1]) {
        const m = new THREE.Mesh(arc, ink)
        m.position.set(x, flip ? 0.0 : 0.02, 0.012)
        m.rotation.z = flip ? Math.PI : 0
        g.add(m)
      }
      face.add(g)
      return g
    }
    this.happyEyes = pair(false)
    this.sleepyEyes = pair(true)
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff9db6, transparent: true, opacity: 0.75 })
    for (const x of [-0.165, 0.165]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.032, 16), blushMat)
      blush.scale.y = 0.6
      blush.position.set(x, -0.03, 0.006)
      face.add(blush)
    }
    // mouths
    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0065, 6, 16, Math.PI), ink)
    this.smile.position.set(0, -0.03, 0.012)
    this.smile.rotation.z = Math.PI
    this.grin = new THREE.Mesh(new THREE.CircleGeometry(0.038, 18, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: 0xd9546e }))
    this.grin.position.set(0, -0.02, 0.012)
    this.snore = new THREE.Mesh(new THREE.CircleGeometry(0.014, 14), new THREE.MeshBasicMaterial({ color: 0xd9546e }))
    this.snore.position.set(0, -0.045, 0.012)
    this.wobble = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 16, Math.PI * 1.2), ink)
    this.wobble.position.set(0, -0.05, 0.012)
    this.sweat = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0x9fd8ff }))
    this.sweat.scale.set(0.014, 0.02, 0.008)
    this.sweat.position.set(0.17, 0.05, 0.012)
    face.add(this.smile, this.grin, this.snore, this.wobble, this.sweat)
    this.face = face
  }

  // sleep (no bridges yet), curious (some), happy (exactly its number), worried (too many)
  setMood(mood) {
    this.mood = mood
  }

  update(dt) {
    this.t += dt
    const m = this.mood
    this.blink -= dt
    let lid = 1
    if (this.blink < 0) {
      lid = 0.15
      if (this.blink < -0.12) this.blink = 2 + Math.random() * 3
    }
    this.eyes.visible = m === 'curious' || m === 'worried'
    this.eyes.scale.y = lid
    this.happyEyes.visible = m === 'happy'
    this.sleepyEyes.visible = m === 'sleep'
    this.smile.visible = m === 'curious'
    this.grin.visible = m === 'happy'
    this.snore.visible = m === 'sleep'
    this.snore.scale.setScalar(0.8 + Math.sin(this.t * 1.8) * 0.3)
    this.wobble.visible = m === 'worried'
    this.sweat.visible = m === 'worried'
    if (m === 'worried') this.sweat.position.y = 0.05 - ((this.t * 0.06) % 0.04)
    // happy islands bob a little, sleepy ones breathe slowly
    const breathe = m === 'sleep' ? Math.sin(this.t * 1.3) * 0.012 : m === 'happy' ? Math.abs(Math.sin(this.t * 2.6)) * 0.02 : 0
    this.face.position.y = 0.115 + breathe
  }
}
