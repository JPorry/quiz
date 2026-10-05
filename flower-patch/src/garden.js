import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { toon, part, baked, canvasTexture, seeded } from './look.js'
import { COLORS } from './flowers.js'

// The garden around the plants: raised wooden beds filled with soil, a striped
// lawn between them, a picket fence, and a few things left lying about.

export const BED_DEPTH = 0.13
export const BEVEL = 0.03
export const SOIL_Y = BED_DEPTH + BEVEL
const GAP = 0.055 // half the strip of lawn between two beds
const PX = 72 // texture pixels per cell

// The outline of a bed, walked around its edge, pulled in by GAP on every side.
// Beds hold at most six cells, so a bed never wraps around another or pinches.
export function bedOutline(cells, width) {
  const inBed = new Set(cells)
  const has = (r, c) => c >= 0 && c < width && inBed.has(r * width + c)
  const next = new Map()
  for (const i of cells) {
    const r = Math.floor(i / width), c = i % width
    // edges go clockwise around each cell (x right, y down), so the bed is on the right
    if (!has(r - 1, c)) next.set(`${c},${r}`, [c + 1, r])
    if (!has(r, c + 1)) next.set(`${c + 1},${r}`, [c + 1, r + 1])
    if (!has(r + 1, c)) next.set(`${c + 1},${r + 1}`, [c, r + 1])
    if (!has(r, c - 1)) next.set(`${c},${r + 1}`, [c, r])
  }
  const [startKey] = next.keys()
  const loop = []
  let key = startKey
  do {
    const [x, y] = key.split(',').map(Number)
    loop.push([x, y])
    const [nx, ny] = next.get(key)
    key = `${nx},${ny}`
  } while (key !== startKey)
  // keep only the corners
  const corners = loop.filter((p, k) => {
    const a = loop[(k + loop.length - 1) % loop.length], b = loop[(k + 1) % loop.length]
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0
  })
  // pull every corner in: the inward side of an edge heading (dx, dy) is (-dy, dx)
  return corners.map((p, k) => {
    const a = corners[(k + corners.length - 1) % corners.length], b = corners[(k + 1) % corners.length]
    const d1 = [Math.sign(p[0] - a[0]), Math.sign(p[1] - a[1])], d2 = [Math.sign(b[0] - p[0]), Math.sign(b[1] - p[1])]
    return [p[0] + GAP * (-d1[1] - d2[1]), p[1] + GAP * (d1[0] + d2[0])]
  })
}

// A raised bed: the outline with rounded corners, extruded and turned to lie on the lawn.
function bedGeometry(cells, width, height) {
  const pts = bedOutline(cells, width)
  const shape = new THREE.Shape()
  pts.forEach((p, k) => {
    const a = pts[(k + pts.length - 1) % pts.length], b = pts[(k + 1) % pts.length]
    const lenIn = Math.hypot(p[0] - a[0], p[1] - a[1]), lenOut = Math.hypot(b[0] - p[0], b[1] - p[1])
    const r = Math.min(0.16, lenIn / 2, lenOut / 2)
    const from = [p[0] - (p[0] - a[0]) / lenIn * r, p[1] - (p[1] - a[1]) / lenIn * r]
    const to = [p[0] + (b[0] - p[0]) / lenOut * r, p[1] + (b[1] - p[1]) / lenOut * r]
    // shape space is (x, -z), board space is (column, row)
    const w = ([x, y]) => [x - width / 2, -(y - height / 2)]
    if (k === 0) shape.moveTo(...w(from))
    else shape.lineTo(...w(from))
    shape.quadraticCurveTo(...w(p), ...w(to))
  })
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: BED_DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * 0.9, bevelSegments: 2, curveSegments: 4 })
  g.rotateX(-Math.PI / 2)
  // map the top onto the garden-wide soil texture
  const pos = g.attributes.position, uv = g.attributes.uv
  for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) + width / 2) / width, 1 - (pos.getZ(k) + height / 2) / height)
  return g
}

function speckle(g, x, y, w, h, colors, n, rand, size = 2.2) {
  for (let k = 0; k < n; k++) {
    g.fillStyle = colors[Math.floor(rand() * colors.length)]
    g.beginPath()
    g.ellipse(x + rand() * w, y + rand() * h, size * (0.5 + rand()), size * (0.4 + rand() * 0.6), rand() * 3, 0, Math.PI * 2)
    g.fill()
  }
}

// Faint dashed lines between the cells of a bed.
function furrows(g, board, color) {
  g.strokeStyle = color
  g.lineWidth = 3
  g.setLineDash([7, 6])
  for (let i = 0; i < board.cells; i++) {
    const r = Math.floor(i / board.width), c = i % board.width
    const right = c + 1 < board.width && board.bedOf[i + 1] === board.bedOf[i]
    const down = r + 1 < board.height && board.bedOf[i + board.width] === board.bedOf[i]
    g.beginPath()
    if (right) { g.moveTo((c + 1) * PX, r * PX + 10); g.lineTo((c + 1) * PX, (r + 1) * PX - 10) }
    if (down) { g.moveTo(c * PX + 10, (r + 1) * PX); g.lineTo((c + 1) * PX - 10, (r + 1) * PX) }
    g.stroke()
  }
  g.setLineDash([])
}

