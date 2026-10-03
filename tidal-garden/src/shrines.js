import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { pilgrimages } from './pilgrims.js'

const LAND_TOP = 0.44
const SHRINE_SCALE = 1.9
const PILGRIM_SCALE = 2.4
const PATH_SCALE = 1.35
// Pilgrims are in no hurry: they stroll at about a fifth of a tile a second, and rest at each
// shrine for a good while, bowing now and then, before setting off again.
const SPEED = 0.2
const REST = [9, 15]
// Where a resting pilgrim stands: on the shrine's tile, a little way toward the path.
const REST_OFFSET = 0.32
const clamp = THREE.MathUtils.clamp
const pop = (t) => { const x = clamp(t, 0, 1); return 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2 }
const ease = (t) => t * t * (3 - 2 * t)
const turn = (from, to, amount) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

export const LANTERN_COLORS = Object.freeze({ rose: 0xf29bb5, mint: 0x7fd3ae, amber: 0xf3a64a, violet: 0x9a8be0 })

const center = ([row, col]) => new THREE.Vector3(col - 4.5, LAND_TOP, row - 4.5)

// Shrines on the garden's starting land, in matching pairs, each with a little pilgrim of its own.
// While a pair is apart, its shrines wait with their colored roofs and paper lanterns. Once land
// joins them, the trees step aside for a stepping-stone path, lanterns pop up along it, and a tiny
// pilgrim in a straw hat steps out with the ring of a temple bell. From then on the pilgrim strolls
// slowly over to the other shrine, rests and bows there a while, and walks back again.
export class Shrines {
  constructor(garden) {
    this.garden = garden
    this.shrines = new Map()
    this.pairs = []
    const m = (color) => new THREE.MeshLambertMaterial({ color })
    this.materials = {
      stone: m(0xd8d2c6), stoneDark: m(0xb9b2a6), wood: m(0x9c6446), torii: m(0xe0583f), toriiTop: m(0x4d4040),
      robe: m(0xf7f0e4), skin: m(0xf3cfb0), hat: m(0xe3c47e), staff: m(0x8a5d3b), dark: m(0x4f4646), path: m(0xe6e0d4),
      roofs: Object.fromEntries(Object.entries(LANTERN_COLORS).map(([name, color]) => [name, m(color)])),
      glows: Object.fromEntries(Object.entries(LANTERN_COLORS).map(([name, color]) => [name, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xfff6dc), 0.2) })])),
    }
    this.geometries = {
      stone: new THREE.CylinderGeometry(0.06, 0.066, 0.018, 12),
      post: new THREE.CylinderGeometry(0.01, 0.012, 0.09, 6),
      lantern: new THREE.SphereGeometry(0.03, 12, 10),
      cap: new THREE.CylinderGeometry(0.009, 0.012, 0.01, 10),
    }
  }

  cell(row, col) { return this.garden.cells[row * 10 + col] }

  // A little shrine on the grass: a stone step, a wooden hall under a colored roof with turned-up
  // eaves, a tiny red gate in front, and a paper lantern on a post that glows in the pair's color.
  buildShrine(color) {
    const garden = this.garden
    const m = this.materials
    const group = new THREE.Group()
    const hall = new THREE.Group()
    group.add(hall)
    garden.mesh(new RoundedBoxGeometry(0.22, 0.03, 0.2, 2, 0.012), m.stone, hall, 0, 0.015, -0.03)
    garden.mesh(new RoundedBoxGeometry(0.14, 0.1, 0.12, 2, 0.02), m.wood, hall, 0, 0.08, -0.04)
    garden.mesh(new RoundedBoxGeometry(0.05, 0.065, 0.01, 2, 0.004), m.dark, hall, 0, 0.065, 0.021)
    garden.mesh(new RoundedBoxGeometry(0.25, 0.016, 0.22, 2, 0.007), m.toriiTop, hall, 0, 0.135, -0.04)
    const roof = garden.mesh(new THREE.ConeGeometry(0.16, 0.085, 4), m.roofs[color], hall, 0, 0.18, -0.04)
    roof.rotation.y = Math.PI / 4
    roof.scale.set(1, 1, 0.9)
    garden.mesh(new THREE.SphereGeometry(0.016, 8, 6), m.toriiTop, hall, 0, 0.225, -0.04)
    // The little gate in front of the hall.
    for (const x of [-0.06, 0.06]) garden.mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.12, 8), m.torii, hall, x, 0.06, 0.11)
    garden.mesh(new RoundedBoxGeometry(0.17, 0.016, 0.022, 2, 0.007), m.toriiTop, hall, 0, 0.128, 0.11)
    garden.mesh(new RoundedBoxGeometry(0.14, 0.012, 0.016, 2, 0.005), m.torii, hall, 0, 0.1, 0.11)
    garden.mergeDetails(hall)
    // The pair's paper lantern, on its own so it can sway and brighten.
    const lantern = new THREE.Group()
    lantern.position.set(0.13, 0, 0.04)
    group.add(lantern)
    garden.mesh(this.geometries.post, m.staff, lantern, 0, 0.045, 0)
    const paper = new THREE.Group()
    paper.position.y = 0.1
    lantern.add(paper)
    garden.mesh(this.geometries.lantern, m.glows[color], paper, 0, 0, 0).scale.set(1.1, 1.3, 1.1)
    for (const y of [-0.04, 0.04]) garden.mesh(this.geometries.cap, m.dark, paper, 0, y, 0)
    group.scale.setScalar(SHRINE_SCALE)
    return { group, hall, paper }
  }

  // A tiny pilgrim: a round white robe, a little face under a straw hat tied with a ribbon in the
  // pair's color, a matching bundle on their back, and a walking staff. Faces +z.
  buildPilgrim(color) {
    const garden = this.garden
    const m = this.materials
    const group = new THREE.Group()
    const body = new THREE.Group()
    group.add(body)
    garden.mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.085, 14), m.robe, body, 0, 0.0425, 0)
    garden.mesh(new THREE.SphereGeometry(0.031, 14, 10), m.robe, body, 0, 0.085, 0)
    garden.mesh(new THREE.SphereGeometry(0.03, 14, 10), m.skin, body, 0, 0.122, 0.004)
    for (const x of [-0.011, 0.011]) garden.mesh(new THREE.SphereGeometry(0.0045, 6, 4), m.dark, body, x, 0.125, 0.032)
    garden.mesh(new THREE.ConeGeometry(0.058, 0.042, 18), m.hat, body, 0, 0.162, 0)
    garden.mesh(new THREE.TorusGeometry(0.044, 0.008, 6, 18), m.roofs[color], body, 0, 0.152, 0).rotation.x = Math.PI / 2
    garden.mesh(new RoundedBoxGeometry(0.06, 0.06, 0.04, 2, 0.016), m.roofs[color], body, 0, 0.075, -0.05)
    garden.mergeDetails(body)
    const staff = new THREE.Group()
    staff.position.set(0.05, 0.02, 0.02)
    body.add(staff)
    garden.mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 6), m.staff, staff, 0, 0.065, 0)
    garden.mesh(new THREE.SphereGeometry(0.008, 8, 6), m.hat, staff, 0, 0.15, 0)
    group.visible = false
    group.scale.setScalar(PILGRIM_SCALE)
    garden.scene.add(group)
    return { group, body, staff }
  }

  set(pairs = []) {
    for (const shrine of this.shrines.values()) {
      shrine.group.parent?.remove(shrine.group)
      shrine.hall.traverse((child) => child.geometry?.dispose())
      shrine.cell.plants.visible = true
    }
    for (const pair of this.pairs) {
      this.clearPath(pair)
      pair.pilgrim.group.parent?.remove(pair.pilgrim.group)
      pair.pilgrim.group.traverse((child) => child.geometry?.dispose())
    }
    this.shrines.clear()
    this.pairs = pairs.map((pair, index) => {
      const ends = pair.shrines.map(([row, col]) => {
        const cell = this.cell(row, col)
        const built = this.buildShrine(pair.color)
        built.group.position.y = LAND_TOP
        cell.land.add(built.group)
        cell.plants.visible = false
        const shrine = { ...built, cell, at: [row, col], rest: null, facing: 0 }
        this.shrines.set(row * 10 + col, shrine)
        return shrine
      })
      return { ...pair, index, ends, pilgrim: this.buildPilgrim(pair.color), state: null, joined: null, trip: null, path: null, pathKey: '', marks: [] }
    })
  }

  isShrine(index) { return this.shrines.has(index) }

  // Tiles that carry some other clue keep it; the path passes them by without stones or lanterns.
  isBusy(index) {
    const garden = this.garden
    return this.shrines.has(index) || garden.harbors?.isDock(index) || garden.beacons?.isTower(index) || garden.villages?.signModels.has(index)
  }

  update(grid, time, animate) {
    this.grid = grid
    const states = pilgrimages(grid, this.pairs)
    this.pairs.forEach((pair, index) => {
      const state = states[index]
      pair.state = state
      if (state.complete && !pair.joined) {
        pair.joined = { at: animate ? time : -100 }
        // A pilgrimage that opens in play starts with the pilgrim stepping out of the first shrine.
        // One already open when the garden opened finds its pilgrim resting at either shrine.
        pair.trip = animate
          ? { phase: 'resting', at: 0, since: time, until: time + 5 + Math.random() * 3, appearAt: time + 0.5 }
          : { phase: 'resting', at: Math.random() < 0.5 ? 0 : 1, since: -100, until: time + 2 + Math.random() * REST[1] }
        pair.pilgrim.heading = null
        if (animate) this.onJoined?.()
      } else if (!state.complete && pair.joined) {
        pair.joined = null
        pair.leaving = { at: animate ? time : -100 }
      }
      if (state.complete) {
        const path = state.path
        pair.ends.forEach((shrine, end) => {
          const next = end === 0 ? path[1] : path.at(-2)
          const toward = new THREE.Vector3(next[1] - shrine.at[1], 0, next[0] - shrine.at[0]).normalize()
          shrine.rest = center(shrine.at).addScaledVector(toward, REST_OFFSET)
          shrine.facing = Math.atan2(-toward.x, -toward.z)
        })
      }
      // A pilgrim who finds water across their way slips back to the shrine they set out from.
      const trip = pair.trip
      if (trip?.phase === 'walking' && trip.cells.some(([r, c]) => grid[r][c] !== 1)) {
        pair.trip = { phase: 'resting', at: trip.from, since: time, until: time + 4, appearAt: time + 0.3 }
      }
    })
    // Paths are laid out together, so a tile two paths share gets one set of stones and lanterns.
    const keys = states.map((state) => (state.complete ? state.path.map(String).join('|') : ''))
    if (keys.some((key, index) => key !== this.pairs[index].pathKey)) {
      const claimed = new Set()
      this.pairs.forEach((pair, index) => {
        const changed = keys[index] !== pair.pathKey
        // Paths that stay put keep their lanterns lit; new ones pop up, and closed ones fade away.
        this.clearPath(pair, changed && animate ? time : -100)
        if (keys[index]) this.layPath(pair, states[index].path, changed && animate ? time : -100, claimed)
      })
    }
    // Trees on a path step aside; everywhere else they stand.
    this.updatePlants()
  }

  // Stepping stones through every tile of the path, and a glowing lantern beside each, popping up
  // one after another from the first shrine to the second.
  layPath(pair, path, time, claimed = new Set()) {
    pair.path = path
    pair.pathKey = path.map(String).join('|')
    pair.marks = []
    const m = this.materials
    path.forEach(([row, col], step) => {
      const index = row * 10 + col
      if (this.isBusy(index) || claimed.has(index)) return
      claimed.add(index)
      const cell = this.cell(row, col)
      const group = new THREE.Group()
      group.position.y = LAND_TOP
      group.scale.setScalar(PATH_SCALE)
      cell.land.add(group)
      const here = new THREE.Vector2(col, row)
      const ways = [path[step - 1], path[step + 1]].filter(Boolean).map(([r, c]) => new THREE.Vector2(c, r).sub(here))
      // A stone in the middle, and one halfway toward each neighbor on the path.
      for (const [i, way] of [new THREE.Vector2(), ...ways.map((w) => w.clone().multiplyScalar(0.26))].entries()) {
        const stone = this.garden.mesh(this.geometries.stone, i % 2 ? m.path : m.stone, group, way.x + (hash(index + i) - 0.5) * 0.03, 0.009, way.y + (hash(index * 3 + i) - 0.5) * 0.03)
        stone.rotation.y = hash(index * 7 + i) * Math.PI
        stone.castShadow = false
      }
      // A lantern beside the path, alternating sides.
      const along = ways[0] ?? new THREE.Vector2(1, 0)
      const side = new THREE.Vector2(-along.y, along.x).multiplyScalar(step % 2 ? 0.25 : -0.25)
      const lantern = new THREE.Group()
      lantern.position.set(side.x, 0, side.y)
      lantern.scale.setScalar(2.1)
      group.add(lantern)
      this.garden.mesh(this.geometries.post, m.staff, lantern, 0, 0.045, 0)
      const paper = this.garden.mesh(this.geometries.lantern, m.glows[pair.color], lantern, 0, 0.1, 0)
      paper.scale.set(0.9, 1.1, 0.9)
      for (const y of [0.068, 0.132]) this.garden.mesh(this.geometries.cap, m.dark, lantern, 0, y, 0)
      pair.marks.push({ cell, group, lantern, born: time + step * 0.12, index })
    })
  }

  clearPath(pair, time = -100) {
    for (const mark of pair.marks) {
      // Undone in play, the path's lanterns shrink away; otherwise they go at once.
      if (time > 0) this.fading = [...(this.fading ?? []), { ...mark, leaving: time }]
      else mark.group.parent?.remove(mark.group)
    }
    pair.marks = []
    pair.path = null
    pair.pathKey = ''
  }

  updatePlants() {
    const cleared = new Set()
    for (const pair of this.pairs) for (const mark of pair.marks) cleared.add(mark.index)
    for (const cell of this.garden.cells) {
      const index = cell.row * 10 + cell.col
      if (cleared.has(index)) cell.plants.visible = false
      else if (cell.plantsCleared && !this.isBusy(index)) cell.plants.visible = true
      cell.plantsCleared = cleared.has(index)
    }
    for (const shrine of this.shrines.values()) shrine.cell.plants.visible = false
  }

  animate(time, reducedMotion) {
    const dt = clamp(time - (this.lastTime ?? time), 0, 0.1)
    this.lastTime = time
    for (const shrine of this.shrines.values()) shrine.cell.plants.visible = false
    for (const pair of this.pairs) {
      for (const mark of pair.marks) mark.cell.plants.visible = false
      const age = pair.joined ? (reducedMotion ? 10 : time - pair.joined.at) : -1
      pair.ends.forEach((shrine, end) => this.animateShrine(shrine, time, age, end, reducedMotion))
      for (const mark of pair.marks) {
        const grow = reducedMotion ? 1 : pop((time - mark.born) / 0.45)
        mark.group.scale.setScalar(PATH_SCALE * Math.max(0.001, grow))
        mark.lantern.rotation.z = reducedMotion ? 0 : Math.sin(time * 1.7 + mark.index) * 0.06
      }
      this.animatePilgrim(pair, time, dt, age, reducedMotion)
    }
    this.fading = (this.fading ?? []).filter((mark) => {
      const t = (time - mark.leaving) / 0.4
      if (t >= 1) { mark.group.parent?.remove(mark.group); return false }
      mark.group.scale.setScalar(PATH_SCALE * Math.max(0.001, 1 - t))
      return true
    })
  }

  // Each shrine's lantern sways gently; when the pair is first joined, the shrine gives a happy hop.
  animateShrine(shrine, time, age, end, reducedMotion) {
    shrine.paper.rotation.z = reducedMotion ? 0 : Math.sin(time * 1.4 + end * 2 + shrine.at[0]) * 0.08
    const hop = age >= 0 && age < 0.6 ? Math.sin(age / 0.6 * Math.PI) : 0
    shrine.hall.position.y = hop * 0.05
    shrine.hall.scale.set(1 + hop * 0.07, 1 - hop * 0.03, 1 + hop * 0.07)
    const glow = age >= 0 ? 1.12 + (reducedMotion ? 0 : Math.sin(time * 2 + end) * 0.04) : 1
    shrine.paper.scale.setScalar(glow)
  }

  animatePilgrim(pair, time, dt, age, reducedMotion) {
    const pilgrim = pair.pilgrim
    if (age < 0) {
      // Undone: the pilgrim gives a little hop and vanishes in a puff.
      const leaving = pair.leaving ? time - pair.leaving.at : 10
      pilgrim.group.visible = leaving < 0.4 && pilgrim.group.visible
      if (pilgrim.group.visible) pilgrim.group.scale.setScalar(PILGRIM_SCALE * (1 - leaving / 0.4))
      pair.trip = null
      return
    }
    let trip = pair.trip
    if (reducedMotion) trip = pair.trip = { phase: 'resting', at: 0, since: -100, until: Infinity }
    // Rested long enough: set off for the other shrine along the path as it lies now.
    if (trip.phase === 'resting' && time > trip.until && pair.state?.path) {
      const to = 1 - trip.at
      const cells = trip.at === 0 ? pair.state.path : [...pair.state.path].reverse()
      const points = [pair.ends[trip.at].rest.clone(), ...cells.slice(1, -1).map(center), pair.ends[to].rest.clone()]
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
      const duration = Math.max(4, curve.getLength() / SPEED)
      trip = pair.trip = { phase: 'walking', from: trip.at, to, cells, curve, start: time, duration }
    }
    let x, z, heading, stride = 0, bow = 0
    if (trip.phase === 'walking') {
      const u = clamp((time - trip.start) / trip.duration, 0, 1)
      const along = ease(u)
      const point = trip.curve.getPointAt(along)
      const tangent = trip.curve.getTangentAt(along)
      x = point.x; z = point.z
      heading = Math.atan2(tangent.x, tangent.z)
      stride = Math.min(1, 6 * u * (1 - u) * 1.6)
      if (u >= 1) pair.trip = { phase: 'resting', at: trip.to, since: time, until: time + REST[0] + Math.random() * (REST[1] - REST[0]) }
    } else {
      // Resting before the shrine: turning to face it, and bowing now and then.
      const shrine = pair.ends[trip.at]
      x = shrine.rest.x; z = shrine.rest.z
      heading = shrine.facing
      const settled = time - trip.since
      const cycle = (settled - 1.5) % 5
      bow = !reducedMotion && settled > 1.5 && cycle < 1.2 ? Math.sin(cycle / 1.2 * Math.PI) : 0
    }
    pilgrim.heading = pilgrim.heading == null || reducedMotion ? heading : turn(pilgrim.heading, heading, 1 - Math.exp(-dt * (trip.phase === 'walking' ? 5 : 2)))
    // Stepping out of the shrine the first time the pair is joined, or after slipping back.
    const appear = trip.phase === 'resting' && trip.appearAt !== undefined ? (time < trip.appearAt ? 0 : pop((time - trip.appearAt) / 0.5)) : 1
    pilgrim.group.visible = appear > 0.01
    const step = reducedMotion ? 0 : Math.abs(Math.sin(time * 7)) * 0.012 * stride
    pilgrim.group.position.set(x, LAND_TOP + step, z)
    pilgrim.group.rotation.set(0, pilgrim.heading, 0)
    pilgrim.body.rotation.set(bow * 0.45 + stride * 0.06, 0, reducedMotion ? 0 : Math.sin(time * 7) * 0.07 * stride)
    pilgrim.staff.rotation.x = reducedMotion ? 0 : Math.sin(time * 3.5) * 0.25 * stride
    pilgrim.group.scale.setScalar(PILGRIM_SCALE * Math.max(0.001, appear))
  }

  // Sends every resting pilgrim off now, for screenshots and testing.
  depart() { for (const pair of this.pairs) if (pair.trip?.phase === 'resting') pair.trip.until = 0 }

  get shrineCount() { return this.shrines.size }
  get joinedCount() { return this.pairs.filter((pair) => pair.joined).length }
  get walkingCount() { return this.pairs.filter((pair) => pair.joined && pair.trip?.phase === 'walking').length }
  get lanternCount() { return this.pairs.reduce((sum, pair) => sum + pair.marks.length, 0) }
}
