import * as THREE from 'three'

export const HABITATS = Object.freeze({
  0: ['koi', 'otters', 'ducks', 'frogs'],
  1: ['songbirds', 'squirrels', 'butterflies', 'rabbits'],
})

export function habitatSeed(region, clues = []) {
  let hash = 2166136261
  for (const character of `${region.id}|${clues.flat().map((value) => value ?? '-').join('')}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0
  }
  return hash
}

export function chooseHabitat(region, clues) {
  return HABITATS[region.value][(habitatSeed(region, clues) >>> 16) % HABITATS[region.value].length]
}

// A closed cardinal walk makes swimmers follow connected water, rather than cutting across land.
export function habitatRoute(cells) {
  const allowed = new Set(cells.map(({ row, col }) => `${row}:${col}`))
  const visited = new Set()
  const route = []
  function visit(cell) {
    visited.add(`${cell.row}:${cell.col}`)
    route.push(cell)
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const next = { row: cell.row + dr, col: cell.col + dc }
      const key = `${next.row}:${next.col}`
      if (!allowed.has(key) || visited.has(key)) continue
      visit(next)
      route.push(cell)
    }
  }
  visit(cells[0])
  return route
}

// Whether a point lies inside a habitat, at least `margin` away from every shore it does not share.
export function habitatArea(cells, margin) {
  const set = new Set(cells.map(({ row, col }) => `${row}:${col}`))
  const has = (row, col) => set.has(`${row}:${col}`)
  return (x, z) => {
    const col = Math.floor(x + 5), row = Math.floor(z + 5)
    if (!has(row, col)) return false
    const fx = x + 5 - col, fz = z + 5 - row
    const west = fx < margin, east = fx > 1 - margin, north = fz < margin, south = fz > 1 - margin
    if ((west && !has(row, col - 1)) || (east && !has(row, col + 1)) || (north && !has(row - 1, col)) || (south && !has(row + 1, col))) return false
    if ((west && north && !has(row - 1, col - 1)) || (east && north && !has(row - 1, col + 1))) return false
    if ((west && south && !has(row + 1, col - 1)) || (east && south && !has(row + 1, col + 1))) return false
    return true
  }
}

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = state + 0x6d2b79f5 >>> 0
    let t = state
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const clamp = THREE.MathUtils.clamp
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))
const LAND_TOP = 0.44
const WATER_TOP = 0.06
// Models are built at life size for a tile; this makes them readable on a phone.
const SCALE = 1.7
const palette = {
  white: 0xfffaf0, cream: 0xfff0cf, ink: 0x2c2b36, pink: 0xffa3b5, blush: 0xff8fa8,
  orange: 0xf29a4a, koi: 0xff7a45, gold: 0xf6c544, yellow: 0xffdb5c, brown: 0xa8714a,
  darkBrown: 0x77503a, tan: 0xf0cfa0, green: 0x8fd16f, darkGreen: 0x4f9a4f, leaf: 0x5aae5c,
  blue: 0x7cc4ec, coral: 0xff8a6b, lilac: 0xc4a6ee, mint: 0x8fe0c4,
}
// How each kind of resident gets around its habitat.
const BEHAVIOR = {
  koi: { speed: 0.22, turn: 2.4, margin: 0.24, personal: 0.34, swims: true },
  otters: { speed: 0.09, turn: 1.2, margin: 0.27, personal: 0.42, swims: true },
  ducks: { speed: 0.15, turn: 2.2, margin: 0.24, personal: 0.3, swims: true },
  frogs: { speed: 0, turn: 0, margin: 0.28, personal: 0.4 },
  rabbits: { speed: 0.22, turn: 4, margin: 0.28, personal: 0.3, pause: [1, 3.5] },
  squirrels: { speed: 0.3, turn: 5, margin: 0.28, personal: 0.28, pause: [0.6, 2.5] },
  songbirds: { speed: 0, turn: 0, margin: 0.28, personal: 0.3 },
  butterflies: { speed: 0.26, turn: 3, margin: 0.14, personal: 0.32 },
}

export class HabitatWildlife {
  constructor(garden) {
    this.garden = garden
    this.materials = Object.fromEntries(Object.entries(palette).map(([name, color]) => [name, new THREE.MeshLambertMaterial({ color })]))
    this.materials.shine = new THREE.MeshBasicMaterial({ color: 0xffffff })
    this.wakeMaterial = new THREE.MeshBasicMaterial({ color: 0xf2fbf8, transparent: true, opacity: 0.5, depthWrite: false })
    this.sphere = new THREE.SphereGeometry(1, 16, 12)
  }

  part(parent, color, position, scale) {
    const mesh = this.garden.mesh(this.sphere.clone(), this.materials[color], parent, ...position)
    mesh.scale.set(...scale)
    return mesh
  }

  cone(parent, color, position, radius, length, direction = Math.PI / 2) {
    const mesh = this.garden.mesh(new THREE.ConeGeometry(radius, length, 8), this.materials[color], parent, ...position)
    mesh.rotation.x = direction
    return mesh
  }

  // Big glossy eyes with a catch-light, and rosy cheeks underneath.
  // Eyes sit high on the head so they read from the camera above.
  face(parent, x, y, z, eye, cheeks = true) {
    const radius = eye * 1.25
    y += eye * 1.4
    z -= eye * 0.5
    for (const side of [-1, 1]) {
      this.part(parent, 'ink', [side * x, y, z], [radius, radius * 1.1, radius * 0.8])
      this.part(parent, 'shine', [side * x - side * radius * 0.25, y + radius * 0.4, z + radius * 0.55], [radius * 0.38, radius * 0.38, radius * 0.3])
      if (cheeks) this.part(parent, 'blush', [side * (x + radius * 0.9), y - radius * 1.25, z - radius * 0.2], [radius * 0.8, radius * 0.5, radius * 0.35])
    }
  }

  model(kind, index, seed) {
    const root = new THREE.Group(), body = new THREE.Group(), parts = []
    root.add(body)
    const animated = (x, y, z, parent = root) => {
      const group = new THREE.Group()
      group.position.set(x, y, z)
      parent.add(group)
      parts.push(group)
      return group
    }
    const ball = (parent, color, position, scale) => this.part(parent, color, position, scale)
    let tail, pad, head, throat
    const wings = [], paws = [], ears = []
    const accent = ['blue', 'coral', 'yellow', 'lilac'][(seed + index) % 4]
    if (kind === 'koi') {
      const skin = index % 3 === 1 ? 'gold' : 'white'
      ball(body, skin, [0, 0, 0], [0.038, 0.024, 0.085])
      ball(body, 'koi', [0.008, 0.011, 0.028], [0.026, 0.016, 0.03])
      ball(body, 'koi', [-0.01, 0.01, -0.032], [0.022, 0.015, 0.026])
      ball(body, skin, [0, 0.022, -0.005], [0.005, 0.012, 0.035])
      for (const side of [-1, 1]) ball(body, 'koi', [side * 0.036, -0.004, 0.022], [0.02, 0.004, 0.024]).rotation.y = side * 0.5
      this.face(body, 0.022, 0.012, 0.06, 0.007)
      tail = animated(0, 0, -0.078)
      ball(tail, 'koi', [0, 0, -0.03], [0.036, 0.005, 0.034])
    } else if (kind === 'otters') {
      // Floating on its back, holding a little shell.
      ball(body, 'brown', [0, 0.02, 0], [0.042, 0.028, 0.088])
      ball(body, 'tan', [0, 0.038, 0.005], [0.031, 0.014, 0.07])
      for (const side of [-1, 1]) ball(body, 'darkBrown', [side * 0.02, 0.03, -0.085], [0.012, 0.008, 0.016])
      head = animated(0, 0.04, 0.085)
      head.rotation.x = -0.9
      ball(head, 'brown', [0, 0, 0], [0.04, 0.035, 0.038])
      ball(head, 'tan', [0, -0.008, 0.03], [0.022, 0.016, 0.013])
      ball(head, 'ink', [0, 0.004, 0.043], [0.007, 0.005, 0.005])
      for (const side of [-1, 1]) ball(head, 'darkBrown', [side * 0.03, 0.022, -0.006], [0.01, 0.01, 0.007])
      this.face(head, 0.017, 0.012, 0.03, 0.007)
      for (const side of [-1, 1]) {
        const paw = animated(side * 0.016, 0.05, 0.035)
        ball(paw, 'darkBrown', [0, 0, 0], [0.011, 0.009, 0.013])
        paws.push(paw)
      }
      ball(body, 'pink', [0, 0.058, 0.04], [0.015, 0.007, 0.013])
      tail = animated(0, 0.016, -0.095)
      ball(tail, 'darkBrown', [0, 0, -0.03], [0.014, 0.009, 0.036])
    } else if (kind === 'ducks') {
      const duckling = index > 0
      const coat = duckling ? 'yellow' : 'white'
      ball(body, coat, [0, 0.042, -0.01], [0.048, 0.04, 0.06])
      ball(body, coat, [0, 0.066, -0.064], [0.018, 0.014, 0.02]).rotation.x = 0.6
      for (const side of [-1, 1]) {
        const wing = animated(side * 0.043, 0.048, -0.012)
        ball(wing, duckling ? 'gold' : 'cream', [0, 0, 0], [0.011, 0.026, 0.036])
        wings.push(wing)
      }
      head = animated(0, 0.1, 0.034)
      ball(head, coat, [0, 0, 0], [0.039, 0.037, 0.038])
      ball(head, 'orange', [0, -0.009, 0.04], [0.021, 0.008, 0.02])
      this.face(head, 0.019, 0.008, 0.03, 0.008)
    } else if (kind === 'frogs') {
      pad = animated(0, 0, 0)
      this.garden.mesh(new THREE.CircleGeometry(0.12, 24, 0.2, Math.PI * 1.85), this.materials.leaf, pad, 0, 0.004, 0).rotation.x = -Math.PI / 2
      ball(body, 'green', [0, 0.034, 0], [0.044, 0.031, 0.04])
      ball(body, 'cream', [0, 0.03, 0.022], [0.029, 0.021, 0.018])
      for (const side of [-1, 1]) {
        ball(body, 'green', [side * 0.022, 0.066, 0.01], [0.016, 0.015, 0.015])
        ball(body, 'green', [side * 0.04, 0.016, -0.014], [0.018, 0.012, 0.024])
        ball(body, 'green', [side * 0.024, 0.006, 0.036], [0.011, 0.005, 0.012])
      }
      this.face(body, 0.022, 0.07, 0.021, 0.0085)
      throat = animated(0, 0.024, 0.036)
      ball(throat, 'cream', [0, 0, 0], [0.017, 0.012, 0.01])
    } else if (kind === 'rabbits' || kind === 'squirrels') {
      const rabbit = kind === 'rabbits'
      const coat = rabbit ? (index % 2 ? 'cream' : 'white') : 'orange'
      ball(body, coat, [0, 0.05, -0.01], [0.044, 0.044, 0.052])
      ball(body, rabbit ? 'white' : 'cream', [0, 0.047, 0.026], [0.028, 0.032, 0.02])
      for (const side of [-1, 1]) ball(body, coat, [side * 0.024, 0.01, 0.028], [0.016, 0.01, 0.022])
      head = animated(0, 0.104, 0.03)
      ball(head, coat, [0, 0, 0], [0.042, 0.039, 0.04])
      ball(head, rabbit ? 'white' : 'cream', [0, -0.012, 0.028], [0.02, 0.014, 0.014])
      ball(head, rabbit ? 'pink' : 'ink', [0, -0.004, 0.04], [0.006, 0.005, 0.005])
      this.face(head, 0.019, 0.008, 0.031, 0.0085)
      for (const side of [-1, 1]) {
        const ear = animated(side * 0.019, 0.03, -0.006, head)
        ear.rotation.z = side * -0.22
        if (rabbit) {
          ball(ear, coat, [0, 0.036, 0], [0.012, 0.038, 0.009])
          ball(ear, 'pink', [0, 0.036, 0.005], [0.006, 0.027, 0.005])
        } else {
          this.cone(ear, coat, [0, 0.012, 0], 0.011, 0.026, 0)
        }
        ears.push(ear)
      }
      tail = animated(0, 0.055, -0.06)
      if (rabbit) ball(tail, 'white', [0, 0, -0.004], [0.018, 0.018, 0.018])
      else {
        ball(tail, 'orange', [0, 0.04, -0.025], [0.026, 0.05, 0.026]).rotation.x = -0.35
        ball(tail, 'orange', [0, 0.09, -0.006], [0.025, 0.03, 0.025])
        ball(tail, 'cream', [0, 0.112, 0.008], [0.017, 0.016, 0.017])
        ball(body, 'brown', [0, 0.07, 0.05], [0.012, 0.013, 0.012])
        ball(body, 'darkBrown', [0, 0.081, 0.05], [0.013, 0.006, 0.013])
      }
    } else if (kind === 'songbirds') {
      ball(body, accent, [0, 0.045, 0], [0.042, 0.04, 0.046])
      ball(body, 'cream', [0, 0.04, 0.021], [0.03, 0.028, 0.027])
      for (const side of [-1, 1]) ball(body, 'ink', [side * 0.014, 0.004, 0.006], [0.006, 0.004, 0.011])
      head = animated(0, 0.09, 0.016)
      ball(head, accent, [0, 0, 0], [0.034, 0.032, 0.033])
      this.cone(head, 'gold', [0, -0.004, 0.039], 0.009, 0.02)
      this.face(head, 0.016, 0.006, 0.026, 0.0075)
      for (const side of [-1, 1]) {
        const wing = animated(side * 0.04, 0.05, -0.004)
        ball(wing, accent, [side * 0.004, 0, -0.006], [0.011, 0.026, 0.034])
        wings.push(wing)
      }
      tail = animated(0, 0.05, -0.042)
      ball(tail, accent, [0, 0.006, -0.018], [0.02, 0.006, 0.028]).rotation.x = -0.5
    } else if (kind === 'butterflies') {
      ball(body, 'ink', [0, 0, 0], [0.01, 0.01, 0.04])
      ball(body, 'ink', [0, 0.002, 0.044], [0.011, 0.011, 0.011])
      for (const side of [-1, 1]) {
        const antenna = this.garden.mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.04, 4), this.materials.ink, body, side * 0.008, 0.016, 0.06)
        antenna.rotation.set(0.7, 0, -side * 0.35)
        ball(body, 'ink', [side * 0.016, 0.03, 0.074], [0.005, 0.005, 0.005])
        const wing = animated(side * 0.008, 0, 0)
        ball(wing, accent, [side * 0.05, 0, 0.018], [0.055, 0.005, 0.048])
        ball(wing, 'cream', [side * 0.058, 0.004, 0.024], [0.018, 0.003, 0.015])
        ball(wing, accent, [side * 0.036, 0, -0.03], [0.034, 0.005, 0.03])
        wings.push(wing)
      }
    }
    this.garden.mergeDetails(body)
    parts.forEach((part) => this.garden.mergeDetails(part))
    return { root, body, tail, wings, head, paws, ears, pad, throat }
  }

  create(region, parent, started) {
    const seed = habitatSeed(region, this.garden.clues)
    const group = new THREE.Group()
    parent.add(group)
    if (region.cells.length === 1) return { kind: null, seed, group, actors: [], started, cells: region.cells }
    const kind = chooseHabitat(region, this.garden.clues)
    const behavior = BEHAVIOR[kind]
    const swimmers = !!behavior.swims
    const count = kind === 'butterflies' || kind === 'koi' || kind === 'ducks' ? 3 : 2
    const habitat = { kind, seed, group, actors: [], started, cells: region.cells, behavior, random: random(seed), inside: habitatArea(region.cells, behavior.margin) }
    habitat.spots = kind === 'songbirds' ? this.perches(region.cells) : null
    for (let index = 0; index < count; index++) {
      const cell = region.cells[Math.floor(index * region.cells.length / count) % region.cells.length]
      const model = this.model(kind, index, seed)
      group.add(model.root)
      const size = (kind === 'ducks' && index ? 0.72 : 1) * SCALE
      const phase = index / count * Math.PI * 2 + seed % 17
      let wake
      if (swimmers) {
        wake = this.garden.mesh(new THREE.TorusGeometry(0.1, 0.005, 4, 24, Math.PI * 1.3), this.wakeMaterial, group)
        wake.rotation.x = -Math.PI / 2
        wake.castShadow = false
        wake.receiveShadow = false
      }
      const x = cell.col - 4.5 + Math.cos(phase) * 0.12, z = cell.row - 4.5 + Math.sin(phase) * 0.12
      const actor = { ...model, cell, index, phase, size, wake, swimmers, x, z, heading: phase, speed: 0, pause: 0, target: null, gait: 0, lift: 0 }
      if (habitat.spots) {
        actor.spot = habitat.spots[index % habitat.spots.length]
        actor.spot.taken = true
        actor.x = actor.spot.x; actor.z = actor.spot.z
        actor.rest = 4 + habitat.random() * 8
      }
      habitat.actors.push(actor)
    }
    return habitat
  }

  // Treetops make the best perches; open meadow will do for the rest.
  perches(cells) {
    return cells.flatMap((cell, index) => {
      const plants = this.garden.cells[cell.row * 10 + cell.col]?.plants
      const tree = (plants?.userData.perchHeight ?? 0) > 0.8
      const angle = index * 2.3
      return [{ x: cell.col - 4.5 + (tree ? 0 : Math.cos(angle) * 0.2), z: cell.row - 4.5 + (tree ? 0 : Math.sin(angle) * 0.2), height: tree ? plants.userData.perchHeight - LAND_TOP : 0, cell, taken: false }]
    })
  }

  pickTarget(habitat, actor) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const cell = habitat.cells[Math.floor(habitat.random() * habitat.cells.length)]
      const x = cell.col - 4.5 + (habitat.random() - 0.5) * 0.9, z = cell.row - 4.5 + (habitat.random() - 0.5) * 0.9
      if (!habitat.inside(x, z) || this.nearTree(x, z, 0.3)) continue
      actor.target = { x, z, y: 0.25 + habitat.random() * 0.35 }
      return
    }
    actor.target = { x: actor.x, z: actor.z, y: 0.4 }
  }

  // Walkers step around tree trunks rather than through them.
  nearTree(x, z, radius) {
    const cell = this.garden.cells?.[Math.floor(z + 5) * 10 + Math.floor(x + 5)]
    if (!cell || (cell.plants?.userData.perchHeight ?? 0) < 0.8) return false
    return Math.hypot(x - (Math.floor(x + 5) - 4.5), z - (Math.floor(z + 5) - 4.5)) < radius
  }

  step(habitat, dt) {
    const { behavior, actors, kind } = habitat
    if (kind === 'frogs') return
    if (kind === 'songbirds') {
      for (const actor of actors) {
        if (actor.flight) {
          actor.flight.t += dt / actor.flight.duration
          if (actor.flight.t >= 1) {
            actor.spot = actor.flight.to
            actor.flight = null
            actor.rest = 5 + habitat.random() * 9
          }
        } else if ((actor.rest -= dt) <= 0) {
          const over = habitatArea(habitat.cells, 0)
          const free = habitat.spots.filter((spot) => !spot.taken && Array.from({ length: 12 }, (_, i) => (i + 0.5) / 12)
            .every((t) => over(THREE.MathUtils.lerp(actor.spot.x, spot.x, t), THREE.MathUtils.lerp(actor.spot.z, spot.z, t))))
          if (!free.length) { actor.rest = 3; continue }
          const to = free[Math.floor(habitat.random() * free.length)]
          actor.spot.taken = false
          to.taken = true
          actor.flight = { from: actor.spot, to, t: 0, duration: 1.2 + Math.hypot(to.x - actor.spot.x, to.z - actor.spot.z) * 0.5 }
        }
      }
      return
    }
    for (const actor of actors) {
      const leader = kind === 'ducks' && actor.index > 0 ? actors[actor.index - 1] : null
      if (leader) {
        actor.target = { x: leader.x - Math.sin(leader.heading) * 0.3, z: leader.z - Math.cos(leader.heading) * 0.3 }
      } else if (!actor.target || Math.hypot(actor.target.x - actor.x, actor.target.z - actor.z) < 0.06) {
        if (behavior.pause && actor.target) actor.pause = behavior.pause[0] + habitat.random() * (behavior.pause[1] - behavior.pause[0])
        this.pickTarget(habitat, actor)
      }
      if (actor.pause > 0) {
        // Resting walkers sniff about, slowly turning on the spot.
        actor.pause -= dt
        actor.speed = 0
        actor.heading = wrapAngle(actor.heading + dt * 0.5 * (actor.index % 2 ? 1 : -1))
        continue
      }
      // Seek the target, but keep a little personal space from everyone else.
      let dx = actor.target.x - actor.x, dz = actor.target.z - actor.z
      const distance = Math.hypot(dx, dz) || 1
      dx /= distance; dz /= distance
      for (const other of actors) {
        if (other === actor) continue
        const ox = actor.x - other.x, oz = actor.z - other.z
        const gap = Math.hypot(ox, oz)
        if (gap > 0 && gap < behavior.personal) {
          const push = (behavior.personal - gap) / behavior.personal * 2.5
          dx += ox / gap * push; dz += oz / gap * push
        }
      }
      const desired = Math.atan2(dx, dz)
      const turn = clamp(wrapAngle(desired - actor.heading), -behavior.turn * dt, behavior.turn * dt)
      actor.heading = wrapAngle(actor.heading + turn)
      const slow = leader ? clamp((distance - 0.04) / 0.12, 0, 1.4) : clamp(distance / 0.15, 0.35, 1)
      actor.speed = behavior.speed * slow * Math.max(0.15, Math.cos(wrapAngle(desired - actor.heading)))
      const nx = actor.x + Math.sin(actor.heading) * actor.speed * dt, nz = actor.z + Math.cos(actor.heading) * actor.speed * dt
      const clear = (x, z) => habitat.inside(x, z) && (actor.swimmers || kind === 'butterflies' || !this.nearTree(x, z, 0.26))
      if (clear(nx, nz)) { actor.x = nx; actor.z = nz }
      else if (clear(nx, actor.z)) actor.x = nx
      else if (clear(actor.x, nz)) actor.z = nz
      else if (!leader) this.pickTarget(habitat, actor)
      actor.gait += actor.speed * dt
    }
  }

  animate(habitat, time) {
    const owner = this.garden
    const quiet = owner.reducedMotion
    const clock = quiet ? 0 : time
    const age = quiet ? 10 : time - habitat.started
    const dt = habitat.lastTime === undefined ? 0 : clamp(time - habitat.lastTime, 0, 0.5)
    habitat.lastTime = time
    if (!quiet && dt > 0 && habitat.kind) {
      const steps = Math.ceil(dt / 0.05)
      for (let i = 0; i < steps; i++) this.step(habitat, dt / steps)
    }
    for (const actor of habitat.actors) {
      const { root, phase, index } = actor
      const entrance = clamp((age - index * 0.28) / 2.3, 0, 1)
      const growth = 1 - (1 - entrance) ** 3
      root.scale.setScalar(Math.max(0.001, growth * actor.size))
      const ground = owner.cells[(Math.floor(actor.z + 5)) * 10 + Math.floor(actor.x + 5)]?.land.position.y ?? 0
      let x = actor.x, z = actor.z, y, heading = actor.heading
      if (actor.swimmers) {
        y = WATER_TOP + (habitat.kind === 'koi' ? 0.012 : -0.004) + (quiet ? 0 : Math.sin(clock * 1.7 + phase) * 0.006)
        // Residents surface before settling into their swim.
        y -= (1 - growth) * 0.12
        root.rotation.z = habitat.kind === 'otters' ? Math.sin(clock * 0.9 + phase) * 0.12 : 0
      } else if (habitat.kind === 'songbirds') {
        const flight = actor.flight
        if (flight) {
          const t = flight.t, ease = t * t * (3 - 2 * t)
          x = THREE.MathUtils.lerp(flight.from.x, flight.to.x, ease)
          z = THREE.MathUtils.lerp(flight.from.z, flight.to.z, ease)
          y = LAND_TOP + THREE.MathUtils.lerp(flight.from.height, flight.to.height, ease) + Math.sin(t * Math.PI) * 0.45
          heading = Math.atan2(flight.to.x - flight.from.x, flight.to.z - flight.from.z)
        } else {
          x = actor.spot.x; z = actor.spot.z
          y = LAND_TOP + actor.spot.height + ground
          heading = phase + Math.sin(clock * 0.5 + phase) * 0.5
        }
        y += (1 - growth) * 1.0
        actor.x = x; actor.z = z
      } else if (habitat.kind === 'butterflies') {
        y = LAND_TOP + 0.3 + Math.sin(clock * 1.6 + phase) * 0.12 + Math.sin(clock * 3.1 + phase) * 0.03 + (1 - growth) * 0.6
      } else if (habitat.kind === 'frogs') {
        const hop = quiet ? 0 : Math.max(0, Math.sin(clock * 0.8 + phase) - 0.9) / 0.1
        y = WATER_TOP + 0.004 + hop * 0.1
        actor.pad.position.y = -hop * 0.1
        heading = phase + Math.sin(clock * 0.3 + phase) * 0.3
        if (actor.throat) actor.throat.scale.setScalar(quiet ? 1 : 1 + Math.max(0, Math.sin(clock * 2.2 + phase * 3)) ** 8 * 0.9)
      } else {
        const moving = actor.speed > 0.01
        const hopHeight = habitat.kind === 'rabbits' ? 0.05 : 0.018
        y = LAND_TOP + ground + (moving && !quiet ? Math.abs(Math.sin(actor.gait * (habitat.kind === 'rabbits' ? 22 : 40))) * hopHeight : 0) + Math.sin(entrance * Math.PI) * 0.15
      }
      root.position.set(x, y, z)
      root.rotation.y = heading
      if (actor.tail) actor.tail.rotation.y = quiet ? 0 : Math.sin(clock * (actor.swimmers ? 6 : 2.4) + phase) * (habitat.kind === 'squirrels' ? 0.12 : 0.3)
      if (actor.head) actor.head.rotation.y = quiet ? 0 : Math.sin(clock * 1.1 + phase) * 0.35 * (actor.speed > 0.01 ? 0.3 : 1)
      actor.ears.forEach((ear, i) => { ear.rotation.x = quiet ? 0 : Math.max(0, Math.sin(clock * 3 + phase + i * 0.7) - 0.85) * 2.5 })
      actor.paws.forEach((paw, i) => { paw.rotation.z = quiet ? 0 : Math.sin(clock * 1.5 + phase + i) * 0.35 })
      actor.wings.forEach((wing, i) => {
        const flying = habitat.kind === 'songbirds' && (actor.flight || entrance < 1)
        const flap = habitat.kind === 'butterflies' ? Math.sin(clock * 14 + phase) * 0.9
          : flying ? Math.sin(clock * 22) * 1.1
            : habitat.kind === 'ducks' && Math.sin(clock * 0.7 + phase) > 0.95 ? Math.sin(clock * 12) * 0.5 : 0
        wing.rotation.z = quiet ? 0.25 * (i ? 1 : -1) : flap * (i ? 1 : -1)
      })
      if (actor.wake) {
        const moving = clamp(actor.speed / 0.1, 0.3, 1)
        actor.wake.position.set(x - Math.sin(heading) * 0.06, WATER_TOP + 0.012, z - Math.cos(heading) * 0.06)
        actor.wake.rotation.z = -heading - Math.PI * 0.15
        actor.wake.scale.setScalar(growth * actor.size * moving * (1 + Math.sin(clock * 2 + phase) * 0.1))
      }
    }
  }
}
