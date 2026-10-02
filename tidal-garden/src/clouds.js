import * as THREE from 'three'

const PUFFS = 6
const clamp = THREE.MathUtils.clamp
const seeded = (index) => THREE.MathUtils.euclideanModulo(Math.sin(index * 91.7 + 47.3) * 43758.5453, 1)
const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2

// Undecided tiles are little clouds of morning mist resting on the water. Each cell keeps
// its own rounded cloud so the grid stays readable; placing terrain blows it apart.
export class CloudBank {
  constructor(garden) {
    this.garden = garden
    this.cells = Array.from({ length: 100 }, (_, index) => ({
      row: Math.floor(index / 10), col: index % 10, present: false, changed: -10,
      puffs: Array.from({ length: PUFFS }, (_, puff) => {
        const seed = index * PUFFS + puff
        if (puff === 0) return { x: 0, y: 0.2, z: 0, radius: 0.25, seed, flat: 0.78 }
        if (puff === PUFFS - 1) return { x: (seeded(seed) - 0.5) * 0.12, y: 0.33, z: (seeded(seed + 9) - 0.5) * 0.1, radius: 0.15, seed, flat: 0.9 }
        const angle = (puff - 1) / (PUFFS - 2) * Math.PI * 2 + seeded(index) * 1.5
        const distance = 0.15 + seeded(seed + 3) * 0.05
        return { x: Math.cos(angle) * distance, y: 0.14 + seeded(seed + 5) * 0.05, z: Math.sin(angle) * distance, radius: 0.15 + seeded(seed + 7) * 0.04, seed, flat: 0.75 }
      }),
    }))
    this.material = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xe4f2ff, emissiveIntensity: 0.2 })
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), this.material, 100 * PUFFS)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.frustumCulled = false
    // Lower puffs pick up a cool blue from the water; crowns stay bright white.
    const top = new THREE.Color(0xffffff), under = new THREE.Color(0xd9ecf7)
    this.cells.forEach((cell, index) => cell.puffs.forEach((puff, i) => this.mesh.setColorAt(index * PUFFS + i, puff.y > 0.25 ? top : under)))
    this.dummy = new THREE.Object3D()
    garden.scene.add(this.mesh)
  }

  update(grid, time, animate) {
    for (const cell of this.cells) {
      const present = grid[cell.row][cell.col] === null
      if (present === cell.present) continue
      cell.present = present
      cell.changed = animate ? time : -10
    }
  }

  animate(time, reducedMotion) {
    const clock = reducedMotion ? 0 : time
    this.cells.forEach((cell, index) => {
      const age = reducedMotion ? 10 : time - cell.changed
      const cx = cell.col - 4.5, cz = cell.row - 4.5
      cell.puffs.forEach((puff, i) => {
        let x = cx + puff.x, y = puff.y, z = cz + puff.z, scale = puff.radius
        if (cell.present) {
          // Rolls in with a soft overshoot, then bobs and breathes.
          const t = clamp((age - i * 0.04) / 0.55, 0, 1)
          scale *= Math.max(0, easeOutBack(t))
          scale *= 1 + Math.sin(clock * 1.1 + puff.seed) * 0.05
          y += Math.sin(clock * 0.8 + cell.row * 0.6 + cell.col * 0.9) * 0.018 + Math.sin(clock * 1.7 + puff.seed) * 0.006
          x += Math.sin(clock * 0.35 + puff.seed) * 0.012
        } else {
          // Blown apart: puffs burst outward, swell, and thin away to nothing.
          const t = clamp(age / 0.8, 0, 1)
          if (t >= 1) scale = 0
          else {
            const out = 1 - (1 - t) ** 2
            const spread = Math.hypot(puff.x, puff.z) > 0.01 ? 1 : 0
            x += puff.x * out * 2.8 * spread
            z += puff.z * out * 2.8 * spread
            y += out * (0.25 + puff.y * 0.6)
            scale *= (1 + out * 0.9) * (1 - t) ** 1.1
          }
        }
        this.dummy.position.set(x, y, z)
        this.dummy.scale.set(scale, scale * puff.flat, scale)
        this.dummy.updateMatrix()
        this.mesh.setMatrixAt(index * PUFFS + i, this.dummy.matrix)
      })
    })
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
