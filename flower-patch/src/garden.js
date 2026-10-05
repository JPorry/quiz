import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { toon, part, baked, canvasTexture, seeded } from './look.js'
import { COLORS } from './flowers.js'

// The garden around the plants: raised beds of soil walled in brick, a striped
// lawn between them, a picket fence, and a few things left lying about.

export const SOIL_Y = 0.16
const GAP = 0.055 // half the strip of lawn between two beds
const PX = 72 // texture pixels per cell

// The outline of a bed, walked around its edge, pulled in by GAP on every side.
// Beds hold at most six cells, so a bed never wraps around another or pinches.
export function bedOutline(cells, width, gap = GAP) {
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
    return [p[0] + gap * (-d1[1] - d2[1]), p[1] + gap * (d1[0] + d2[0])]
  })
}

// A bed's outline with rounded corners, as a shape in (x, -z).
function bedShape(cells, width, height, gap = GAP, round = 0.16) {
  const pts = bedOutline(cells, width, gap)
  const shape = new THREE.Shape()
  pts.forEach((p, k) => {
    const a = pts[(k + pts.length - 1) % pts.length], b = pts[(k + 1) % pts.length]
    const lenIn = Math.hypot(p[0] - a[0], p[1] - a[1]), lenOut = Math.hypot(b[0] - p[0], b[1] - p[1])
    const r = Math.min(round, lenIn / 2, lenOut / 2)
    const from = [p[0] - (p[0] - a[0]) / lenIn * r, p[1] - (p[1] - a[1]) / lenIn * r]
    const to = [p[0] + (b[0] - p[0]) / lenOut * r, p[1] + (b[1] - p[1]) / lenOut * r]
    // shape space is (x, -z), board space is (column, row)
    const w = ([x, y]) => [x - width / 2, -(y - height / 2)]
    if (k === 0) shape.moveTo(...w(from))
    else shape.lineTo(...w(from))
    shape.quadraticCurveTo(...w(p), ...w(to))
  })
  shape.closePath()
  return shape
}

// The shape extruded and turned to lie on the lawn, its top at SOIL_Y.
function bedGeometry(shape, width, height, { depth = SOIL_Y, bevel = 0, size = 0, segments = 1 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: size, bevelSegments: segments, curveSegments: 6 })
  g.rotateX(-Math.PI / 2)
  // map the top onto the garden-wide soil texture
  const pos = g.attributes.position, uv = g.attributes.uv
  for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) + width / 2) / width, 1 - (pos.getZ(k) + height / 2) / height)
  return g
}

// A brick wall all round a bed, from the lawn up to just above the soil, in
// courses laid like a real wall, each one shifted half a brick.
const BRICK = new RoundedBoxGeometry(1, 1, 1, 1, 0.18)
const BRICK_COLORS = [0xe98a62, 0xdb7a57, 0xf09a70, 0xe0845e]
// the wall stands well above the soil, so every bed reads as a planter
const WALL_ABOVE = 0.08
const COURSES = 4
const COURSE = (SOIL_Y + WALL_ABOVE) / COURSES

function wall(shape, rand) {
  const parts = []
  const n = Math.max(8, Math.round(shape.getLength() / 0.1))
  for (let c = 0; c < COURSES; c++) {
    for (let k = 0; k < n; k++) {
      const u = ((k + (c % 2) * 0.5) / n) % 1
      const p = shape.getPointAt(u), t = shape.getTangentAt(u)
      const color = BRICK_COLORS[Math.floor(rand() * BRICK_COLORS.length)]
      parts.push(part(BRICK, color, [p.x, COURSE * (c + 0.5), -p.y], [shape.getLength() / n - 0.008, COURSE - 0.006, 0.07], [0, Math.atan2(t.y, t.x), 0]))
    }
  }
  return parts
}

function speckle(g, x, y, w, h, colors, n, rand, size = 2.2) {
  for (let k = 0; k < n; k++) {
    g.fillStyle = colors[Math.floor(rand() * colors.length)]
    g.beginPath()
    g.ellipse(x + rand() * w, y + rand() * h, size * (0.5 + rand()), size * (0.4 + rand() * 0.6), rand() * 3, 0, Math.PI * 2)
    g.fill()
  }
}

