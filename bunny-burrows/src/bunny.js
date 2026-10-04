import * as THREE from 'three'

// A bunny is built in its own units (sitting, about one unit tall to the top of the
// head, facing +z) and scaled into the meadow. Every part that moves hangs from its
// own pivot so the animation layer can breathe, blink, twitch, hop, and binky.

export const COATS = {
  snow: { fur: 0xfdf8f1, belly: 0xffffff, muzzle: 0xffffff, ear: 0xffb6c4, tail: 0xffffff, nose: 0xff9fb0 },
  cream: { fur: 0xf5e4c8, belly: 0xfffaf0, muzzle: 0xfffaf2, ear: 0xffbcc4, tail: 0xfffaf2, nose: 0xf59aa8 },
  caramel: { fur: 0xe3ae7c, belly: 0xfbeedc, muzzle: 0xfdf3e6, ear: 0xf7b3b3, tail: 0xfff6ea, nose: 0xe88d95 },
  cocoa: { fur: 0xb4896a, belly: 0xf2dfc8, muzzle: 0xf6e8d6, ear: 0xeaa8a8, tail: 0xfaf0e2, nose: 0xd98390 },
  smoke: { fur: 0xc9c4c2, belly: 0xf5f2ee, muzzle: 0xf8f6f2, ear: 0xf3b4c0, tail: 0xffffff, nose: 0xe995a6 },
  silver: { fur: 0xe7e3df, belly: 0xffffff, muzzle: 0xffffff, ear: 0xf6c0cb, tail: 0xffffff, nose: 0xeb9cac },
}
export const COAT_NAMES = ['snow', 'cream', 'caramel', 'cocoa', 'smoke']
const ACCENTS = [0xff8fab, 0x8fc7ff, 0xffc75f, 0xa6e3a1, 0xc6a8ff, 0xff9f7a]

const EYE = 0x2b1d1a
const MOUTH = 0x6b4436

/* ---------- materials ---------- */

const materialCache = new Map()
// Lambert shading plus a warm rim of light around the silhouette, so fur reads as soft.
function fur(color, rim = 0.32) {
  const key = `fur-${color}-${rim}`
  if (materialCache.has(key)) return materialCache.get(key)
  const material = new THREE.MeshLambertMaterial({ color })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: rim }
    shader.uniforms.uRimColor = { value: new THREE.Color(0xfff3e2) }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;')
      .replace(
        '#include <opaque_fragment>',
        `vec3 rimView = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
        float rimAmount = pow(1.0 - clamp(dot(normalize(normal), rimView), 0.0, 1.0), 2.4);
        outgoingLight += uRimColor * rimAmount * uRim;
        #include <opaque_fragment>`,
      )
  }
  material.customProgramCacheKey = () => key
  materialCache.set(key, material)
  return material
}
function plain(color, options = {}) {
  const key = `plain-${color}-${JSON.stringify(options)}`
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshLambertMaterial({ color, ...options }))
  return materialCache.get(key)
}
function basic(color, options = {}) {
  const key = `basic-${color}-${JSON.stringify(options)}`
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshBasicMaterial({ color, ...options }))
  return materialCache.get(key)
}
const eyeMaterial = new THREE.MeshPhongMaterial({ color: EYE, specular: 0x8a7a70, shininess: 90 })

const polkaTexture = (() => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const g = canvas.getContext('2d')
  g.fillStyle = '#e8605a'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#fff6ec'
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.beginPath()
    g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 5.5, 0, Math.PI * 2)
    g.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(3, 2)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
})()

const knitTexture = (() => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  g.fillStyle = '#b69ad8'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = '#9a7cc4'
  g.lineWidth = 3
  for (let x = 0; x < 64; x += 8) {
    g.beginPath()
    g.moveTo(x, 0)
    for (let y = 0; y <= 64; y += 8) g.lineTo(x + ((y / 8) % 2 ? 4 : 0), y)
    g.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(10, 1)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
})()

/* ---------- shared geometry ---------- */

