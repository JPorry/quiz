import * as THREE from 'three'

const COLORS = { wood: 0xc58a57, woodDark: 0x8a5a3c, sand: 0xf4dfae, sea: 0x3fb6c6, foam: 0xf7fcf9 }

// Footbridges and shorelines sit on the edge between two tiles. Both are built along +x, so a
// hint between east-west neighbors needs no turn and one between north-south neighbors turns.
export class EdgeHints {
  constructor(garden) {
    this.garden = garden
    this.group = new THREE.Group()
    garden.scene.add(this.group)
    this.items = []
    this.materials = Object.fromEntries(Object.entries(COLORS).map(([name, color]) => [name, new THREE.MeshLambertMaterial({ color })]))
  }

  piece(geometry, material, parent, x, y, z) {
    const mesh = this.garden.mesh(geometry, this.materials[material], parent, x, y, z)
    return mesh
  }

  // A little arched footbridge of planks between two rails, spanning the shared edge.
  bridge() {
    const group = new THREE.Group()
    for (let i = 0; i < 7; i++) {
      const t = i / 6 - 0.5
      const plank = this.piece(new THREE.BoxGeometry(0.052, 0.022, 0.2), 'wood', group, t * 0.42, 0.03 + Math.cos(t * Math.PI) * 0.035, 0)
      plank.rotation.z = -Math.sin(t * Math.PI) * 0.28
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const t = i / 3 - 0.5
        this.piece(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 6), 'woodDark', group, t * 0.4, 0.075 + Math.cos(t * Math.PI) * 0.035, side * 0.1)
      }
      const rail = this.piece(new THREE.CylinderGeometry(0.01, 0.01, 0.44, 6), 'woodDark', group, 0, 0.115 + 0.022, side * 0.1)
      rail.rotation.z = Math.PI / 2
    }
    this.garden.mergeDetails(group)
    return group
  }

  // A round token, half sand and half sea with a line of foam: one side land, the other water.
  shore() {
    const group = new THREE.Group()
    const half = (material, start) => {
      const mesh = this.piece(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 24, 1, false, start, Math.PI), material, group, 0, 0.015, 0)
      return mesh
    }
    half('sand', Math.PI)
    half('sea', 0)
    this.piece(new THREE.BoxGeometry(0.025, 0.034, 0.25), 'foam', group, 0, 0.017, 0)
    const rim = this.piece(new THREE.TorusGeometry(0.13, 0.014, 6, 28), 'foam', group, 0, 0.03, 0)
    rim.rotation.x = Math.PI / 2
    this.piece(new THREE.SphereGeometry(0.014, 6, 4), 'foam', group, -0.07, 0.033, 0.04)
    this.garden.mergeDetails(group)
    return group
  }

  clear() {
    for (const item of this.items) {
      this.group.remove(item.root)
      item.root.traverse((child) => child.geometry?.dispose())
    }
    this.items = []
  }

  set(hints = []) {
    this.clear()
    for (const hint of hints) {
      const [[r1, c1], [r2, c2]] = hint.cells
      const root = hint.kind === 'bridge' ? this.bridge() : this.shore()
      root.position.set((c1 + c2) / 2 - 4.5, 0, (r1 + r2) / 2 - 4.5)
      if (c1 === c2) root.rotation.y = Math.PI / 2
      // Large enough to read on a phone, and lifted clear of the sockets' raised rims.
      root.scale.setScalar(hint.kind === 'bridge' ? 1.35 : 1.3)
      root.traverse((child) => { if (child.isMesh) child.castShadow = hint.kind === 'bridge' })
      this.group.add(root)
      const cells = hint.cells.map(([r, c]) => this.garden.cells[r * 10 + c])
      this.items.push({ hint, root, cells })
    }
  }

  // Each hint rides at the height of the taller of its two tiles, so it sits on grown land.
  animate() {
    for (const item of this.items) {
      // Growing land lifts its hints with it.
      const top = Math.max(...item.cells.map((cell) => (cell.value === 1 ? 0.44 * cell.land.scale.y + cell.land.position.y + 0.02 : this.garden.cellHeight(cell))))
      item.root.position.y = top + 0.05
    }
  }

  get count() { return this.items.length }
}