// Soil for every bed: warm, crumbly earth with soft mottling and a scatter of
// tiny grains. The plots, furrows and clods are real shapes (see soilSurface),
// so the texture only carries colour.
function soilTexture(board, seed) {
  const rand = seeded(seed)
  return canvasTexture(board.width * PX, board.height * PX, (g, w, h) => {
    g.fillStyle = '#93623f'
    g.fillRect(0, 0, w, h)
    // big, soft patches of damper and drier earth
    for (let k = 0; k < board.cells * 5; k++) {
      const x = rand() * w, y = rand() * h, r = PX * (0.25 + rand() * 0.45)
      const grad = g.createRadialGradient(x, y, 0, x, y, r)
      const tone = rand() < 0.5 ? '120, 76, 48' : '166, 116, 78'
      grad.addColorStop(0, `rgba(${tone}, .35)`)
      grad.addColorStop(1, `rgba(${tone}, 0)`)
      g.fillStyle = grad
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    speckle(g, 0, 0, w, h, ['#7e5233', '#a9774f', '#b88a62'], board.cells * 26, rand, 1.4)
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
  })
}

/* ---------- the soil surface ---------- */

// Soft value noise, for lumps in the earth.
function noise(seed) {
  const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n) }
  const smoothK = (t) => t * t * (3 - 2 * t)
  return (x, z) => {
    const x0 = Math.floor(x), z0 = Math.floor(z), fx = smoothK(x - x0), fz = smoothK(z - z0)
    const a = hash(x0, z0), b = hash(x0 + 1, z0), c = hash(x0, z0 + 1), d = hash(x0 + 1, z0 + 1)
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz
  }
}

const SOIL_IN = 0.115 // how far the soil keeps in from a bed's edge: the inside of the wall
const SOIL_RES = 14 // grid steps per plot

// The height of the soil at (x, z), in plot units from the board's corner, as
// an offset from SOIL_Y. Every plot is a soft mound, highest in its middle
// where the plants grow, dipping into a furrow where it meets the next plot and
// settling lower against the wall, with small lumps all over.
function soilHeight(board, lumps) {
  return (x, z) => {
    const c = Math.min(board.width - 1, Math.max(0, Math.floor(x))), r = Math.min(board.height - 1, Math.max(0, Math.floor(z)))
    const fx = x - c, fz = z - r
    // a rounded crown: flat-ish on top, falling away towards the plot's sides
    const crown = Math.pow(Math.max(0, Math.sin(Math.PI * fx)), 0.6) * Math.pow(Math.max(0, Math.sin(Math.PI * fz)), 0.6)
    // how close to a wall: sides that face another bed or the edge of the board
    const i = r * board.width + c, b = board.bedOf[i]
    const open = (dc, dr) => { const cc = c + dc, rr = r + dr; return cc >= 0 && cc < board.width && rr >= 0 && rr < board.height && board.bedOf[rr * board.width + cc] === b }
    let wall = 9
    if (!open(-1, 0)) wall = Math.min(wall, fx - SOIL_IN)
    if (!open(1, 0)) wall = Math.min(wall, 1 - SOIL_IN - fx)
    if (!open(0, -1)) wall = Math.min(wall, fz - SOIL_IN)
    if (!open(0, 1)) wall = Math.min(wall, 1 - SOIL_IN - fz)
    const nearWall = 1 - Math.min(1, Math.max(0, wall) / 0.16)
    const lump = (lumps(x * 5, z * 5) - 0.5) * 0.02 + (lumps(x * 13 + 7, z * 13 + 3) - 0.5) * 0.008
    return { h: -0.055 * (1 - crown) - 0.02 * nearWall * nearWall + lump * (0.5 + 0.5 * (1 - crown)), crown, nearWall }
  }
}

const CLOD = new THREE.IcosahedronGeometry(1, 1)

