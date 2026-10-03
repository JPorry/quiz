import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { lighthouses } from './lighthouses.js'

const LAND_TOP = 0.44
const WATER_Y = 0.06
const DOTS = 120
const TOWER_SCALE = 1.75
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

  buildTower(sees) {
    const garden = this.garden
    const m = this.materials
    const group = new THREE.Group()
    const tower = new THREE.Group()
    group.add(tower)
    garden.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 16), m.dark, tower, 0, 0.02, 0)
    garden.mesh(new THREE.CylinderGeometry(0.065, 0.095, 0.3, 16), m.white, tower, 0, 0.19, 0)
    for (const y of [0.12, 0.24]) garden.mesh(new THREE.CylinderGeometry(0.09 - y * 0.1, 0.092 - y * 0.1, 0.045, 16), m.red, tower, 0, y, 0)
    garden.mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.018, 16), m.dark, tower, 0, 0.345, 0)
    garden.mesh(new THREE.ConeGeometry(0.075, 0.08, 16), m.red, tower, 0, 0.455, 0)
    garden.mesh(new THREE.SphereGeometry(0.014, 8, 6), m.dark, tower, 0, 0.5, 0)
    garden.mergeDetails(tower)
    const lamp = garden.mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 16), m.glassOff, group, 0, 0.39, 0)
    // A small numbered badge stands in front of the tower, tipped toward the camera.
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
    const sweep = new THREE.Mesh(this.wedge, this.beamMaterial)
    sweep.position.y = 0.39
    sweep.visible = false
    sweep.renderOrder = 24
    group.add(sweep)
    return { group, lamp, sweep, badge }
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
      tower.group.traverse((child) => {
        if (child.geometry !== this.wedge) child.geometry?.dispose()
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
    for (const tower of this.towers.values()) {
      tower.cell.plants.visible = false
      const lit = tower.lit
      const age = lit ? time - lit.at : -1
      tower.lamp.material = lit && age >= 0 ? this.materials.glassOn : this.materials.glassOff
      // The tower gives a little hop as its lamp comes on.
      const hop = lit && !reducedMotion && age >= 0 && age < 0.5 ? Math.sin(age / 0.5 * Math.PI) * 0.12 : 0
      tower.group.scale.setScalar(TOWER_SCALE * (1 + hop))
      tower.sweep.visible = !!lit && !reducedMotion && age > 0.3
      if (tower.sweep.visible) tower.sweep.rotation.y = time * 0.6 + tower.light.cell[0]
      // The sailboat drifts out along the lit water and back again.
      const route = tower.route
      tower.boat.visible = !!lit && !!route && route.length > 1 && age > 0.6
      if (tower.boat.visible) {
        const span = route.length - 1
        const t = reducedMotion ? 0.5 : (Math.sin((time - lit.at) * 0.35 / Math.max(1, span) * Math.PI * 2 - Math.PI / 2) + 1) / 2
        const at = t * span, i = Math.min(span - 1, Math.floor(at)), f = at - i
        tower.boat.position.lerpVectors(route[i], route[i + 1], f)
        tower.boat.position.y = WATER_Y + 0.02 + Math.sin(time * 2.2) * 0.008
        const heading = Math.atan2(route[i + 1].x - route[i].x, route[i + 1].z - route[i].z)
        const going = Math.cos((time - lit.at) * 0.35 / Math.max(1, span) * Math.PI * 2 - Math.PI / 2) >= 0
        tower.boat.rotation.set(Math.sin(time * 1.7) * 0.06, heading + (going ? 0 : Math.PI), Math.sin(time * 1.3) * 0.08)
        tower.boat.scale.setScalar(2.2 * Math.min(1, pop((age - 0.6) / 0.5)))
      }
    }
    // Dots breathe gently, so they read as light rather than markings.
    this.dots.material.opacity = reducedMotion ? 0.8 : 0.7 + Math.sin(time * 2.4) * 0.15
  }

  get litCount() { return [...this.towers.values()].filter((tower) => tower.lit).length }
  get dotCount() { return this.dots.count }
}