const lathe = (points, segments = 28, samples = 28) => {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)))
  const profile = curve.getSpacedPoints(samples).map((p) => new THREE.Vector2(Math.max(0.001, p.x), p.y))
  profile[0].x = 0.001
  profile[profile.length - 1].x = 0.001
  return new THREE.LatheGeometry(profile, segments)
}
const G = {
  body: lathe([[0, 0], [0.32, 0.005], [0.45, 0.07], [0.495, 0.19], [0.475, 0.33], [0.41, 0.47], [0.31, 0.585], [0.17, 0.67], [0, 0.7]], 48, 36),
  ear: lathe([[0, 0], [0.07, 0.03], [0.105, 0.15], [0.112, 0.31], [0.094, 0.47], [0.055, 0.6], [0, 0.645]], 24, 24),
  sphere: new THREE.SphereGeometry(1, 28, 20),
  smallSphere: new THREE.SphereGeometry(1, 14, 10),
  arc: new THREE.TorusGeometry(1, 0.26, 8, 20, Math.PI),
  disc: new THREE.CircleGeometry(1, 20),
  whisker: new THREE.CylinderGeometry(0.004, 0.006, 1, 4).translate(0, 0.5, 0).rotateZ(-Math.PI / 2),
  ring: new THREE.TorusGeometry(1, 0.16, 8, 24),
  cone: new THREE.ConeGeometry(1, 1, 12),
  drop: new THREE.SphereGeometry(1, 12, 10),
  scarf: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
}

function part(parent, geometry, material, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], { shadow = false } = {}) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.scale.set(sx, sy, sz)
  mesh.castShadow = shadow
  parent.add(mesh)
  return mesh
}
const ball = (parent, material, position, radius, stretch = [1, 1, 1], options) =>
  part(parent, G.sphere, material, position, stretch.map((s) => s * radius), options)

/* ---------- easing ---------- */

const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp
const smooth = (t) => t * t * (3 - 2 * t)
const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt))
const bump = (t) => Math.sin(clamp(t, 0, 1) * Math.PI)

export class Bunny {
  constructor({ coat = 'snow', lop = false, accessory = null, accent = null, grandma = false, seed = 1 } = {}) {
    this.seed = seed
    this.random = () => ((this.seed = (this.seed * 16807) % 2147483647) / 2147483647)
    this.coat = COATS[coat] ?? COATS.snow
    this.grandma = grandma
    this.lop = lop
    this.mood = 'content'
    this.time = this.random() * 10
    this.actions = []
    this.look = { yaw: 0, pitch: 0, roll: 0, targetYaw: 0, targetPitch: 0, targetRoll: 0, next: 1 + this.random() * 2 }
    this.blink = { next: 1 + this.random() * 3, t: -1, double: false }
    this.twitch = { next: 2 + this.random() * 4, t: -1, side: 0 }
    this.wiggle = { next: 1 + this.random() * 3, t: -1 }
    this.tailWag = { next: 3 + this.random() * 5, t: -1 }
    this.earDroop = 0
    this.sleepiness = 0
    this.happyFace = 0
    this.shiver = 0
    // how far the bunny tips its face up toward the player looking down on the meadow
    this.gazeUp = 0
    this.build(accessory, accent ?? ACCENTS[Math.floor(this.random() * ACCENTS.length)])
  }