// Soil for every bed.
function soilTexture(board, seed) {
  const rand = seeded(seed)
  return canvasTexture(board.width * PX, board.height * PX, (g, w, h) => {
    g.fillStyle = '#8a5a3b'
    g.fillRect(0, 0, w, h)
    speckle(g, 0, 0, w, h, ['#7a4e33', '#996744', '#6f452c', '#a3714c'], board.cells * 40, rand)
    furrows(g, board, 'rgba(70, 40, 24, .55)')
  })
}

// What a bed turns into as it flowers: a leafy carpet strewn with its petals.
function carpetTexture(board, flowers, seed) {
  const rand = seeded(seed + 1)
  return canvasTexture(board.width * PX, board.height * PX, (g) => {
    for (let i = 0; i < board.cells; i++) {
      const r = Math.floor(i / board.width), c = i % board.width
      const color = COLORS[flowers[board.bedOf[i]]].carpet
      g.fillStyle = '#5aa64f'
      g.fillRect(c * PX, r * PX, PX, PX)
      speckle(g, c * PX, r * PX, PX, PX, ['#64b358', '#509a47', '#6cbf5f'], 22, rand, 5)
      g.globalAlpha = 0.7
      speckle(g, c * PX, r * PX, PX, PX, [color], 5, rand, 2.6)
      g.globalAlpha = 1
    }
    furrows(g, board, 'rgba(40, 80, 34, .5)')
  })
}