// A bed's soil as a real surface: a grid over each of its plots, shaped by
// soilHeight and shaded by it (furrows and the foot of the wall darker, crowns
// lighter), with little clods of earth scattered over it.
export function soilSurface(board, cells, seed) {
  const lumps = noise(seed)
  const height = soilHeight(board, lumps)
  const pos = [], nor = [], col = [], uv = [], idx = []
  const tone = (crown, nearWall) => 0.7 + 0.4 * Math.sqrt(crown) - 0.18 * nearWall
  for (const i of cells) {
    const c = i % board.width, r = Math.floor(i / board.width), b = board.bedOf[i]
    const open = (dc, dr) => { const cc = c + dc, rr = r + dr; return cc >= 0 && cc < board.width && rr >= 0 && rr < board.height && board.bedOf[rr * board.width + cc] === b }
    const x0 = c + (open(-1, 0) ? 0 : SOIL_IN), x1 = c + 1 - (open(1, 0) ? 0 : SOIL_IN)
    const z0 = r + (open(0, -1) ? 0 : SOIL_IN), z1 = r + 1 - (open(0, 1) ? 0 : SOIL_IN)
    const start = pos.length / 3
    for (let k = 0; k <= SOIL_RES; k++) {
      for (let j = 0; j <= SOIL_RES; j++) {
        const x = x0 + (x1 - x0) * (j / SOIL_RES), z = z0 + (z1 - z0) * (k / SOIL_RES)
        const { h, crown, nearWall } = height(x, z)
        // the normal from the slope of the surface, so plots join without seams
        const e = 0.01
        const dx = (height(x + e, z).h - height(x - e, z).h) / (2 * e), dz = (height(x, z + e).h - height(x, z - e).h) / (2 * e)
        const n = new THREE.Vector3(-dx, 1, -dz).normalize()
        pos.push(x - board.width / 2, SOIL_Y + h, z - board.height / 2)
        nor.push(n.x, n.y, n.z)
        const t = tone(crown, nearWall)
        col.push(t, t * 0.98, t * 0.96)
        uv.push(x / board.width, 1 - z / board.height)
      }
    }
    const row = SOIL_RES + 1
    for (let k = 0; k < SOIL_RES; k++) {
      for (let j = 0; j < SOIL_RES; j++) {
        const a = start + k * row + j
        idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  // clods: small rounded lumps of earth sitting on the surface
  const rand = seeded(seed + 31)
  const clods = []
  for (const i of cells) {
    const c = i % board.width, r = Math.floor(i / board.width)
    for (let k = 0; k < 11; k++) {
      const x = c + 0.12 + rand() * 0.76, z = r + 0.12 + rand() * 0.76
      const { h, crown, nearWall } = height(x, z)
      const size = 0.014 + rand() * 0.026
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x - board.width / 2, SOIL_Y + h + size * 0.25, z - board.height / 2),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 0.6, rand() * 6, rand() * 0.6)),
        new THREE.Vector3(size * (1 + rand() * 0.5), size * 0.7, size),
      )
      const clod = CLOD.clone().applyMatrix4(m)
      const t = tone(crown, nearWall) * (1 + rand() * 0.3)
      const n = clod.attributes.position.count
      clod.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => [t, t * 0.97, t * 0.94]), 3))
      const cu = new Float32Array(n * 2)
      for (let v = 0; v < n; v++) { cu[v * 2] = (clod.attributes.position.getX(v) + board.width / 2) / board.width; cu[v * 2 + 1] = 1 - (clod.attributes.position.getZ(v) + board.height / 2) / board.height }
      clod.setAttribute('uv', new THREE.BufferAttribute(cu, 2))
      clods.push(clod)
    }
  }
  return mergeGeometries([g.toNonIndexed(), ...clods])
}

// A gust of wind shows as a soft, light ripple rolling across every bed. The
// scene moves it: dir is where the wind blows to, front is how far the ripple
// has come (in cells from the middle of the board), on fades it in and out.
export const WIND = { dir: { value: new THREE.Vector2(1, 0) }, front: { value: -99 }, on: { value: 0 } }

