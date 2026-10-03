import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { ferries } from './ferries.js'

const LAND_TOP = 0.44
const WATER_Y = 0.06
const DOCK_SCALE = 1.5
const FERRY_SCALE = 1.3
// Ferries are in no hurry: they amble along at about a quarter of a tile a second, and rest at
// each dock for a good while before setting off again.
const SPEED = 0.26
const REST = [9, 15]
const SMOKE = 64, PUFFS = 5
const WAKE = 96, WAKE_LIFE = 2.4
const clamp = THREE.MathUtils.clamp
const pop = (t) => { const x = clamp(t, 0, 1); return 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2 }
const ease = (t) => t * t * (3 - 2 * t)
const turn = (from, to, amount) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount

export const ROOF_COLORS = Object.freeze({ coral: 0xf08a7e, sun: 0xf5c35a, sky: 0x72b6e2, lilac: 0xb59ae0 })

const world = ([row, col]) => new THREE.Vector3(col - 4.5, WATER_Y, row - 4.5)

// Docks on the garden's starting land, in matching pairs, each with a little ferry of its own.
// While a pair is apart, its docks wait with their colored roofs. Once water joins them, a jetty
// unrolls from each dock, the ferry bobs up beside the first one with a toot, and from then on it
// ambles slowly across to the other dock, rests there a while, and comes back again.
export class Harbors {
  constructor(garden) {
    this.garden = garden
    this.docks = new Map()
    this.routes = []
    const m = (color) => new THREE.MeshLambertMaterial({ color })
    this.materials = {
      wood: m(0xc8935f), plank: m(0xdcaa72), post: m(0x8a5d3b), cream: m(0xfff3dc), white: m(0xfdf8ee),
      dark: m(0x4f5d66), window: m(0x6c8e9c), glow: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }),
      roofs: Object.fromEntries(Object.entries(ROOF_COLORS).map(([name, color]) => [name, m(color)])),
    }
    this.smoke = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf6f8f9, transparent: true, opacity: 0.8, depthWrite: false }), SMOKE)
    this.smoke.count = 0
    this.smoke.frustumCulled = false
    garden.scene.add(this.smoke)
    this.wake = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), WAKE)
    this.wake.count = 0
    this.wake.renderOrder = 3
    this.wake.frustumCulled = false
    garden.scene.add(this.wake)
    this.foam = []
    this.dummy = new THREE.Object3D()
    this.funnelAt = new THREE.Vector3()
  }

  cell(row, col) { return this.garden.cells[row * 10 + col] }

  // A little ticket hut on the grass under a colored roof, with a porch, a lifebuoy, and a pennant.
  buildDock(color) {
    const garden = this.garden
    const m = this.materials
    const roof = m.roofs[color]
    const group = new THREE.Group()
    // The hut stands on the grass with only a little porch in front, so the tile still reads as land.
    garden.mesh(new RoundedBoxGeometry(0.2, 0.02, 0.08, 2, 0.008), m.wood, group, -0.03, 0.01, 0.1)
    for (const x of [-0.1, 0.04]) garden.mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.04, 8), m.dark, group, x, 0.02, 0.15)
    const buoy = garden.mesh(new THREE.TorusGeometry(0.034, 0.013, 8, 18), roof, group, 0.13, 0.014, 0.1)
    buoy.rotation.x = Math.PI / 2
    garden.mergeDetails(group)
    const hut = new THREE.Group()
    hut.position.set(-0.03, 0, -0.04)
    group.add(hut)
    garden.mesh(new RoundedBoxGeometry(0.2, 0.15, 0.17, 3, 0.03), m.cream, hut, 0, 0.075, 0)
    garden.mesh(new RoundedBoxGeometry(0.06, 0.09, 0.02, 2, 0.01), m.post, hut, 0, 0.045, 0.086)
    garden.mesh(new THREE.SphereGeometry(0.022, 10, 8), m.window, hut, 0.062, 0.095, 0.083).scale.set(1, 1, 0.3)
    const cap = garden.mesh(new THREE.ConeGeometry(0.17, 0.12, 4), roof, hut, 0, 0.21, 0)
    cap.rotation.y = Math.PI / 4
    cap.scale.set(1, 1, 0.86)
    garden.mesh(new THREE.SphereGeometry(0.016, 8, 6), m.white, hut, 0, 0.275, 0)
    garden.mergeDetails(hut)
    const pole = new THREE.Group()
    pole.position.set(0.14, 0, -0.12)
    group.add(pole)
    garden.mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.3, 6), m.white, pole, 0, 0.15, 0)
    garden.mesh(new THREE.SphereGeometry(0.014, 8, 6), m.roofs[color], pole, 0, 0.305, 0)
    const pennant = new THREE.Shape()
    pennant.moveTo(0, 0); pennant.quadraticCurveTo(0.07, 0.01, 0.13, -0.03); pennant.quadraticCurveTo(0.07, -0.05, 0, -0.08); pennant.closePath()
    const flagMaterial = roof.clone()
    flagMaterial.side = THREE.DoubleSide
    const flag = garden.mesh(new THREE.ShapeGeometry(pennant), flagMaterial, pole, 0, 0.29, 0)
    flag.castShadow = false
    group.scale.setScalar(DOCK_SCALE)
    return { group, hut, flag }
  }

  // Planks that unroll from the dock out over the water toward where the ferry moors.
  buildJetty() {
    const garden = this.garden
    const group = new THREE.Group()
    const planks = []
    for (let i = 0; i < 5; i++) {
      const plank = new THREE.Group()
      plank.position.set(0, 0, 0.3 + i * 0.095)
      garden.mesh(new RoundedBoxGeometry(0.2, 0.025, 0.09, 2, 0.01), i % 2 ? this.materials.plank : this.materials.wood, plank, 0, 0, 0)
      if (i % 2) for (const x of [-0.085, 0.085]) garden.mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 6), this.materials.post, plank, x, -0.2, 0)
      group.add(plank)
      planks.push(plank)
    }
    group.visible = false
    return { group, planks }
  }

  // A chubby little ferry: a white hull with a colored band, a cream cabin with round windows under a
  // colored roof, and a funnel that puffs. Its bow points along +z.
  buildFerry(color) {
    const garden = this.garden
    const m = this.materials
    const roof = m.roofs[color]
    const group = new THREE.Group()
    const body = new THREE.Group()
    group.add(body)
    garden.mesh(new RoundedBoxGeometry(0.25, 0.1, 0.42, 4, 0.05), m.white, body, 0, 0.03, 0)
    garden.mesh(new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.white, body, 0, 0.0, 0.16).scale.set(1, 0.65, 0.8)
    garden.mesh(new RoundedBoxGeometry(0.262, 0.03, 0.4, 3, 0.014), roof, body, 0, 0.045, -0.01)
    garden.mesh(new RoundedBoxGeometry(0.17, 0.1, 0.19, 4, 0.04), m.cream, body, 0, 0.12, -0.04)
    for (const z of [-0.09, -0.02]) for (const x of [-0.086, 0.086]) garden.mesh(new THREE.SphereGeometry(0.017, 10, 8), m.window, body, x, 0.125, z).scale.set(0.35, 1, 1)
    garden.mesh(new THREE.SphereGeometry(0.02, 10, 8), m.window, body, 0, 0.125, 0.055).scale.set(1, 1, 0.35)
    garden.mesh(new RoundedBoxGeometry(0.2, 0.03, 0.22, 3, 0.014), roof, body, 0, 0.18, -0.04)
    garden.mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.08, 12), roof, body, 0, 0.23, -0.07)
    garden.mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.018, 12), m.dark, body, 0, 0.27, -0.07)
    garden.mesh(new THREE.TorusGeometry(0.026, 0.009, 6, 14), roof, body, 0, 0.09, 0.15).rotation.y = Math.PI / 2
    garden.mergeDetails(body)
    group.visible = false
    group.scale.setScalar(FERRY_SCALE)
    garden.scene.add(group)
    return { group, body, funnel: new THREE.Vector3(0, 0.29, -0.07) }
  }

  set(routes = []) {
    for (const dock of this.docks.values()) {
      dock.group.parent?.remove(dock.group)
      dock.jetty.group.parent?.remove(dock.jetty.group)
      for (const object of [dock.group, dock.jetty.group]) object.traverse((child) => child.geometry?.dispose())
      dock.cell.plants.visible = true
    }
    for (const route of this.routes) {
      route.ferry.group.parent?.remove(route.ferry.group)
      route.ferry.group.traverse((child) => child.geometry?.dispose())
    }
    this.docks.clear()
    this.foam = []
    this.routes = routes.map((route, index) => {
      const piers = route.docks.map(([row, col]) => {
        const cell = this.cell(row, col)
        const built = this.buildDock(route.color)
        built.group.position.y = LAND_TOP
        cell.land.add(built.group)
        const jetty = this.buildJetty()
        jetty.group.position.y = LAND_TOP - 0.06
        cell.land.add(jetty.group)
        cell.plants.visible = false
        const dock = { ...built, jetty, cell, at: [row, col], open: null, mooring: null, outward: 0 }
        this.docks.set(row * 10 + col, dock)
        return dock
      })
      return { ...route, index, piers, ferry: this.buildFerry(route.color), state: null, joined: null, trip: null }
    })
  }

  isDock(index) { return this.docks.has(index) }

  update(grid, time, animate) {
    this.grid = grid
    const states = ferries(grid, this.routes)
    this.routes.forEach((route, index) => {
      const state = states[index]
      route.state = state
      if (state.complete && !route.joined) {
        route.joined = { at: animate ? time : -100 }
        // A crossing that opens in play starts with the ferry bobbing up at the first dock. One that was
        // already open when the garden opened finds its ferry resting at either dock, in no hurry.
        route.trip = animate
          ? { phase: 'docked', at: 0, since: time, until: time + 5 + Math.random() * 3, surfaceAt: time, splashed: false }
          : { phase: 'docked', at: Math.random() < 0.5 ? 0 : 1, since: -100, until: time + 2 + Math.random() * REST[1] }
        route.ferry.heading = null
        if (animate) this.onJoined?.()
      } else if (!state.complete && route.joined) {
        route.joined = null
        route.sinking = { at: animate ? time : -100 }
      }
      // Each dock's jetty reaches toward the water its ferry leaves from.
      if (state.complete) {
        const ends = [state.path[0], state.path.at(-1)]
        route.piers.forEach((dock, end) => {
          const [r, c] = ends[end]
          dock.open = ends[end]
          dock.outward = Math.atan2(c - dock.at[1], r - dock.at[0])
          dock.mooring = world(dock.at).lerp(world(ends[end]), 1.04)
          dock.jetty.group.rotation.y = dock.outward
        })
      }
      // A ferry that finds land across its course slips under and comes back up at the dock it left.
      const trip = route.trip
      if (trip?.phase === 'sailing' && trip.cells.some(([r, c]) => grid[r][c] !== 0)) {
        route.trip = { phase: 'docked', at: trip.from, since: time, until: time + 4, surfaceAt: time + 0.3, splashed: false }
      }
    })
  }

  animate(time, reducedMotion) {
    const dt = clamp(time - (this.lastTime ?? time), 0, 0.1)
    this.lastTime = time
    for (const dock of this.docks.values()) dock.cell.plants.visible = false
    for (const route of this.routes) {
      const age = route.joined ? (reducedMotion ? 10 : time - route.joined.at) : -1
      route.piers.forEach((dock) => this.animateDock(dock, time, age, reducedMotion))
      this.animateFerry(route, time, dt, age, reducedMotion)
    }
    this.animateSmoke(time, reducedMotion)
    this.animateWake(time)
  }

  // The pennant flutters, and when water first joins the pair the hut gives a happy hop while the
  // jetty's planks pop out one after another.
  animateDock(dock, time, age, reducedMotion) {
    dock.flag.rotation.y = reducedMotion ? 0 : Math.sin(time * 3.1 + dock.at[0]) * 0.35
    dock.flag.scale.y = reducedMotion ? 1 : 1 + Math.sin(time * 5.3 + dock.at[1]) * 0.06
    const hop = age >= 0 && age < 0.6 ? Math.sin(age / 0.6 * Math.PI) : 0
    dock.hut.position.y = hop * 0.06
    dock.hut.scale.set(1 + hop * 0.08, 1 - hop * 0.04 + (age >= 0 && age < 0.2 ? -0.1 : 0), 1 + hop * 0.08)
    dock.jetty.group.visible = age >= 0
    if (age < 0) return
    dock.jetty.planks.forEach((plank, i) => plank.scale.setScalar(Math.max(0.001, pop((age - 0.15 - i * 0.09) / 0.35))))
  }

  animateFerry(route, time, dt, age, reducedMotion) {
    const ferry = route.ferry
    if (age < 0) {
      // Undone: the ferry slips quietly beneath the water.
      const sinking = route.sinking ? time - route.sinking.at : 10
      ferry.group.visible = sinking < 0.6 && ferry.group.visible
      if (ferry.group.visible) {
        ferry.group.position.y = WATER_Y - sinking * 0.25
        ferry.group.scale.setScalar(FERRY_SCALE * (1 - sinking / 0.6))
      }
      route.trip = null
      return
    }
    let trip = route.trip
    if (reducedMotion) trip = route.trip = { phase: 'docked', at: 0, since: -100, until: Infinity }
    // Rested long enough: set off for the other dock along the water as it lies now.
    if (trip.phase === 'docked' && time > trip.until && route.state?.path) {
      const to = 1 - trip.at
      const cells = trip.at === 0 ? route.state.path : [...route.state.path].reverse()
      // Every crossing sets off from the jetty the ferry is resting at.
      const points = [route.piers[trip.at].mooring.clone(), ...cells.slice(1, -1).map(world), route.piers[to].mooring.clone()]
      if (points.length > 2 && points[0].distanceTo(points[1]) < 0.05) points.splice(1, 1)
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
      const duration = Math.max(4, curve.getLength() / SPEED)
      trip = route.trip = { phase: 'sailing', from: trip.at, to, cells, curve, start: time, duration }
    }
    let x, z, heading, speed = 0, bump = 0
    const dock = route.piers[trip.phase === 'docked' ? trip.at : trip.to]
    if (trip.phase === 'sailing') {
      const u = clamp((time - trip.start) / trip.duration, 0, 1)
      const along = ease(u)
      const point = trip.curve.getPointAt(along)
      const tangent = trip.curve.getTangentAt(along)
      x = point.x; z = point.z
      heading = Math.atan2(tangent.x, tangent.z)
      speed = 6 * u * (1 - u)
      if (u >= 1) {
        route.trip = { phase: 'docked', at: trip.to, since: time, until: time + REST[0] + Math.random() * (REST[1] - REST[0]) }
        this.garden.waterLife?.ring(x, z, time, 2)
      }
      if (!reducedMotion && time - (ferry.lastFoam ?? 0) > 0.22 && speed > 0.2) {
        ferry.lastFoam = time
        const back = new THREE.Vector3(x - Math.sin(heading) * 0.28, 0, z - Math.cos(heading) * 0.28)
        for (const side of [-1, 1]) this.foam.push({ x: back.x + Math.cos(heading) * side * 0.07, z: back.z - Math.sin(heading) * side * 0.07, born: time, drift: side })
        if (this.foam.length > WAKE) this.foam.splice(0, this.foam.length - WAKE)
      }
    } else {
      // Moored beside the jetty, turning slowly to face back out to sea.
      const mooring = dock.mooring
      x = mooring.x; z = mooring.z
      heading = dock.outward
      const settled = time - trip.since
      bump = settled < 1.2 ? Math.sin(settled / 1.2 * Math.PI * 2) * Math.exp(-settled * 2.5) : 0
      if (trip.surfaceAt !== undefined && !trip.splashed && time >= trip.surfaceAt) {
        trip.splashed = true
        this.garden.waterLife?.ring(x, z, time, 1)
        this.garden.waterLife?.spray(x, z, 10, time, { speed: 0.5, lift: 1.1 })
      }
    }
    ferry.heading = ferry.heading == null || reducedMotion ? heading : turn(ferry.heading, heading, 1 - Math.exp(-dt * (trip.phase === 'sailing' ? 4 : 0.9)))
    // Bobbing up out of the water the first time the pair is joined, or after slipping under.
    const rise = trip.phase === 'docked' && trip.surfaceAt !== undefined ? (time < trip.surfaceAt ? 0 : pop((time - trip.surfaceAt) / 0.7)) : 1
    ferry.group.visible = rise > 0.01
    ferry.group.position.set(x, WATER_Y - 0.035 + (reducedMotion ? 0 : Math.sin(time * 2.1 + route.index) * 0.008) - (1 - Math.min(1, rise)) * 0.1, z)
    ferry.group.rotation.set(0, ferry.heading, 0)
    ferry.body.rotation.set(reducedMotion ? 0 : -speed * 0.04 + Math.sin(time * 1.6 + route.index) * 0.03 + bump * 0.06, 0, reducedMotion ? 0 : Math.sin(time * 1.3 + route.index * 2) * 0.05)
    ferry.group.scale.set(FERRY_SCALE * Math.max(0.001, rise) * (1 + bump * 0.04), FERRY_SCALE * Math.max(0.001, rise) * (1 - bump * 0.05), FERRY_SCALE * Math.max(0.001, rise))
    ferry.speed = speed
  }

  // Soft puffs from each funnel: a lazy trail while sailing, the odd wisp while moored.
  animateSmoke(time, reducedMotion) {
    let n = 0
    if (!reducedMotion) {
      for (const route of this.routes) {
        const ferry = route.ferry
        if (!route.joined || !ferry.group.visible || n + PUFFS > SMOKE) continue
        ferry.body.updateWorldMatrix(true, false)
        this.funnelAt.copy(ferry.funnel).applyMatrix4(ferry.body.matrixWorld)
        const busy = 0.35 + (ferry.speed ?? 0) * 0.45
        for (let i = 0; i < PUFFS; i++) {
          const t = (time / 2.8 + i / PUFFS + route.index * 0.37) % 1
          const size = (0.022 + t * 0.06) * Math.sin(Math.min(1, t * 1.8) * Math.PI / 2) * (1 - t * t) * busy * 1.6
          this.dummy.position.set(this.funnelAt.x - Math.sin(ferry.heading) * t * 0.25 + Math.sin(t * 5 + i) * 0.03, this.funnelAt.y + t * 0.45, this.funnelAt.z - Math.cos(ferry.heading) * t * 0.25)
          this.dummy.scale.setScalar(Math.max(0.001, size))
          this.dummy.updateMatrix()
          this.smoke.setMatrixAt(n++, this.dummy.matrix)
        }
      }
    }
    this.smoke.count = n
    this.smoke.instanceMatrix.needsUpdate = true
  }

  // Little foam blobs left behind on either side of the stern, spreading and fading away.
  animateWake(time) {
    this.foam = this.foam.filter((blob) => time - blob.born < WAKE_LIFE)
    this.foam.forEach((blob, i) => {
      const t = (time - blob.born) / WAKE_LIFE
      this.dummy.position.set(blob.x, WATER_Y + 0.012, blob.z)
      this.dummy.rotation.set(0, 0, 0)
      this.dummy.scale.setScalar(Math.max(0.001, (0.03 + t * 0.07) * (1 - t)))
      this.dummy.updateMatrix()
      this.wake.setMatrixAt(i, this.dummy.matrix)
    })
    this.wake.count = this.foam.length
    this.wake.instanceMatrix.needsUpdate = true
  }

  // Sends every moored ferry off now, for screenshots and testing.
  depart() { for (const route of this.routes) if (route.trip?.phase === 'docked') route.trip.until = 0 }

  get dockCount() { return this.docks.size }
  get joinedCount() { return this.routes.filter((route) => route.joined).length }
  get sailingCount() { return this.routes.filter((route) => route.joined && route.trip?.phase === 'sailing').length }
}