  build(accessory, accent) {
    const c = this.coat
    const furMat = fur(c.fur)
    const bellyMat = fur(c.belly, 0.2)
    const muzzleMat = fur(c.muzzle, 0.15)
    // root sits on the ground; rig carries hops; squash scales from the feet.
    this.root = new THREE.Group()
    this.rig = new THREE.Group()
    this.root.add(this.rig)
    this.squash = new THREE.Group()
    this.rig.add(this.squash)

    // Body
    this.torso = new THREE.Group()
    this.squash.add(this.torso)
    const body = part(this.torso, G.body, furMat, [0, 0, 0], [1, 1, 1.12], { shadow: true })
    body.rotation.x = -0.06
    ball(this.torso, bellyMat, [0, 0.3, 0.37], 0.3, [0.82, 1.02, 0.45])
    // Hind feet, big and flat, peeking out at the sides
    for (const side of [-1, 1]) {
      const foot = ball(this.torso, furMat, [side * 0.29, 0.06, 0.2], 0.14, [0.75, 0.45, 1.7], { shadow: true })
      foot.rotation.y = side * -0.18
    }
    // Front paws
    this.paws = [-1, 1].map((side) => {
      const pivot = new THREE.Group()
      pivot.position.set(side * 0.13, 0.32, 0.36)
      this.torso.add(pivot)
      ball(pivot, furMat, [0, -0.255, 0.07], 0.08, [0.95, 0.7, 1.45])
      return pivot
    })
    // Pompom tail
    this.tail = new THREE.Group()
    this.tail.position.set(0, 0.17, -0.5)
    this.torso.add(this.tail)
    const tailMat = fur(c.tail, 0.45)
    ball(this.tail, tailMat, [0, 0, 0], 0.12, [1, 1, 1], { shadow: true })
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ball(this.tail, tailMat, [Math.cos(a) * 0.075, Math.sin(a) * 0.075, -0.03], 0.075)
    }

    // Head
    this.neck = new THREE.Group()
    this.neck.position.set(0, 0.62, 0.06)
    this.torso.add(this.neck)
    this.head = new THREE.Group()
    this.head.position.set(0, 0.25, 0.05)
    this.neck.add(this.head)
    const h = this.head
    ball(h, furMat, [0, 0, 0], 0.4, [1.1, 0.95, 0.98], { shadow: true })
    for (const side of [-1, 1]) ball(h, furMat, [side * 0.17, -0.15, 0.13], 0.22, [1, 0.9, 1])
    this.muzzle = new THREE.Group()
    this.muzzle.position.set(0, -0.12, 0.33)
    h.add(this.muzzle)
    for (const side of [-1, 1]) ball(this.muzzle, muzzleMat, [side * 0.068, 0, 0], 0.095, [1, 0.88, 0.85])
    this.nose = ball(this.muzzle, plain(c.nose), [0, 0.07, 0.065], 0.048, [1.35, 0.85, 0.85])
    ball(this.nose, basic(0xffffff, { transparent: true, opacity: 0.7 }), [-0.25, 0.35, 0.75], 0.28)
    // the little ω mouth
    const mouthMat = plain(MOUTH)
    for (const side of [-1, 1]) {
      const curve = part(this.muzzle, G.arc, mouthMat, [side * 0.034, -0.085, 0.07], [0.034, 0.034, 0.034])
      curve.rotation.z = Math.PI
    }
    this.mouthOpen = ball(this.muzzle, plain(0xd9707e), [0, -0.1, 0.07], 0.03, [1, 0.8, 0.5])
    this.mouthOpen.visible = false
    // whiskers
    const whiskerMat = basic(0xd8cfc6, { transparent: true, opacity: 0.85 })
    for (const side of [-1, 1]) {
      for (const [tilt, len] of [[0.12, 0.26], [-0.02, 0.29], [-0.16, 0.25]]) {
        const w = part(this.muzzle, G.whisker, whiskerMat, [side * 0.1, 0.0, 0.05], [len, 1, 1])
        w.rotation.set(0, side < 0 ? Math.PI - 0.35 : 0.35, tilt * side)
        if (side < 0) w.rotation.z = -tilt
      }
    }