// Soil that turns into the carpet as `grow` goes from 0 to 1. The carpet
// spreads out in a ring from `origin` (in cells) as `reach` grows.
function bedMaterial(soil, carpet, width, height) {
  const m = toon(0xffffff, { rim: 0.1, vertexColors: true }).clone()
  m.map = soil
  Object.assign(m.userData, { grow: { value: 0 }, origin: { value: new THREE.Vector2() }, reach: { value: 99 } })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.carpet = { value: carpet }
    shader.uniforms.grow = m.userData.grow
    shader.uniforms.origin = m.userData.origin
    shader.uniforms.reach = m.userData.reach
    shader.uniforms.board = { value: new THREE.Vector2(width, height) }
    shader.uniforms.windDir = WIND.dir
    shader.uniforms.windFront = WIND.front
    shader.uniforms.windOn = WIND.on
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D carpet;\nuniform float grow;\nuniform vec2 origin;\nuniform float reach;\nuniform vec2 board;\nuniform vec2 windDir;\nuniform float windFront;\nuniform float windOn;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 carpetColor = texture2D(carpet, vMapUv);
        float away = distance(vec2(vMapUv.x, 1.0 - vMapUv.y) * board, origin);
        float spread = 1.0 - smoothstep(reach - 0.35, reach, away);
        // a bright edge rides the front of the spreading carpet
        float edge = smoothstep(reach - 0.35, reach - 0.15, away) * spread * step(reach, 6.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, carpetColor.rgb, grow * spread) + vec3(0.18, 0.2, 0.08) * edge * grow;
        // the wind's ripple: a soft light band, brighter on the green
        vec2 here = vec2(vMapUv.x, 1.0 - vMapUv.y) * board - board * 0.5;
        float behind = windFront - dot(here, windDir);
        float sheen = exp(-pow((behind - 0.5) / 0.55, 2.0)) * windOn;
        diffuseColor.rgb += vec3(0.1, 0.12, 0.06) * sheen * (0.5 + 0.5 * grow);`)
  }
  m.customProgramCacheKey = () => 'flower-bed'
  return m
}


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
  // the mortar between the bricks; the soil's own sides hide behind the wall
  const mortar = toon(0xf1e2cf, { rim: 0.1 })
  const deep = toon(0x5e3b25, { rim: 0 })
  const rand = seeded(seed + 11)
  const bricks = []
  const beds = board.beds.map((cells) => {
    const material = bedMaterial(soil, carpet, board.width, board.height)
    const shape = bedShape(cells, board.width, board.height, 0.08, 0.2)
    // a plain block of earth under the shaped surface, hidden by the wall
    const base = new THREE.Mesh(bedGeometry(shape, board.width, board.height, { depth: SOIL_Y - 0.05, bevel: 0 }), [deep, mortar])
    group.add(base)
    bricks.push(...wall(shape, rand))
    const mesh = new THREE.Mesh(soilSurface(board, cells, seed + cells[0]), material)
    mesh.receiveShadow = true
    mesh.castShadow = true
    group.add(mesh)
    return { mesh, material }
  })
  group.add(baked(bricks, { line: 0x8a4a3a, width: 0.004 }))
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
  return { group, beds }
}

const RIM = new RoundedBoxGeometry(1, 1, 1, 2, 0.35)

// Each cell planted at the start gets a plant label so it reads as fixed.
export function labels(cells, width, height) {
  const parts = []
  for (const i of cells) {
    const x = (i % width) + 0.5 - width / 2, z = Math.floor(i / width) + 0.5 - height / 2
    // a chunky label: a cream board with a coral border, a painted seedling
    // and a bow, on a wooden stake, leaning back to face the camera
    const sign = []
    const add = (geometry, color, position, scale, rotation) => sign.push(part(geometry, color, position, scale, rotation))
    add(RIM, 0xb98458, [0, 0.03, 0], [0.03, 0.08, 0.026])
    add(RIM, 0xff8a7a, [0, 0.13, 0], [0.24, 0.15, 0.036])
    add(RIM, 0xfff6e6, [0, 0.13, 0.013], [0.2, 0.112, 0.032])
    // the painted seedling: a little stem, two big round leaves, two small ones
    add(RIM, 0x7acb58, [0, 0.1, 0.032], [0.008, 0.05, 0.006])
    for (const s of [-1, 1]) {
      add(SPHERE, 0x68c950, [s * 0.026, 0.128, 0.034], [0.026, 0.017, 0.007], [0, 0, s * -0.35])
      add(SPHERE, 0x8fe06a, [s * 0.012, 0.15, 0.036], [0.016, 0.012, 0.007], [0, 0, s * -0.9])
      // a bow on the top corner
      add(SPHERE, 0xff6fa8, [0.09 + s * 0.026, 0.208, 0.01], [0.029, 0.018, 0.013], [0, 0, s * 0.4])
    }
    add(SPHERE, 0xff4f8f, [0.09, 0.206, 0.015], [0.013, 0.013, 0.013])
    // it stands at the front middle of the cell, the one spot no die face uses
    const m = new THREE.Matrix4().makeTranslation(x, SOIL_Y, z + 0.3).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.95, 0, 0.04)))
    for (const g of sign) parts.push(g.applyMatrix4(m))
  }
  if (!parts.length) return new THREE.Group()
  return baked(parts, { line: 0x6a4a3a, width: 0.005 })
}
