import * as THREE from 'three'

// The garden's starting tiles are its old foundations: land rises on mossy stone instead of
// sand and carries a small weathered landmark, and water keeps a cluster of mossy rocks.
// Grey stone appears nowhere else, so it always means "this was here first".
export const STONE = { stone: 0x9aa6ad, stoneLight: 0xb9c3c6, stoneDark: 0x7b8a92, moss: 0x7fa868, mossDark: 0x5f8f55, glow: 0xffe2a6 }

const LAND_KINDS = [['standing', 0.35], ['cairn', 0.3], ['lantern', 0.25], ['arch', 0.1]]

// Which landmark a starting land tile carries, from a seed in [0, 1).
export function chooseLandmark(seed) {
  let total = 0
  for (const [kind, weight] of LAND_KINDS) {
    total += weight
    if (seed < total) return kind
  }
  return LAND_KINDS[0][0]
}

// A corner of the tile, clear of the planting in the middle.
export function landmarkCorner(seed, reach = 0.27) {
  const corner = Math.floor(seed * 4) % 4
  return { x: corner % 2 ? reach : -reach, z: corner < 2 ? -reach : reach }
}

export class Landmarks {
  constructor(garden) {
    this.garden = garden
    this.materials = Object.fromEntries(Object.entries(STONE).map(([name, color]) => [name, name === 'glow' ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color })]))
  }

  piece(geometry, material, parent, x, y, z, scale = [1, 1, 1], turn = 0) {
    const mesh = this.garden.mesh(geometry, this.materials[material], parent, x, y, z)
    mesh.scale.set(...scale)
    mesh.rotation.y = turn
    return mesh
  }

  rock(parent, x, y, z, radius, squash, turn) {
    return this.piece(new THREE.DodecahedronGeometry(radius, 0), 'stone', parent, x, y, z, [1, squash, 0.85], turn)
  }

  // A tiny stone lantern: a footing, a post, a glowing light box, a pointed roof and a finial.
  lantern(parent, scale = 1) {
    const s = scale
    this.piece(new THREE.CylinderGeometry(0.05 * s, 0.056 * s, 0.03 * s, 8), 'stoneDark', parent, 0, 0.015 * s, 0)
    this.piece(new THREE.CylinderGeometry(0.02 * s, 0.024 * s, 0.08 * s, 8), 'stone', parent, 0, 0.07 * s, 0)
    this.piece(new THREE.BoxGeometry(0.075 * s, 0.014 * s, 0.075 * s), 'stoneLight', parent, 0, 0.116 * s, 0)
    this.piece(new THREE.BoxGeometry(0.046 * s, 0.046 * s, 0.046 * s), 'glow', parent, 0, 0.146 * s, 0)
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.piece(new THREE.BoxGeometry(0.012 * s, 0.046 * s, 0.012 * s), 'stone', parent, cx * 0.026 * s, 0.146 * s, cz * 0.026 * s)
    this.piece(new THREE.ConeGeometry(0.075 * s, 0.05 * s, 4), 'stoneLight', parent, 0, 0.194 * s, 0, [1, 1, 1], Math.PI / 4)
    this.piece(new THREE.SphereGeometry(0.012 * s, 8, 6), 'stoneDark', parent, 0, 0.226 * s, 0)
  }

  // A small landmark in one corner of a starting land tile.
  land(cell, seed, salt) {
    const group = new THREE.Group()
    const { x, z } = landmarkCorner(salt, 0.24)
    group.position.set(x, 0, z)
    group.rotation.y = seed * Math.PI * 2
    // Large enough to read from above at a glance, even on a phone.
    group.scale.setScalar(1.9)
    const kind = chooseLandmark(seed)
    if (kind === 'standing') {
      // A weathered standing stone with a mossy shoulder and a pebble at its foot.
      const stone = this.rock(group, 0, 0.1, 0, 0.06, 2.1, 0.4)
      stone.rotation.z = 0.12
      this.piece(new THREE.SphereGeometry(0.04, 10, 6), 'moss', group, 0.012, 0.175, 0, [1, 0.45, 0.9])
      this.rock(group, 0.07, 0.015, 0.03, 0.028, 0.6, 1.2)
    } else if (kind === 'cairn') {
      // Flat stones stacked smaller and smaller.
      ;[[0.075, 0.016], [0.06, 0.05], [0.047, 0.08], [0.034, 0.104]].forEach(([radius, y], i) => {
        this.rock(group, (i % 2 ? 0.006 : -0.004), y, (i % 2 ? -0.004 : 0.005), radius, 0.42, i * 1.3)
      })
      this.piece(new THREE.SphereGeometry(0.028, 10, 6), 'moss', group, -0.03, 0.03, 0.035, [1.3, 0.45, 1])
    } else if (kind === 'lantern') {
      this.lantern(group)
    } else {
      // A little stone arch, the kind that stands at the entrance to an old garden.
      for (const side of [-1, 1]) this.piece(new THREE.BoxGeometry(0.026, 0.16, 0.026), 'stone', group, side * 0.065, 0.08, 0)
      this.piece(new THREE.BoxGeometry(0.19, 0.026, 0.04), 'stoneLight', group, 0, 0.172, 0)
      this.piece(new THREE.BoxGeometry(0.15, 0.016, 0.02), 'stone', group, 0, 0.135, 0)
      this.piece(new THREE.SphereGeometry(0.03, 10, 6), 'moss', group, 0.06, 0.186, 0, [1.4, 0.4, 0.9])
    }
    group.position.y = 0.44
    this.garden.mergeDetails(group)
    cell.land.add(group)
    return group
  }

  // A cluster of mossy rocks breaking the surface in one corner of a starting water tile,
  // now and then with a little lantern standing on the largest.
  water(cell, seed, salt) {
    const group = new THREE.Group()
    const { x, z } = landmarkCorner(salt, 0.22)
    group.position.set(x, 0.06, z)
    group.rotation.y = seed * Math.PI * 2
    group.scale.setScalar(1.6)
    // The largest rock is pale, so it stands out against the water.
    this.piece(new THREE.DodecahedronGeometry(0.085, 0), 'stoneLight', group, 0, 0.01, 0, [1, 0.6, 0.85], 0.3)
    this.piece(new THREE.SphereGeometry(0.06, 12, 6), 'moss', group, -0.01, 0.05, 0.005, [1, 0.32, 0.85])
    this.rock(group, 0.1, 0, 0.05, 0.05, 0.55, 1.1)
    if (seed > 0.4) this.rock(group, -0.05, -0.005, 0.1, 0.038, 0.5, 2.2)
    if (seed > 0.72) {
      const lantern = new THREE.Group()
      lantern.position.set(-0.005, 0.045, 0)
      this.lantern(lantern, 0.8)
      group.add(lantern)
      this.garden.mergeDetails(lantern)
    }
    this.garden.mergeDetails(group)
    cell.group.add(group)
    return group
  }

  remove(marker) {
    marker.parent?.remove(marker)
    marker.traverse((child) => child.geometry?.dispose())
  }
}
