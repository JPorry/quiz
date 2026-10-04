import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// A chibi bunny: big round head on a little body, stubby feet with toe beans, thick
// rounded ears, glossy eyes set wide and low, blush, a tuft of fur and a pompom tail.
// Toon shading and a soft outline keep it reading like a sticker even when small.
// Built in its own units (about 1.5 tall with ears), facing +z, feet on y = 0.

export const FUR = {
  snow: [0xfffcf8, 0xc9a99e], cream: [0xfff1dc, 0xc99c78], caramel: [0xf6c28e, 0xa8673a],
  cocoa: [0xcf9e7c, 0x7a4f36], silver: [0xeeeaf1, 0x9a8a95], charcoal: [0x8b8492, 0x463e4c], ginger: [0xffcf9a, 0xc06e30],
}
const PASTELS = [0xff8fab, 0x8fc9ff, 0xffd166, 0xa8e6a1, 0xc9a8ff, 0xffb38a]
const WHITE = 0xfffaf5
const PINK = 0xffb8c9
const INK = 0x3a221a

/* ---------- materials ---------- */

const gradient = (() => {
  const data = new Uint8Array([150, 205, 238, 255])
  const t = new THREE.DataTexture(data, 4, 1, THREE.RedFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()
// Soft toon shading plus a warm rim of light, so fur looks fluffy and round.
const toonCache = new Map()
export function toon(color = 0xffffff, { vertexColors = false, rim = 0.28, emissive = 0 } = {}) {
  const key = `${color}-${vertexColors}-${rim}-${emissive}`
  if (toonCache.has(key)) return toonCache.get(key)
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient, vertexColors, emissive })
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 rimV = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
      float rimA = pow(1.0 - clamp(dot(normalize(normal), rimV), 0.0, 1.0), 2.6);
      outgoingLight += vec3(1.0, 0.95, 0.88) * rimA * ${rim.toFixed(2)};
      #include <opaque_fragment>`,
    )
  }
  m.customProgramCacheKey = () => key
  toonCache.set(key, m)
  return m
}
const outlineCache = new Map()
// Inverted hull: the same shape, pushed out along its normals and drawn from behind.
function outlineMaterial(color, width) {
  const key = `${color}-${width}`
  if (outlineCache.has(key)) return outlineCache.get(key)
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${width.toFixed(4)};`)
  }
  m.customProgramCacheKey = () => `outline-${key}`
  outlineCache.set(key, m)
  return m
}
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra })

/* ---------- geometry helpers ---------- */

const SPHERE = new THREE.SphereGeometry(1, 28, 20)
const SMALL = new THREE.SphereGeometry(1, 14, 10)
// a part: geometry placed by position, scale and rotation, painted one colour
function P(geometry, color, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], [rx, ry, rz] = [0, 0, 0]) {
  const g = geometry.clone().toNonIndexed()
  g.deleteAttribute('uv')
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))
  g.applyMatrix4(m)
  const c = new THREE.Color(color)
  const colors = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}
const merge = (parts) => mergeGeometries(parts.filter(Boolean))
function mesh(geometry, material, parent, { cast = false } = {}) {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = cast
  m.receiveShadow = false
  parent.add(m)
  return m
}
// A mesh with its outline, grouped so they always scale and move together.
function withOutline(geometry, material, parent, line, width = 0.022, opts) {
  const group = new THREE.Group()
  parent.add(group)
  mesh(geometry, material, group, opts)
  group.add(new THREE.Mesh(geometry, outlineMaterial(line, width)))
  return group
}

// A rounded ear: a lathe that is fat in the middle and pinched at the base.
function earGeometry(length, width) {
  const pts = [[0, 0], [0.45, 0.05], [0.8, 0.22], [1, 0.48], [0.92, 0.72], [0.62, 0.92], [0, 1]]
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x * width, y * length)))
  const profile = curve.getSpacedPoints(24).map((p) => new THREE.Vector2(Math.max(0.0005, p.x), p.y))
  profile[0].x = profile[profile.length - 1].x = 0.0005
  return new THREE.LatheGeometry(profile, 20)
}
const arc = (r, tube, a = Math.PI) => new THREE.TorusGeometry(r, tube, 8, 20, a)
export function carrotGeometry() {
  return merge([
    P(new THREE.ConeGeometry(0.12, 0.5, 12), 0xff8a2e, [0, -0.25, 0], [1, 1, 1], [Math.PI, 0, 0]),
    P(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xff9a40, [0, 0, 0], [1, 0.4, 1]),
    ...[-0.5, 0, 0.5].map((a) => P(new THREE.ConeGeometry(0.035, 0.24, 6), 0x55b45a, [Math.sin(a) * 0.06, 0.13, 0], [1, 1, 1], [0, 0, a])),
  ])
}
const CARROT = carrotGeometry()

/* ---------- the look ---------- */

let seed = 1
export function seedLooks(n) { seed = n }
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (list) => list[Math.floor(rnd() * list.length)]
export function lookFor(baby, parents) {
  const fur = parents && rnd() < 0.8 ? pick(parents) : pick(Object.keys(FUR))
  const light = ['snow', 'cream', 'silver'].includes(fur)
  return {
    fur, baby,
    ears: baby ? (rnd() < 0.25 ? 'lop' : 'up') : pick(['up', 'up', 'up', 'lop', 'flop']),
    mark: fur === 'charcoal' ? 'dutch' : light ? pick(['none', 'none', 'patch', 'spots']) : pick(['none', 'blaze', 'dutch', 'patch']),
    acc: baby ? pick(['none', 'none', 'bow', 'sprout']) : pick(['none', 'bow', 'crown', 'scarf', 'hat', 'glasses', 'none']),
    accent: pick(PASTELS),
    phase: rnd() * 10,
  }
}
export const randomFur = () => pick(Object.keys(FUR))

/* ---------- the bunny ---------- */

export class Bunny {
  constructor(look) {
    this.look = look
    this.state = 'sleep'
    this.t = look.phase
    this.blinkAt = 1 + rnd() * 3
    this.twitchAt = 2 + rnd() * 4
    this.hopT = -1
    this.build()
    this.setState('sleep', true)
  }

  build() {
    const { look } = this
    const [furColor, lineColor] = FUR[look.fur]
    const b = look.baby
    const fur = toon(0xffffff, { vertexColors: true })
    const lineW = b ? 0.026 : 0.022
    this.root = new THREE.Group()
    this.lift = new THREE.Group() // hops
    this.root.add(this.lift)
    this.squash = new THREE.Group() // squash and stretch from the feet
    this.lift.add(this.squash)

    // body, feet, tail and markings move together
    const hr = b ? 0.46 : 0.42 // head radius
    const bodyR = b ? 0.25 : 0.3
    const body = [
      P(SPHERE, furColor, [0, bodyR * 0.95, 0], [bodyR, bodyR * 0.88, bodyR * 0.92]),
      ...[-1, 1].map((s) => P(SPHERE, furColor, [s * bodyR * 0.55, 0.06, 0.12], [0.11, 0.065, 0.15])),
      ...[-1, 1].map((s) => P(SMALL, PINK, [s * bodyR * 0.55, 0.06, 0.26], [0.04, 0.035, 0.02])),
      P(SPHERE, WHITE, [0, bodyR * 0.7, -bodyR * 0.95], [0.12, 0.12, 0.11]),
    ]
    if (look.mark === 'dutch') body.push(P(SPHERE, WHITE, [0, bodyR * 0.85, bodyR * 0.55], [bodyR * 0.62, bodyR * 0.62, bodyR * 0.45]))
    if (look.mark === 'spots') for (const [x, y] of [[-0.14, 0.32], [0.16, 0.22]]) body.push(P(SPHERE, lineColor, [x, y, bodyR * 0.72], [0.06, 0.05, 0.03]))
    this.body = withOutline(merge(body), fur, this.squash, lineColor, lineW, { cast: true })

    // paws: resting on the tummy, or hugging a carrot
    this.paws = new THREE.Group()
    this.squash.add(this.paws)
    withOutline(merge([-1, 1].map((s) => P(SPHERE, furColor, [s * 0.085, bodyR * 1.0, bodyR * 0.82], [0.075, 0.06, 0.07]))), fur, this.paws, lineColor, lineW * 0.8)
    this.hug = new THREE.Group()
    this.squash.add(this.hug)
    const carrot = mesh(CARROT, toon(0xffffff, { vertexColors: true, rim: 0.2 }), this.hug)
    carrot.position.set(0.02, bodyR * 1.15, bodyR * 0.95)
    carrot.rotation.set(0.25, 0, -0.55)
    carrot.scale.setScalar(b ? 0.62 : 0.7)
    this.carrot = carrot
    withOutline(merge([-1, 1].map((s) => P(SPHERE, furColor, [s * 0.07, bodyR * 1.12, bodyR * 1.0], [0.07, 0.06, 0.065]))), fur, this.hug, lineColor, lineW * 0.8)

    // head: one big round shape with cheek fluff, a tuft and the face
    this.head = new THREE.Group()
    this.head.position.set(0, bodyR * 1.55 + hr * 0.7, 0.02)
    this.squash.add(this.head)
    const headParts = [
      P(SPHERE, furColor, [0, 0, 0], [hr * 1.08, hr * 0.92, hr * 0.94]),
      ...[-1, 1].map((s) => P(SPHERE, furColor, [s * hr * 0.55, -hr * 0.3, hr * 0.28], [hr * 0.5, hr * 0.42, hr * 0.5])),
      // tuft of fur on top
      ...[[-0.035, 0.35, 0.05], [0.025, -0.15, 0.06]].map(([x, rz, r]) => P(new THREE.ConeGeometry(r * 0.75, r * 2.2, 10), furColor, [x, hr * 0.92, 0.04], [1, 1, 0.8], [-0.25, 0, rz])),
    ]
    if (look.mark === 'dutch') {
      headParts.push(P(SPHERE, WHITE, [0, -hr * 0.42, hr * 0.42], [hr * 0.62, hr * 0.42, hr * 0.5]))
      headParts.push(P(SPHERE, WHITE, [0, hr * 0.3, hr * 0.62], [hr * 0.09, hr * 0.42, hr * 0.3]))
    }
    if (look.mark === 'blaze') headParts.push(P(SPHERE, WHITE, [0, hr * 0.25, hr * 0.66], [hr * 0.1, hr * 0.48, hr * 0.3]))
    if (look.mark === 'patch') headParts.push(P(SPHERE, lineColor, [hr * 0.4, -hr * 0.02, hr * 0.62], [hr * 0.3, hr * 0.28, hr * 0.28]))
    withOutline(merge(headParts), fur, this.head, lineColor, lineW, { cast: true })
    // shine
    const shine = mesh(SMALL, basic(0xffffff, { transparent: true, opacity: 0.55, depthWrite: false }), this.head)
    shine.position.set(-hr * 0.42, hr * 0.5, hr * 0.62)
    shine.scale.set(hr * 0.22, hr * 0.1, 0.02)
    shine.rotation.z = 0.35

    // face, all just in front of the head's surface
    const fz = hr * 0.9
    const ex = hr * (b ? 0.4 : 0.42), ey = -hr * (b ? 0.1 : 0.05)
    const eyeR = b ? 0.072 : 0.06
    this.eyes = new THREE.Group()
    this.head.add(this.eyes)
    this.eyes.position.set(0, ey, 0)
    this.eyes.add(new THREE.Mesh(merge([-1, 1].flatMap((s) => [
      P(SPHERE, INK, [s * ex, 0, fz - 0.03], [eyeR, eyeR * 1.2, eyeR * 0.6], [0, s * 0.35, 0]),
      P(SMALL, 0xffffff, [s * ex + eyeR * 0.38, eyeR * 0.45, fz + 0.012], [eyeR * 0.42, eyeR * 0.42, 0.01]),
      P(SMALL, 0xffffff, [s * ex - eyeR * 0.4, -eyeR * 0.5, fz + 0.012], [eyeR * 0.18, eyeR * 0.18, 0.01]),
    ])), new THREE.MeshBasicMaterial({ vertexColors: true })))
    const lid = (up) => new THREE.Mesh(merge([-1, 1].map((s) => P(arc(eyeR * 0.95, 0.014), INK, [s * ex, ey + (up ? -0.005 : 0.01), fz + 0.005], [1, up ? 1 : 0.8, 1], [0, 0, up ? 0 : Math.PI]))), basic(INK))
    this.shut = lid(false)
    this.happy = lid(true)
    this.head.add(this.shut, this.happy)
    // blush, nose and ω mouth
    this.head.add(new THREE.Mesh(merge([
      ...[-1, 1].map((s) => P(new THREE.CircleGeometry(1, 20), 0xff9db6, [s * (ex + 0.1), ey - 0.08, fz - 0.02], [0.07, 0.042, 1], [0, s * 0.45, 0])),
      P(SMALL, 0xff7f9c, [0, ey - 0.045, fz + 0.01], [0.028, 0.02, 0.018]),
      ...[-1, 1].map((s) => P(arc(0.022, 0.008), INK, [s * 0.021, ey - 0.085, fz + 0.002], [1, 1, 1], [0, 0, Math.PI])),
    ]), new THREE.MeshBasicMaterial({ vertexColors: true })))
    this.mouthO = mesh(SMALL, basic(0xd9647e), this.head)
    this.mouthO.position.set(0, ey - 0.13, fz - 0.005)
    this.mouthO.scale.set(0.022, 0.028, 0.01)

    // ears always sit behind the head
    this.ears = []
    const earLen = b ? 0.42 : 0.6, earW = b ? 0.11 : 0.13
    const earGeo = earGeometry(earLen, earW)
    const innerGeo = earGeometry(earLen * 0.78, earW * 0.55)
    const style = (side) => (look.ears === 'lop' || (look.ears === 'flop' && side < 0) ? 'lop' : 'up')
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group()
      const lop = style(side) === 'lop'
      pivot.position.set(side * hr * (lop ? 0.92 : 0.42), hr * (lop ? 0.42 : 0.72), -hr * (lop ? 0.12 : 0.3))
      pivot.userData.base = lop ? new THREE.Euler(0.1, 0, -side * 2.62) : new THREE.Euler(-0.18, 0, -side * 0.16)
      pivot.rotation.copy(pivot.userData.base)
      this.head.add(pivot)
      withOutline(earGeo, toon(furColor), pivot, lineColor, lineW * 0.9, { cast: true }).scale.z = 0.5
      const inner = mesh(innerGeo, toon(PINK, { rim: 0.1 }), pivot)
      inner.position.set(0, earLen * 0.12, earW * 0.42)
      inner.scale.z = 0.3
      this.ears.push({ pivot, side, lop })
    }

    // accessories
    const a = look.accent
    const acc = []
    if (look.acc === 'bow') {
      const x = -hr * 0.55, y = hr * 0.7, z = hr * 0.55
      acc.push(...[-1, 1].map((d) => P(SPHERE, a, [x + d * 0.07, y + 0.005, z], [0.075, 0.05, 0.04], [0, 0, d * 0.35])), P(SMALL, a, [x, y, z + 0.02], [0.04, 0.04, 0.04]))
    }
    if (look.acc === 'crown') for (let k = 0; k < 5; k++) {
      const ang = (k - 2) * 0.42
      const x = Math.sin(ang) * hr * 0.75, y = hr * 0.78 - Math.abs(ang) * 0.06, z = Math.cos(ang) * hr * 0.4
      acc.push(...[0, 1, 2, 3, 4].map((p) => P(SMALL, PASTELS[(k + 2) % PASTELS.length], [x + Math.cos(p * 1.256) * 0.05, y + Math.sin(p * 1.256) * 0.05, z], [0.04, 0.04, 0.025])), P(SMALL, 0xffe27a, [x, y, z + 0.015], [0.028, 0.028, 0.018]))
    }
    if (look.acc === 'hat') {
      acc.push(P(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 20), 0x8a6a9c, [hr * 0.15, hr * 0.92, 0], [1, 1, 1], [0, 0, -0.25]))
      acc.push(P(new THREE.CylinderGeometry(0.1, 0.11, 0.13, 20), 0xa585b8, [hr * 0.17, hr * 0.92 + 0.07, 0], [1, 1, 1], [0, 0, -0.25]))
      acc.push(P(new THREE.CylinderGeometry(0.112, 0.112, 0.03, 20), a, [hr * 0.16, hr * 0.92 + 0.03, 0], [1, 1, 1], [0, 0, -0.25]))
    }
    if (look.acc === 'glasses') {
      acc.push(...[-1, 1].map((s) => P(new THREE.TorusGeometry(eyeR * 1.7, 0.009, 6, 24), 0xd0a040, [s * ex, ey, fz + 0.02], [1, 1, 1], [0, s * 0.3, 0])))
      acc.push(P(new THREE.CylinderGeometry(0.008, 0.008, ex * 2 - eyeR * 3.4, 6), 0xd0a040, [0, ey + 0.01, fz + 0.04], [1, 1, 1], [0, 0, Math.PI / 2]))
    }
    if (look.acc === 'sprout') {
      acc.push(P(new THREE.CylinderGeometry(0.008, 0.01, 0.1, 6), 0x5fae55, [0, hr * 0.95 + 0.05, 0.02]))
      acc.push(...[-1, 1].map((s) => P(SMALL, 0x7fd36e, [s * 0.05, hr * 0.95 + 0.1, 0.02], [0.055, 0.025, 0.03], [0, 0, s * 0.4])))
    }
    if (acc.length) mesh(merge(acc), toon(0xffffff, { vertexColors: true, rim: 0.15 }), this.head)
    if (look.acc === 'scarf') {
      const scarf = mesh(merge([P(new THREE.TorusGeometry(bodyR * 0.82, 0.05, 10, 28), a, [0, 0, 0], [1, 1, 0.9], [Math.PI / 2, 0, 0]), P(SPHERE, a, [bodyR * 0.45, -0.08, bodyR * 0.65], [0.05, 0.1, 0.03], [0, 0, 0.3])]), toon(0xffffff, { vertexColors: true }), this.squash)
      scarf.position.y = bodyR * 1.6
    }

    // little extras that come and go
    this.sweat = mesh(SMALL, basic(0x9fd8ff, { transparent: true, opacity: 0.9 }), this.head)
    this.sweat.position.set(hr * 0.95, hr * 0.35, hr * 0.3)
    this.sweat.scale.set(0.035, 0.05, 0.03)
    this.root.scale.setScalar(1)
  }

  setState(state, instant = false) {
    if (this.state === state && !instant) return
    const was = this.state
    this.state = state
    if (!instant && state === 'fed') this.hop(0.28)
    if (!instant && state === 'wait' && was === 'sleep') this.hop(0.16)
  }

  hop(height = 0.25, duration = 0.5) {
    this.hopT = 0
    this.hopH = height
    this.hopD = duration
  }

  update(dt, worried = false) {
    this.t += dt
    const t = this.t
    const s = this.state
    const sleep = s === 'sleep'
    // breathing
    const breath = Math.sin(t * (sleep ? 1.4 : 2.4)) * (sleep ? 0.03 : 0.018)
    this.body.scale.set(1 - breath * 0.4, 1 + breath, 1 - breath * 0.4)
    // eager little bounce while waiting for carrots
    let bounce = 0
    if (s === 'wait') bounce = Math.max(0, Math.sin(t * 7)) * 0.05
    // hops: anticipation, flight, landing squash
    if (this.hopT >= 0) {
      this.hopT += dt / this.hopD
      const k = this.hopT
      if (k < 0.2) this.squash.scale.set(1 + k * 0.6, 1 - k * 0.8, 1 + k * 0.6)
      else if (k < 0.85) {
        const f = (k - 0.2) / 0.65
        bounce += Math.sin(f * Math.PI) * this.hopH
        this.squash.scale.set(0.94, 1.1, 0.94)
      } else this.squash.scale.set(1.08, 0.9, 1.08)
      if (k >= 1) { this.hopT = -1; this.squash.scale.set(1, 1, 1) }
    }
    this.lift.position.y = bounce
    // head: sleepy nod, happy sway, curious tilt
    const sway = s === 'fed' ? Math.sin(t * 2.2) * 0.12 : Math.sin(t * 0.7) * 0.05
    this.head.rotation.set(sleep ? 0.28 + Math.sin(t * 1.4) * 0.03 : -0.08, sway * 0.6, sway)
    // eyes: open and blinking, shut while asleep, ^ ^ when fed
    this.blinkAt -= dt
    let lid = 1
    if (this.blinkAt < 0) {
      lid = Math.abs(Math.sin((this.blinkAt / 0.14) * Math.PI)) < 0.5 ? 0.15 : 1
      if (this.blinkAt < -0.14) this.blinkAt = 2 + Math.random() * 3.5
    }
    this.eyes.visible = !sleep && s !== 'fed'
    this.eyes.scale.y = lid
    this.shut.visible = sleep
    this.happy.visible = s === 'fed'
    this.mouthO.visible = s === 'wait'
    // carrot hug and nibble
    this.hug.visible = s === 'fed'
    this.paws.visible = s !== 'fed'
    if (s === 'fed') this.carrot.rotation.z = -0.55 + Math.sin(t * 9) * 0.08
    // ears: perk, droop while asleep or worried, wiggle when happy, occasional twitch
    this.twitchAt -= dt
    const twitch = this.twitchAt < 0 ? Math.sin(-this.twitchAt * 40) * 0.25 : 0
    if (this.twitchAt < -0.3) this.twitchAt = 2 + Math.random() * 5
    for (const ear of this.ears) {
      const base = ear.pivot.userData.base
      const droop = ear.lop ? 0 : sleep ? 0.55 : worried ? 0.9 : 0
      const wiggle = s === 'fed' ? Math.sin(t * 5 + ear.side) * 0.12 : 0
      ear.pivot.rotation.set(base.x + (ear.lop ? 0 : droop * 0.4), base.y, base.z - ear.side * droop + wiggle + twitch * (ear.side > 0 ? 1 : 0))
    }
    this.sweat.visible = worried
    if (worried) this.sweat.position.y = 0.2 - ((t * 0.25) % 0.12)
  }
}

export function makeCarrotMesh() {
  const m = new THREE.Mesh(CARROT, toon(0xffffff, { vertexColors: true, rim: 0.2 }))
  m.castShadow = true
  return m
}