// Soil that turns into the carpet as `grow` goes from 0 to 1.
function bedMaterial(soil, carpet) {
  const m = toon(0xffffff, { rim: 0.1 }).clone()
  m.map = soil
  m.userData.grow = { value: 0 }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.carpet = { value: carpet }
    shader.uniforms.grow = m.userData.grow
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D carpet;\nuniform float grow;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 carpetColor = texture2D(carpet, vMapUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, carpetColor.rgb, grow);`)
  }
  m.customProgramCacheKey = () => 'flower-bed'
  return m
}

const WOOD = 0xc98f5f
const WOOD_DARK = 0xa8724a
const LAWN = 0x8fd06c

function lawnTexture(size) {
  return canvasTexture(256, 256, (g, w, h) => {
    // mown stripes
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? '#93d470' : '#88cb66'
      g.fillRect(0, (k * h) / 8, w, h / 8)
    }
    const rand = seeded(size)
    speckle(g, 0, 0, w, h, ['#7fbf5c', '#a2dc80'], 260, rand, 1.6)
  })
}

const PICKET = new RoundedBoxGeometry(1, 1, 1, 1, 0.25)
const POINT = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const SPHERE = new THREE.SphereGeometry(1, 10, 8)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12)

// A white picket fence along the back and the sides of the garden.
function fence(width, height) {
  const parts = []
  const hw = width / 2 + 0.38, hd = height / 2 + 0.38
  const side = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(2, Math.round(len / 0.2))
    const along = Math.atan2(bz - az, bx - ax)
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n
      parts.push(part(PICKET, 0xfffaf0, [x, 0.17, z], [0.07, 0.34, 0.035], [0, -along, 0]))
      parts.push(part(POINT, 0xfffaf0, [x, 0.37, z], [0.05, 0.07, 0.05], [0, -along, 0]))
    }
    for (const y of [0.12, 0.27]) parts.push(part(BOX, 0xf3e9da, [(ax + bx) / 2, y, (az + bz) / 2], [len, 0.04, 0.02], [0, -along, 0]))
  }
  side(-hw, -hd, hw, -hd)
  side(-hw, -hd, -hw, hd - 0.2)
  side(hw, -hd, hw, hd - 0.2)
  return baked(parts, { line: 0x8a7a72, width: 0.008 })
}

// Grass tufts, round bushes, pebbles, mushrooms, and a watering can on the lawn.
function decorations(width, height, seed) {
  const rand = seeded(seed + 5)
  const parts = []
  const hw = width / 2, hd = height / 2
  const ring = []
  for (let k = 0; k < 26; k++) {
    // a spot on the lawn around the beds, inside the fence
    const t = rand()
    const edge = Math.floor(rand() * 4)
    const x = edge < 2 ? (t - 0.5) * (width + 0.4) : (edge === 2 ? -1 : 1) * (hw + 0.2)
    const z = edge >= 2 ? (t - 0.5) * (height + 0.4) : (edge === 0 ? -1 : 1) * (hd + 0.2)
    ring.push([x, z])
  }
  for (const [x, z] of ring.slice(0, 18)) {
    for (let b = 0; b < 3; b++) {
      const a = rand() * 6
      parts.push(part(SPHERE, b % 2 ? 0x6fbf55 : 0x5aae48, [x + Math.cos(a) * 0.03, 0.03, z + Math.sin(a) * 0.03], [0.012, 0.07, 0.012], [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]))
    }
  }
  for (const [x, z] of ring.slice(18, 22)) parts.push(part(SPHERE, 0xd8d2c8, [x, 0.01, z], [0.05, 0.025, 0.04], [0, rand() * 3, 0]))
  for (const [x, z] of ring.slice(22)) {
    parts.push(part(CYL, 0xfff3e0, [x, 0.03, z], [0.014, 0.06, 0.014]))
    parts.push(part(SPHERE, 0xff6b6b, [x, 0.065, z], [0.04, 0.025, 0.04]))
    parts.push(part(SPHERE, 0xffffff, [x + 0.015, 0.085, z + 0.01], [0.007, 0.004, 0.007]))
  }
  // round bushes in the back corners
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.2), z = -hd - 0.2
    for (const [dx, dz, r] of [[0, 0, 0.2], [s * -0.18, 0.05, 0.14], [0.02, 0.18, 0.13]]) parts.push(part(SPHERE, 0x4f9e48, [x + dx, r * 0.8, z + dz], [r, r * 0.9, r]))
    parts.push(part(SPHERE, 0xff8fb0, [x + 0.05, 0.3, z + 0.1], [0.03, 0.03, 0.03]))
    parts.push(part(SPHERE, 0xfff1a8, [x - 0.08, 0.24, z + 0.14], [0.025, 0.025, 0.025]))
  }
  // a watering can by the front left corner
  const wx = -hw - 0.15, wz = hd + 0.3
  parts.push(part(CYL, 0x7fc8e8, [wx, 0.09, wz], [0.08, 0.17, 0.08]))
  parts.push(part(CYL, 0x6ab4d4, [wx, 0.18, wz], [0.082, 0.015, 0.082]))
  parts.push(part(CYL, 0x7fc8e8, [wx + 0.12, 0.13, wz], [0.016, 0.2, 0.016], [0, 0, -0.9]))
  parts.push(part(CYL, 0x6ab4d4, [wx + 0.2, 0.2, wz], [0.03, 0.02, 0.03], [0, 0, -0.9]))
  parts.push(part(new THREE.TorusGeometry(1, 0.15, 6, 14, Math.PI), 0x6ab4d4, [wx - 0.02, 0.2, wz], [0.06, 0.06, 0.06]))
  return baked(parts, { line: 0x4a5a3a, width: 0.006 })
}

// Builds every bed, the lawn, the fence and the decorations.
export function buildGarden(board, flowers, seed) {
  const group = new THREE.Group()
  const soil = soilTexture(board, seed)
  const carpet = carpetTexture(board, flowers, seed)
  const side = toon(WOOD, { rim: 0.12 })
  const beds = board.beds.map((cells) => {
    const material = bedMaterial(soil, carpet)
    const mesh = new THREE.Mesh(bedGeometry(cells, board.width, board.height), [material, side])
    mesh.receiveShadow = true
    mesh.castShadow = true
    group.add(mesh)
    return { mesh, material }
  })
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), toon(0xffffff, { rim: 0 }).clone())
  lawn.material.map = lawnTexture(seed)
  lawn.material.map.wrapS = lawn.material.map.wrapT = THREE.RepeatWrapping
  lawn.material.map.repeat.set(10, 10)
  lawn.material.color.setHex(0xffffff)
  lawn.receiveShadow = true
  lawn.position.y = -0.001
  group.add(lawn)
  // a darker border of turf around the beds marks the garden's edge
  const turf = new THREE.Mesh(new RoundedBoxGeometry(board.width + 0.5, 0.02, board.height + 0.5, 2, 0.01), toon(0x7cc25d, { rim: 0 }))
  turf.position.y = 0.002
  turf.receiveShadow = true
  group.add(turf)
  group.add(fence(board.width, board.height))
  group.add(decorations(board.width, board.height, seed))
  return { group, beds, colors: { WOOD, WOOD_DARK, LAWN } }
}

// Small round stones around a cell planted at the start, marking it as fixed.
export function pebbles(cells, width, height) {
  const parts = []
  for (const i of cells) {
    const x = (i % width) + 0.5 - width / 2, z = Math.floor(i / width) + 0.5 - height / 2
    const n = 14
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.2
      const d = Math.min(0.39 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))), 0.41)
      parts.push(part(SPHERE, k % 3 ? 0xf4ede2 : 0xe2d7c6, [x + Math.cos(a) * d, SOIL_Y + 0.008, z + Math.sin(a) * d], [0.034, 0.02, 0.03], [0, a, 0]))
    }
  }
  if (!parts.length) return new THREE.Group()
  return baked(parts, { line: 0x8a7a6a, width: 0.004, shadow: false })
}