    // Eyes: glossy, big, with two highlights; they blink by squashing their pivot.
    this.eyes = []
    this.happyEyes = []
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group()
      pivot.position.set(side * 0.18, -0.005, 0.318)
      pivot.rotation.y = side * 0.38
      pivot.rotation.x = -0.05
      h.add(pivot)
      const open = new THREE.Group()
      pivot.add(open)
      part(open, G.sphere, eyeMaterial, [0, 0, 0], [0.082, 0.1, 0.058])
      ball(open, basic(0xffffff), [side * -0.018 + 0.012, 0.032, 0.045], 0.026)
      ball(open, basic(0xffffff), [side * 0.012 - 0.008, -0.03, 0.048], 0.012)
      // closed "^ ^" for happiness, "u u" for sleep share the same arc
      const closed = part(pivot, G.arc, plain(EYE), [0, -0.01, 0.04], [0.06, 0.06, 0.06])
      closed.visible = false
      this.eyes.push(open)
      this.happyEyes.push(closed)
    }
    // Blush
    for (const side of [-1, 1]) {
      // sits on the cheek's surface, facing out along its normal
      const normal = new THREE.Vector3(side * 0.56, 0.17, 0.81).normalize()
      const cheek = new THREE.Vector3(side * 0.17, -0.15, 0.13)
      const blush = part(h, G.disc, basic(0xff9fb2, { transparent: true, opacity: 0.7, depthWrite: false }), cheek.clone().addScaledVector(normal, 0.222).toArray(), [0.075, 0.055, 1])
      blush.lookAt(cheek.clone().addScaledVector(normal, 2))
    }

    // Ears hang from pivots so they can perk, twitch, droop, and trail behind hops.
    this.ears = [-1, 1].map((side) => {
      const pivot = new THREE.Group()
      pivot.position.set(side * 0.13, 0.27, -0.06)
      h.add(pivot)
      const tilt = new THREE.Group()
      pivot.add(tilt)
      part(tilt, G.ear, furMat, [0, 0, 0], [1, 1, 0.42], { shadow: true })
      const inner = part(tilt, G.ear, plain(c.ear, { emissive: c.ear, emissiveIntensity: 0.18 }), [0, 0.06, 0.03], [0.66, 0.82, 0.22])
      inner.renderOrder = 1
      return { pivot, tilt, side }
    })

    // Accessories
    if (this.grandma) this.dressGrandma()
    else if (accessory === 'bow') this.addBow(accent)
    else if (accessory === 'scarf') this.addScarf(accent)
    else if (accessory === 'flower') this.addFlower(accent)

    this.sweat = ball(h, basic(0x9fd8ff, { transparent: true, opacity: 0.85 }), [0.36, 0.2, 0.15], 0.045, [0.8, 1.2, 0.8])
    this.sweat.visible = false
    this.zzz = null
    this.restPose()
  }

  addBow(color) {
    const ear = this.ears[this.random() < 0.5 ? 0 : 1]
    const bow = new THREE.Group()
    bow.position.set(0, 0.08, 0.05)
    ear.tilt.add(bow)
    const mat = plain(color)
    for (const side of [-1, 1]) {
      const loop = part(bow, G.cone, mat, [side * 0.07, 0, 0], [0.055, 0.12, 0.03])
      loop.rotation.z = side * Math.PI / 2
    }
    ball(bow, mat, [0, 0, 0.01], 0.032)
  }

  addScarf(color) {
    const scarf = part(this.neck, G.ring, plain(color), [0, -0.08, 0], [0.3, 0.3, 0.3])
    scarf.rotation.x = Math.PI / 2 - 0.12
    scarf.scale.set(0.31, 0.33, 0.6)
    const tail = part(this.neck, G.sphere, plain(color), [0.13, -0.17, 0.27], [0.05, 0.11, 0.03])
    tail.rotation.z = 0.3
  }

  addFlower(color) {
    const flower = new THREE.Group()
    flower.position.set(-0.22, 0.28, 0.12)
    this.head.add(flower)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      ball(flower, plain(color), [Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0], 0.035, [1, 1, 0.5])
    }
    ball(flower, plain(0xffe07a), [0, 0, 0.015], 0.03, [1, 1, 0.6])
    flower.rotation.set(-0.3, -0.4, 0)
  }

  dressGrandma() {
    // Round spectacles
    const gold = plain(0xd9a441)
    for (const side of [-1, 1]) {
      const lens = part(this.head, G.ring, gold, [side * 0.165, 0.025, 0.37], [0.085, 0.085, 0.085])
      lens.rotation.y = side * 0.32
      part(this.head, G.disc, basic(0xffffff, { transparent: true, opacity: 0.12, depthWrite: false }), [side * 0.165, 0.025, 0.375], [0.08, 0.08, 1]).rotation.y = side * 0.32
    }
    part(this.head, G.whisker, gold, [-0.06, 0.03, 0.4], [0.12, 1.4, 1.4])
    // Polka-dot headscarf over the crown, ears poking through
    const scarf = part(this.head, G.scarf, new THREE.MeshLambertMaterial({ map: polkaTexture }), [0, 0.0, -0.02], [0.455, 0.42, 0.44])
    scarf.rotation.x = -0.55
    const knot = new THREE.Group()
    knot.position.set(0, -0.08, -0.38)
    this.head.add(knot)
    for (const side of [-1, 1]) {
      const tie = part(knot, G.cone, plain(0xe8605a), [side * 0.05, -0.02, 0], [0.04, 0.12, 0.03])
      tie.rotation.z = side * 2.4
    }
    // Knitted shawl around the shoulders
    const shawl = part(this.neck, G.ring, new THREE.MeshLambertMaterial({ map: knitTexture }), [0, -0.1, -0.03], [0.4, 0.4, 0.4])
    shawl.rotation.x = Math.PI / 2 - 0.12
    shawl.scale.set(0.4, 0.4, 0.62)
    const brooch = ball(this.neck, plain(0xffd36b, { emissive: 0x7a5a10, emissiveIntensity: 0.3 }), [0, -0.12, 0.42], 0.035, [1, 1, 0.6])
    brooch.castShadow = false
  }

  restPose() {
    for (const ear of this.ears) {
      if (this.lop) {
        ear.pivot.rotation.set(0.35, 0, -ear.side * 2.75)
        ear.pivot.position.set(ear.side * 0.3, 0.2, -0.04)
      } else {
        ear.pivot.rotation.set(-0.22, 0, -ear.side * 0.2)
      }
    }
  }

  /* ---------- moods and actions ---------- */

  setMood(mood) {
    this.mood = mood
  }

  get busy() {
    return this.actions.length > 0
  }

  // Queue an action; each is a function of elapsed time that returns true when done.
  queue(duration, step, onDone) {
    return new Promise((resolve) => {
      this.actions.push({ t: 0, duration, step, done: () => { onDone?.(); resolve() } })
    })
  }

  face(angle, duration = 0.25) {
    const from = this.root.rotation.y
    let delta = THREE.MathUtils.euclideanModulo(angle - from + Math.PI, Math.PI * 2) - Math.PI
    return this.queue(duration, (t) => {
      this.root.rotation.y = from + delta * smooth(t)
    })
  }

  // One squash-and-stretch hop from where the bunny is to target (x, z on the ground).
  hop(target, { height = 0.35, duration = 0.42, groundY = 0 } = {}) {
    const start = this.root.position.clone()
    const end = new THREE.Vector3(target.x, groundY, target.z)
    return this.queue(duration, (t) => {
      // anticipation 0-0.18, flight 0.18-0.85, landing 0.85-1
      if (t < 0.18) {
        const k = bump(t / 0.36)
        this.squash.scale.set(1 + 0.12 * k, 1 - 0.16 * k, 1 + 0.12 * k)
        this.earLag = -0.2 * k
      } else if (t < 0.85) {
        const f = (t - 0.18) / 0.67
        this.root.position.lerpVectors(start, end, smooth(f))
        this.rig.position.y = Math.sin(f * Math.PI) * height
        const s = Math.sin(f * Math.PI)
        this.squash.scale.set(1 - 0.06 * s, 1 + 0.12 * s, 1 - 0.06 * s)
        this.rig.rotation.x = lerp(-0.25, 0.2, f) * s
        this.earLag = lerp(0.65, -0.35, f)
      } else {
        const k = bump((t - 0.85) / 0.3)
        this.rig.position.y = 0
        this.rig.rotation.x = 0
        this.root.position.copy(end)
        this.squash.scale.set(1 + 0.14 * k, 1 - 0.18 * k, 1 + 0.14 * k)
        this.earLag = -0.45 * k
      }
    }, () => {
      this.squash.scale.set(1, 1, 1)
      this.rig.position.y = 0
      this.rig.rotation.x = 0
      this.earLag = 0
    })
  }

  // Bunnies show pure joy with a binky: a leap with a twist and a kick.
  binky({ height = 0.55, duration = 0.7 } = {}) {
    const spin = this.random() < 0.5 ? -1 : 1
    return this.queue(duration, (t) => {
      if (t < 0.15) {
        const k = bump(t / 0.3)
        this.squash.scale.set(1 + 0.14 * k, 1 - 0.2 * k, 1 + 0.14 * k)
      } else if (t < 0.88) {
        const f = (t - 0.15) / 0.73
        const s = Math.sin(f * Math.PI)
        this.rig.position.y = s * height
        this.rig.rotation.y = Math.sin(f * Math.PI * 2) * 0.6 * spin
        this.rig.rotation.z = Math.sin(f * Math.PI * 2) * 0.25 * spin
        this.squash.scale.set(1 - 0.05 * s, 1 + 0.14 * s, 1 - 0.05 * s)
        this.earLag = Math.sin(f * Math.PI * 3) * 0.6
        this.happyFace = 1
      } else {
        const k = bump((t - 0.88) / 0.24)
        this.rig.position.y = 0
        this.rig.rotation.set(0, 0, 0)
        this.squash.scale.set(1 + 0.15 * k, 1 - 0.18 * k, 1 + 0.15 * k)
        this.earLag = -0.4 * k
      }
    }, () => {
      this.rig.position.y = 0
      this.rig.rotation.set(0, 0, 0)
      this.squash.scale.set(1, 1, 1)
      this.earLag = 0
      this.happyHold = 0.8
    })
  }

  // A little wave of one front paw.
  wave(duration = 1.1) {
    return this.queue(duration, (t) => {
      const k = bump(t)
      this.paws[1].rotation.x = -1.9 * smooth(Math.min(1, k * 1.6))
      this.paws[1].rotation.z = Math.sin(t * Math.PI * 6) * 0.35 * k
      this.happyFace = Math.max(this.happyFace, k)
    }, () => this.paws[1].rotation.set(0, 0, 0))
  }

  // A small shake, for when something has gone wrong.
  fret(duration = 0.5) {
    return this.queue(duration, (t) => {
      this.rig.rotation.z = Math.sin(t * Math.PI * 8) * 0.08 * (1 - t)
    }, () => (this.rig.rotation.z = 0))
  }

  lookAt(point) {
    const local = this.root.worldToLocal(point.clone())
    this.look.targetYaw = clamp(Math.atan2(local.x, local.z), -0.9, 0.9)
    this.look.targetPitch = clamp(-Math.atan2(local.y - 0.9, Math.hypot(local.x, local.z)) * 0.5, -0.35, 0.35)
    this.look.next = 1.5 + this.random() * 2
  }

  /* ---------- per-frame life ---------- */

  update(dt) {
    this.time += dt
    const t = this.time
    const r = this.random

    // queued actions
    const action = this.actions[0]
    if (action) {
      action.t += dt
      const progress = Math.min(1, action.t / action.duration)
      action.step(progress)
      if (progress >= 1) {
        this.actions.shift()
        action.done()
      }
    }

    const sleepy = this.mood === 'sleepy'
    const worried = this.mood === 'worried'
    const happy = this.mood === 'happy'
    this.sleepiness = damp(this.sleepiness, sleepy ? 1 : 0, 2, dt)
    this.earDroop = damp(this.earDroop, worried ? 1 : sleepy ? 0.45 : 0, 4, dt)
    this.shiver = damp(this.shiver, worried ? 1 : 0, 5, dt)
    if (this.happyHold > 0) this.happyHold -= dt
    const wantHappy = this.happyHold > 0 || (happy && Math.sin(t * 0.7 + this.seed) > 0.75)
    this.happyFace = damp(this.happyFace, wantHappy ? 1 : 0, 10, dt)

    // breathing: slow and deep when sleepy
    const breathRate = sleepy ? 1.3 : 2.3
    const breath = Math.sin(t * breathRate) * (sleepy ? 0.03 : 0.018)
    this.torso.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5)

    // looking around
    const look = this.look
    look.next -= dt
    if (look.next < 0 && !this.busy) {
      look.next = 1.8 + r() * 3
      look.targetYaw = (r() - 0.5) * (sleepy ? 0.3 : 1.1)
      look.targetPitch = sleepy ? 0.25 : (r() - 0.6) * 0.35
      look.targetRoll = r() < 0.3 ? (r() - 0.5) * 0.5 : 0
    }
    look.yaw = damp(look.yaw, look.targetYaw, 5, dt)
    look.pitch = damp(look.pitch, look.targetPitch + this.sleepiness * 0.2 + this.earDroop * 0.12, 5, dt)
    look.roll = damp(look.roll, look.targetRoll, 4, dt)
    this.head.rotation.set(look.pitch - this.gazeUp * (1 - this.sleepiness * 0.6), look.yaw, look.roll + Math.sin(t * 38) * 0.03 * this.shiver)
    this.neck.rotation.y = look.yaw * 0.25

    // blinking
    const b = this.blink
    b.next -= dt
    if (b.next < 0) {
      b.t = 0
      b.double = r() < 0.2
      b.next = 2 + r() * 3.5
    }
    let lid = 1
    if (b.t >= 0) {
      b.t += dt
      const length = b.double ? 0.36 : 0.15
      const phase = b.t / length
      lid = b.double ? 1 - bump((phase * 2) % 1) * 0.92 : 1 - bump(phase) * 0.92
      if (phase >= 1) b.t = -1
    }
    lid = Math.min(lid, 1 - this.sleepiness * 0.65)
    const showHappy = this.happyFace > 0.5 || this.sleepiness > 0.85
    this.eyes.forEach((eye, i) => {
      eye.visible = !showHappy
      eye.scale.y = Math.max(0.08, lid)
      eye.position.y = (1 - lid) * -0.012
      const closed = this.happyEyes[i]
      closed.visible = showHappy
      // happy "^" arcs point up; sleepy "u" arcs hang down
      closed.rotation.z = this.sleepiness > 0.85 ? Math.PI : 0
    })
    this.mouthOpen.visible = this.happyFace > 0.6 && !sleepy

    // nose wiggle in little bursts
    const w = this.wiggle
    w.next -= dt
    if (w.next < 0) {
      w.t = 0
      w.next = (sleepy ? 5 : 1.8) + r() * 3
    }
    let noseSquish = 0
    if (w.t >= 0) {
      w.t += dt
      noseSquish = Math.sin(w.t * 34) * bump(w.t / 0.9)
      if (w.t > 0.9) w.t = -1
    }
    this.nose.scale.y = 0.048 * 0.85 * (1 + noseSquish * 0.18)
    this.muzzle.position.y = -0.12 + noseSquish * 0.006

    // ear twitches, droop, and lag behind hops
    const tw = this.twitch
    tw.next -= dt
    if (tw.next < 0) {
      tw.t = 0
      tw.side = r() < 0.4 ? -1 : r() < 0.7 ? 1 : 0
      tw.next = 2.5 + r() * 5
    }
    let flick = 0
    if (tw.t >= 0) {
      tw.t += dt
      flick = Math.sin(tw.t * 40) * bump(tw.t / 0.3)
      if (tw.t > 0.3) tw.t = -1
    }
    const lag = this.earLag ?? 0
    for (const ear of this.ears) {
      const twitching = tw.side === 0 || tw.side === ear.side ? flick : 0
      if (this.lop) {
        ear.tilt.rotation.set(lag * 0.4 + twitching * 0.15, 0, Math.sin(t * 1.3 + ear.side) * 0.04)
      } else {
        const droop = this.earDroop
        ear.tilt.rotation.set(
          -lag * 0.8 + twitching * 0.22 - droop * 1.1 + Math.sin(t * 1.1 + ear.side) * 0.03,
          twitching * 0.1 * ear.side,
          -ear.side * droop * 0.55,
        )
      }
    }

    // tail wag
    const tg = this.tailWag
    tg.next -= dt
    if (tg.next < 0) {
      tg.t = 0
      tg.next = 3 + r() * 6
    }
    if (tg.t >= 0) {
      tg.t += dt
      this.tail.rotation.y = Math.sin(tg.t * 30) * 0.4 * bump(tg.t / 0.5)
      if (tg.t > 0.5) tg.t = -1
    }

    // worried: a bead of sweat and a tiny shiver
    this.sweat.visible = this.shiver > 0.3
    if (this.sweat.visible) this.sweat.position.y = 0.2 - ((t * 0.3) % 0.12)
    this.squash.position.x = Math.sin(t * 45) * 0.006 * this.shiver
  }
}

