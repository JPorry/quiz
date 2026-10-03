import * as THREE from 'three'

const SPEED = 7
const PASS = 1.3
const DURATION = 10 / SPEED + PASS + 0.4
const LEAVES = 10
const clamp = THREE.MathUtils.clamp

// When a row or column clicks into place, a gust of wind rushes out along it from the tile
// that finished it: plants and grass bow and shake as it passes, the tiles give a little
// bounce, and leaves and petals tumble along with it.
export class LineFlourish {
  constructor(garden, { random = Math.random } = {}) {
    this.garden = garden
    this.random = random
    this.active = []
    this.wind = { x: 0, z: 0, amount: 0 }
    const leaf = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2)
    const colors = [0x6fc25f, 0x9fe282, 0xff9fb2, 0xffe07a, 0x54b25c, 0xffd3df]
    this.leaves = Array.from({ length: LEAVES * 2 }, (_, i) => {
      const mesh = new THREE.Mesh(leaf, new THREE.MeshLambertMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }))
      mesh.castShadow = true
      mesh.visible = false
      garden.scene.add(mesh)
      return { mesh, gust: null }
    })
  }

  start(lines, origin, time) {
    const garden = this.garden
    for (const { axis, index } of lines) {
      const row = axis === 'row'
      const from = row ? origin.col : origin.row
      const gust = { axis, index, from, started: time }
      if (this.active.length >= 4) this.active.shift()
      this.active.push(gust)
      // A softer bounce than a placement, following the gust down the line.
      for (let step = 0; step < 10; step++) {
        const cell = garden.cells[row ? index * 10 + step : step * 10 + index]
        const offset = step - from
        if (cell.reactionAt > time && cell.reactionAt - time < 0.3) continue
        cell.reactionAt = time + 0.05 + Math.abs(offset) / SPEED
        cell.direction.set(row ? Math.sign(offset) : 0, row ? 0 : Math.sign(offset))
        cell.reactionStrength = 0.35
      }
      // Leaves and petals are swept up at the tile and carried out both ways.
      const free = this.leaves.filter((leaf) => !leaf.gust).slice(0, LEAVES)
      free.forEach((leaf, i) => {
        Object.assign(leaf, {
          gust, way: i % 2 ? 1 : -1, delay: this.random() * 0.25, lane: (this.random() - 0.5) * 0.6,
          reach: 2.5 + this.random() * 4, phase: this.random() * 10, size: 0.6 + this.random() * 0.5,
        })
      })
    }
  }

  // Where a cell sits along a gust's line, and how far it is from the line itself.
  place(gust, cell) {
    const row = gust.axis === 'row'
    return { along: row ? cell.col : cell.row, off: Math.abs((row ? cell.row : cell.col) - gust.index) }
  }

  // The gust at a cell: which way it pushes and how hard it bends a plant, in radians.
  windAt(cell, time) {
    const wind = this.wind
    wind.x = 0; wind.z = 0; wind.amount = 0
    for (const gust of this.active) {
      const { along, off } = this.place(gust, cell)
      if (off > 1) continue
      const offset = along - gust.from
      const local = (gust.hold ?? time - gust.started) - Math.abs(offset) / SPEED
      if (local < 0 || local > PASS) continue
      // It swells as the front arrives, shakes while it passes, and dies away;
      // rows either side catch a little of it.
      const swell = Math.sin(local / PASS * Math.PI) ** 2
      const shake = 0.7 + 0.3 * Math.sin(local * 17 + along * 1.7)
      const amount = 0.4 * swell * shake * (off ? 0.35 : 1)
      const way = offset === 0 ? (Math.sin(local * 11) > 0 ? 1 : -1) : Math.sign(offset)
      const row = gust.axis === 'row'
      wind.x += (row ? way : 0) * amount
      wind.z += (row ? 0 : way) * amount
    }
    wind.amount = Math.hypot(wind.x, wind.z)
    if (wind.amount) { wind.x /= wind.amount; wind.z /= wind.amount }
    return wind
  }

  update(time) {
    this.active = this.active.filter((gust) => (gust.hold ?? time - gust.started) < DURATION)
    for (const leaf of this.leaves) {
      const gust = leaf.gust
      if (!gust || !this.active.includes(gust)) { leaf.gust = null; leaf.mesh.visible = false; continue }
      const t = (gust.hold ?? time - gust.started) - leaf.delay
      // Each leaf races out with the front, slows, and settles as the gust dies.
      const travel = leaf.reach * (1 - Math.exp(-Math.max(0, t) * 1.6))
      const along = gust.from + 0.5 + leaf.way * travel
      const life = clamp(t / 0.2, 0, 1) * (1 - clamp((t - 1.4) / 0.5, 0, 1))
      const inside = along > 0.1 && along < 9.9
      leaf.mesh.visible = t > 0 && life > 0 && inside
      if (!leaf.mesh.visible) continue
      const across = gust.index + 0.5 + leaf.lane + Math.sin(t * 5 + leaf.phase) * 0.12
      const row = gust.axis === 'row'
      leaf.mesh.position.set((row ? along : across) - 5, 0.55 + Math.sin(t * 3.2 + leaf.phase) * 0.18 + Math.sin(Math.min(t, 1.6) / 1.6 * Math.PI) * 0.35, (row ? across : along) - 5)
      leaf.mesh.rotation.set(Math.sin(t * 9 + leaf.phase) * 1.3, t * 5 + leaf.phase, Math.cos(t * 7 + leaf.phase) * 0.9)
      leaf.mesh.scale.set(0.1 * leaf.size * life, 1, 0.06 * leaf.size * life)
    }
  }

  get count() { return this.active.length }
}
