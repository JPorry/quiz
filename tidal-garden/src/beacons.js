import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { lighthouses } from './lighthouses.js'

const LAND_TOP = 0.44
const WATER_Y = 0.06
const DOTS = 120
const TOWER_SCALE = 1.75
// How tall the striped shaft stands, and how much taller a lit lighthouse grows.
const SHAFT = 0.336
const TALL = 1.5
const clamp = THREE.MathUtils.clamp
const pop = (t) => { const x = clamp(t, 0, 1); return 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2 }

// Paints a number on a soft rounded cream badge in the game's rounded type.
function badgeTexture(text, color) {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 200
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const paint = () => {
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, 256, 200)
    context.fillStyle = '#fff6e4'
    context.beginPath()
    context.roundRect(4, 4, 248, 192, 70)
    context.fill()
    context.strokeStyle = '#d7e7e8'
    context.lineWidth = 6
    context.setLineDash([14, 12])
    context.beginPath()
    context.roundRect(20, 20, 216, 160, 56)
    context.stroke()
    context.setLineDash([])
    context.font = `700 150px "DM Sans", "Avenir Next", "Helvetica Neue", sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = color
    context.fillText(text, 128, 108)
    texture.needsUpdate = true
  }
  paint()
  document.fonts?.load('700 150px "DM Sans"').then(paint, () => {})
  return texture
}

// Lighthouses standing on the garden's starting land. While a lighthouse is still dark, soft dots
// mark the water its light already reaches; once every beam ends at its number, the lamp lights,
// a gentle beam sweeps the sea, and a little sailboat sails along the longest lit stretch.
export class Beacons {
  constructor(garden) {
    this.garden = garden
    this.towers = new Map()
    const m = (color) => new THREE.MeshLambertMaterial({ color })
    this.materials = {
      white: m(0xfdf8ee), red: m(0xe0675a), dark: m(0x5a6a72), glassOff: m(0xb9d3d8), post: m(0xa8754c), rim: m(0xe3eef0),
      glassOn: new THREE.MeshBasicMaterial({ color: 0xffe7a3 }), sail: m(0xfffaf0), hull: m(0xb5714a),
    }
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.09, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.9, depthWrite: false }), DOTS)
    this.dots.count = 0
    this.dots.renderOrder = 3
    this.dots.frustumCulled = false
    garden.scene.add(this.dots)
    this.dummy = new THREE.Object3D()
    this.sparkGeometry = new THREE.SphereGeometry(0.014, 8, 6)
    this.beamMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      // Light is added without touching alpha, so the beam glows over the page as well as the sea.
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { uStrength: { value: 0.22 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uStrength;
        void main() {
          float along = vUv.y;
          float across = abs(vUv.x - 0.5) * 2.0;
          float glow = (1.0 - smoothstep(0.0, 1.0, along)) * (1.0 - smoothstep(0.2, 1.0, across)) * uStrength;
          gl_FragColor = vec4(vec3(1.0, 0.94, 0.7) * glow, 0.0);
          #include <colorspace_fragment>
        }
      `,
    })
    // A long, narrow wedge that widens away from the lamp.
    const wedge = new THREE.BufferGeometry()
    wedge.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.45, 0, 2.6, 0.45, 0, 2.6, 0, 0, 0, 0.45, 0, 2.6, -0.45, 0, 2.6], 3))
    wedge.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 0, 1, 1, 1, 0.5, 0, 1, 1, 0, 1], 2))
    this.wedge = wedge
  }

  cell(row, col) { return this.garden.cells[row * 10 + col] }

  // A lighthouse in two parts, so it can grow: a striped shaft that stretches, and a top (gallery,
  // lamp, and red cap) that rides up on it. A numbered badge stands in front, tipped to the camera.
  buildTower(sees) {
    const garden = this.garden
    const m = this.materials
    const group = new THREE.Group()
    const body = new THREE.Group()
    group.add(body)
    const shaft = new THREE.Group()
    body.add(shaft)
    garden.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 16), m.dark, shaft, 0, 0.02, 0)
    garden.mesh(new THREE.CylinderGeometry(0.065, 0.095, 0.3, 16), m.white, shaft, 0, 0.19, 0)
    for (const y of [0.12, 0.24]) garden.mesh(new THREE.CylinderGeometry(0.09 - y * 0.1, 0.092 - y * 0.1, 0.045, 16), m.red, shaft, 0, y, 0)
    garden.mergeDetails(shaft)
    const top = new THREE.Group()
    top.position.y = SHAFT
    body.add(top)
    const crown = new THREE.Group()
    top.add(crown)
    garden.mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.018, 16), m.dark, crown, 0, 0.009, 0)
    garden.mesh(new THREE.ConeGeometry(0.075, 0.08, 16), m.red, crown, 0, 0.119, 0)
    garden.mesh(new THREE.SphereGeometry(0.014, 8, 6), m.dark, crown, 0, 0.164, 0)
    garden.mergeDetails(crown)
    const lamp = garden.mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 16), m.glassOff, top, 0, 0.054, 0)
    // Tiny sparkles that burst from the lamp as it lights.
    const sparkles = Array.from({ length: 8 }, (_, i) => {
      const spark = new THREE.Mesh(this.sparkGeometry, this.materials.glassOn)
      spark.visible = false
      spark.userData.angle = i / 8 * Math.PI * 2
      top.add(spark)
      return spark
    })
    const badge = new THREE.Group()
    badge.position.set(0, 0.12, 0.19)
    badge.rotation.x = -1.2
    group.add(badge)
    garden.mesh(new RoundedBoxGeometry(0.34, 0.27, 0.045, 4, 0.1), m.rim, badge, 0, 0, -0.006)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.25), new THREE.MeshLambertMaterial({ map: badgeTexture(String(sees), '#3d8aa0'), transparent: true, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }))
    face.material.emissiveMap = face.material.map
    face.material.emissiveIntensity = 0.3
    face.position.z = 0.02
    badge.add(face)
    // Each lighthouse has its own beam, so it can sweep now and then on its own.
    const sweep = new THREE.Mesh(this.wedge, this.beamMaterial.clone())
    sweep.position.y = 0.054
    sweep.visible = false
    sweep.renderOrder = 24
    top.add(sweep)
    return { group, body, shaft, top, lamp, sparkles, sweep, badge }
  }


  buildBoat() {
    const garden = this.garden
    const group = new THREE.Group()
    const hull = garden.mesh(new THREE.SphereGeometry(0.06, 12, 8), this.materials.hull, group, 0, 0.0, 0)
    hull.scale.set(0.7, 0.4, 1.4)
    garden.mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 6), this.materials.hull, group, 0, 0.09, 0.0)
    const sail = new THREE.Shape()
    sail.moveTo(0, 0); sail.lineTo(0, 0.13); sail.lineTo(0.08, 0.01); sail.closePath()
    const mesh = garden.mesh(new THREE.ShapeGeometry(sail), this.materials.sail, group, 0.003, 0.025, 0)
    mesh.rotation.y = Math.PI / 2
    mesh.material.side = THREE.DoubleSide
    group.visible = false
    garden.scene.add(group)
    return group
  }

  set(lights = []) {
    for (const tower of this.towers.values()) {
      tower.group.parent?.remove(tower.group)
      tower.sweep.material.dispose()
      tower.group.traverse((child) => {
        if (child.geometry !== this.wedge && child.geometry !== this.sparkGeometry) child.geometry?.dispose()
        if (child.material?.map) child.material.map.dispose()
      })
      tower.boat.parent?.remove(tower.boat)
      tower.cell.plants.visible = true
    }
    this.towers.clear()
    this.lights = lights
    for (const light of lights) {
      const [row, col] = light.cell
      const cell = this.cell(row, col)
      const built = this.buildTower(light.sees)
      built.group.position.y = LAND_TOP
      built.group.scale.setScalar(TOWER_SCALE)
      cell.land.add(built.group)
      cell.plants.visible = false
      this.towers.set(row * 10 + col, { ...built, cell, light, lit: null, boat: this.buildBoat(), route: null })
    }
  }

  isTower(index) { return this.towers.has(index) }

  update(grid, time, animate) {
    const states = lighthouses(grid, this.lights ?? [])
    this.lit = []
    for (const state of states) {
      const [row, col] = state.light.cell
      const tower = this.towers.get(row * 10 + col)
      if (!tower) continue
      if (state.complete && !tower.lit) {
        tower.lit = { at: animate ? time : -100 }
        if (animate) this.onLit?.()
      } else if (!state.complete) tower.lit = null
      // A boat sails the longest lit stretch of water, out and back.
      const longest = state.beams.reduce((best, b) => (b.lit.length > (best?.lit.length ?? 1) ? b : best), null)
      tower.route = state.complete && longest ? longest.lit.map(([r, c]) => new THREE.Vector3(c - 4.5, WATER_Y + 0.02, r - 4.5)) : null
      tower.state = state
      if (!state.complete) for (const b of state.beams) for (const [r, c] of b.lit) this.lit.push([r, c, state.light.cell])
    }
    this.layDots()
  }

  // Soft dots on every water tile a dark lighthouse already sees, so its count can be read off.
  layDots() {
    const dots = (this.lit ?? []).slice(0, DOTS)
    dots.forEach(([r, c], index) => {
      this.dummy.position.set(c - 4.5, WATER_Y + 0.016, r - 4.5)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.dots.setMatrixAt(index, this.dummy.matrix)
    })
    this.dots.count = dots.length
    this.dots.instanceMatrix.needsUpdate = true
  }

  animate(time, reducedMotion) {
    const dt = clamp(time - (this.lastTime ?? time), 0, 0.1)
    this.lastTime = time
    for (const tower of this.towers.values()) {
      tower.cell.plants.visible = false
      const lit = tower.lit
      const age = lit ? (reducedMotion ? 10 : this.hold ?? time - lit.at) : -1
      this.grow(tower, age, dt)
      this.lamp(tower, age, reducedMotion)
      this.sweepNowAndThen(tower, time, age, reducedMotion)
      this.sail(tower, time, age, reducedMotion)
    }
    // Dots breathe gently, so they read as light rather than markings.
    this.dots.material.opacity = reducedMotion ? 0.8 : 0.7 + Math.sin(time * 2.4) * 0.15
  }

  // Lighting up: the badge pops off with a spin, the tower crouches, then springs up taller,
  // overshoots, and wobbles to rest. Undone, it settles back down and the badge returns.
  grow(tower, age, dt) {
    let height = 1, width = 1, badge = 1, spin = 0
    if (age >= 0) {
      const off = age / 0.4
      badge = off < 0.35 ? 1 + Math.sin(off / 0.35 * Math.PI / 2) * 0.22 : 1.22 * Math.max(0, 1 - ((off - 0.35) / 0.65) ** 2)
      spin = Math.min(1, off) * Math.PI * 1.5
      if (age < 0.2) height = 1
      else if (age < 0.45) {
        const u = Math.sin((age - 0.2) / 0.25 * Math.PI / 2)
        height = 1 - 0.22 * u
        width = 1 + 0.14 * u
      } else {
        const t = age - 0.45
        height = TALL + (0.78 - TALL) * Math.exp(-4.5 * t) * Math.cos(11 * t)
        width = 1 - (height - TALL) * 0.35
      }
      tower.height = height; tower.width = width; tower.badgeScale = badge
    } else {
      // Ease back to the way it stood before it was lit.
      const ease = 1 - Math.exp(-dt * 8)
      tower.height = (tower.height ?? 1) + (1 - (tower.height ?? 1)) * ease
      tower.width = (tower.width ?? 1) + (1 - (tower.width ?? 1)) * ease
      tower.badgeScale = (tower.badgeScale ?? 1) + (1 - (tower.badgeScale ?? 1)) * ease
      height = tower.height; width = tower.width; badge = tower.badgeScale
    }
    tower.shaft.scale.set(width, height, width)
    tower.top.position.y = SHAFT * height
    tower.top.scale.setScalar(Math.max(0.85, Math.min(1.12, width)))
    tower.badge.visible = badge > 0.01
    tower.badge.scale.setScalar(Math.max(0.001, badge))
    tower.badge.rotation.y = spin
    // From above, height barely shows, so a grown lighthouse also stands a little larger overall.
    tower.group.scale.setScalar(TOWER_SCALE * (1 + 0.2 * clamp((height - 1) / (TALL - 1), -0.5, 1.2)))
  }

  // The lamp flickers on twice and then glows, with a burst of sparkles as it catches.
  lamp(tower, age, reducedMotion) {
    const on = age >= 1 && !(age > 1.08 && age < 1.16) && !(age > 1.24 && age < 1.3)
    tower.lamp.material = on ? this.materials.glassOn : this.materials.glassOff
    for (const spark of tower.sparkles) {
      const t = reducedMotion ? 1 : (age - 1.3) / 0.8
      spark.visible = t > 0 && t < 1
      if (!spark.visible) continue
      const radius = 0.05 + t * 0.2, angle = spark.userData.angle + t * 0.8
      spark.position.set(Math.cos(angle) * radius, 0.054 + Math.sin(t * Math.PI) * 0.08, Math.sin(angle) * radius)
      spark.scale.setScalar(Math.max(0.001, (1 - t) * 1.2))
    }
  }

  // Now and then, at random, a lit lighthouse sweeps its beam slowly around once and fades.
  sweepNowAndThen(tower, time, age, reducedMotion) {
    if (age < 0 || reducedMotion) { tower.sweep.visible = false; tower.nextSweep = null; tower.sweeping = null; return }
    tower.nextSweep ??= time + 10 + Math.random() * 30
    if (!tower.sweeping && time > tower.nextSweep) tower.sweeping = { start: time, from: Math.random() * Math.PI * 2 }
    const sweeping = tower.sweeping
    tower.sweep.visible = !!sweeping
    if (!sweeping) return
    const u = (time - sweeping.start) / 6
    if (u >= 1) { tower.sweeping = null; tower.nextSweep = time + 35 + Math.random() * 50; tower.sweep.visible = false; return }
    tower.sweep.rotation.y = sweeping.from + u * Math.PI * 1.6
    tower.sweep.material.uniforms.uStrength.value = 0.2 * Math.sin(u * Math.PI)
  }

  // The sailboat sets out once the lamp is lit, drifting out along the lit water and back again.
  sail(tower, time, age, reducedMotion) {
    const route = tower.route
    tower.boat.visible = age > 1.4 && !!route && route.length > 1
    if (!tower.boat.visible) return
    const span = route.length - 1
    const phase = (age - 1.4) * 0.35 / Math.max(1, span) * Math.PI * 2 - Math.PI / 2
    const t = reducedMotion ? 0.5 : (Math.sin(phase) + 1) / 2
    const at = t * span, i = Math.min(span - 1, Math.floor(at)), f = at - i
    tower.boat.position.lerpVectors(route[i], route[i + 1], f)
    tower.boat.position.y = WATER_Y + 0.02 + Math.sin(time * 2.2) * 0.008
    const heading = Math.atan2(route[i + 1].x - route[i].x, route[i + 1].z - route[i].z)
    tower.boat.rotation.set(Math.sin(time * 1.7) * 0.06, heading + (Math.cos(phase) >= 0 ? 0 : Math.PI), Math.sin(time * 1.3) * 0.08)
    tower.boat.scale.setScalar(2.2 * Math.min(1, pop((age - 1.4) / 0.5)))
  }


  get litCount() { return [...this.towers.values()].filter((tower) => tower.lit).length }
  get dotCount() { return this.dots.count }
}