/* ---------- baskets and carrots ---------- */

const weaveTexture = (() => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  g.fillStyle = '#c98f52'
  g.fillRect(0, 0, 64, 64)
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      g.fillStyle = (x + y) % 16 ? '#dca66a' : '#b77c43'
      g.fillRect(x + 1, y + 1, 6, 6)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 1)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
})()
const basketMaterial = new THREE.MeshLambertMaterial({ map: weaveTexture, side: THREE.DoubleSide })
const rimMaterial = new THREE.MeshLambertMaterial({ color: 0xa8713f })
const carrotMaterial = new THREE.MeshLambertMaterial({ color: 0xf28c38 })
const carrotTopMaterial = new THREE.MeshLambertMaterial({ color: 0x5cb85c })
const basketGeometry = new THREE.CylinderGeometry(0.5, 0.36, 0.5, 18, 1, true).translate(0, 0.25, 0)
const basketBottom = new THREE.CircleGeometry(0.36, 18).rotateX(-Math.PI / 2)
const rimGeometry = new THREE.TorusGeometry(0.5, 0.06, 6, 22).rotateX(Math.PI / 2)
const handleGeometry = new THREE.TorusGeometry(0.42, 0.045, 6, 18, Math.PI)
const carrotGeometry = new THREE.ConeGeometry(0.17, 0.72, 10).rotateX(Math.PI)
const leafGeometry = new THREE.ConeGeometry(0.06, 0.34, 5)

export function makeCarrot() {
  const carrot = new THREE.Group()
  const root = new THREE.Mesh(carrotGeometry, carrotMaterial)
  root.castShadow = true
  carrot.add(root)
  for (const a of [-0.35, 0, 0.35]) {
    const leaf = new THREE.Mesh(leafGeometry, carrotTopMaterial)
    leaf.position.set(Math.sin(a) * 0.07, 0.48, 0)
    leaf.rotation.z = a
    carrot.add(leaf)
  }
  return carrot
}

// A woven basket, about one unit across; carrots pop in when it fills.
export function makeBasket() {
  const basket = new THREE.Group()
  const body = new THREE.Mesh(basketGeometry, basketMaterial)
  body.castShadow = true
  basket.add(body)
  basket.add(new THREE.Mesh(basketBottom, basketMaterial))
  const rim = new THREE.Mesh(rimGeometry, rimMaterial)
  rim.position.y = 0.5
  basket.add(rim)
  const handle = new THREE.Mesh(handleGeometry, rimMaterial)
  handle.position.y = 0.5
  basket.add(handle)
  const carrots = new THREE.Group()
  carrots.position.y = 0.5
  for (const [x, z, tilt] of [[-0.2, 0.06, 0.4], [0.0, -0.12, -0.05], [0.21, 0.07, -0.42], [0.02, 0.18, 0.12]]) {
    const carrot = makeCarrot()
    carrot.position.set(x, 0.06, z)
    carrot.rotation.z = tilt
    carrot.rotation.y = x * 3
    carrots.add(carrot)
  }
  carrots.scale.setScalar(0.001)
  carrots.visible = false
  basket.add(carrots)
  basket.userData.carrots = carrots
  return basket
}
