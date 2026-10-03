import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { villages } from './census.js'

const LAND_TOP = 0.44
const SMOKE = 240
const PUFFS = 4
// Signs are big on purpose: the number should read at a glance, even on a phone.
const SIGN_SCALE = 1.7
// Straw in a few sun-bleached tones, so neighboring huts are thatched a little differently.
const ROOFS = [0xe2c070, 0xd8b45e, 0xe9cd88, 0xd2ab57]
const clamp = THREE.MathUtils.clamp
const hash = (n) => THREE.MathUtils.euclideanModulo(Math.sin(n * 91.7 + 13.1) * 43758.5453, 1)
// Springs past full size and settles, like a hut popping up out of the grass.
const pop = (t) => {
  const x = clamp(t, 0, 1)
  return 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2
}

// Census signs and the villages that grow around them. Each land tile joined to a signed island
// raises a little hut; when the island is closed in at its number, the sign is taken down, the
// last hut goes up where it stood, and the village comes to life with glowing doorways and smoke.
export class Villages {
  constructor(garden) {
    this.garden = garden
    this.signs = []
    this.signModels = new Map()
    this.huts = new Map()
    this.alive = new Map()
    const m = (color) => new THREE.MeshLambertMaterial({ color })
    this.materials = {
      wall: m(0xc9a173), thatch: m(0xb48c45), windowOff: m(0x4a3322), post: m(0x8a5a3c), board: m(0xd9a86a),
      windowOn: new THREE.MeshBasicMaterial({ color: 0xffd98a }),
      roofs: ROOFS.map(m),
    }
    this.smoke = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf4f6f7, transparent: true, opacity: 0.75, depthWrite: false }), SMOKE)
    this.smoke.count = 0
    this.smoke.castShadow = false
    this.smoke.frustumCulled = false
    garden.scene.add(this.smoke)
    this.dummy = new THREE.Object3D()
    this.chimneyAt = new THREE.Vector3()
  }

  cell(row, col) { return this.garden.cells[row * 10 + col] }

  // A chunky wooden sign on a post, its rounded board tipped toward the camera so the island's
  // number reads at a glance: dark painted numerals with a cream outline, and a nail in each corner.
  buildSign(size) {
    const group = new THREE.Group()
    const garden = this.garden
    garden.mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.16, 8), this.materials.post, group, 0, 0.08, 0.02)
    const board = new THREE.Group()
    board.position.set(0, 0.17, 0.02)
    board.rotation.x = -1.25
    group.add(board)
    garden.mesh(new RoundedBoxGeometry(0.42, 0.31, 0.045, 3, 0.05), this.materials.post, board, 0, 0, -0.004)
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 184
    const context = canvas.getContext('2d')
    const grain = context.createLinearGradient(0, 0, 0, 184)
    grain.addColorStop(0, '#efc98f')
    grain.addColorStop(1, '#ddb173')
    context.fillStyle = grain
    context.beginPath()
    context.roundRect(0, 0, 256, 184, 34)
    context.fill()
    context.strokeStyle = '#c9965a'
    context.lineWidth = 4
    for (const y of [62, 122]) { context.beginPath(); context.moveTo(18, y); context.lineTo(238, y + 3); context.stroke() }
    context.fillStyle = '#8a5a3c'
    for (const [x, y] of [[24, 24], [232, 24], [24, 160], [232, 160]]) { context.beginPath(); context.arc(x, y, 7, 0, Math.PI * 2); context.fill() }
    context.font = 'bold 150px Georgia, serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.lineWidth = 16
    context.strokeStyle = '#fff3dc'
    context.strokeText(String(size), 128, 100)
    context.fillStyle = '#3e2618'
    context.fillText(String(size), 128, 100)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    // A touch of its own light keeps the number legible in shade and at dusk.
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.28), new THREE.MeshLambertMaterial({ map: texture, transparent: true, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.35 }))
    face.position.z = 0.024
    board.add(face)
    return group
  }


  // A little round straw hut: earthen walls under a layered thatched cone, with a doorway that
  // glows with firelight once the village is alive, and smoke rising from the roof's crown.
  buildHut(seed) {
    const group = new THREE.Group()
    const garden = this.garden
    const m = this.materials
    const straw = m.roofs[Math.floor(seed * m.roofs.length)]
    garden.mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.1, 14), m.wall, group, 0, 0.05, 0)
    garden.mesh(new THREE.ConeGeometry(0.14, 0.13, 14), straw, group, 0, 0.165, 0)
    garden.mesh(new THREE.ConeGeometry(0.095, 0.1, 14), straw, group, 0, 0.235, 0)
    // A darker fringe where the thatch hangs over the walls, and a tied bundle at the crown.
    const fringe = garden.mesh(new THREE.TorusGeometry(0.13, 0.013, 6, 18), m.thatch, group, 0, 0.105, 0)
    fringe.rotation.x = Math.PI / 2
    const band = garden.mesh(new THREE.TorusGeometry(0.088, 0.01, 6, 16), m.thatch, group, 0, 0.19, 0)
    band.rotation.x = Math.PI / 2
    garden.mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.04, 8), m.thatch, group, 0, 0.29, 0)
    garden.mesh(new THREE.BoxGeometry(0.045, 0.07, 0.012), m.windowOff, group, 0, 0.035, 0.09)
    garden.mergeDetails(group)
    const windows = group.children.find((child) => child.material === m.windowOff)
    return { group, windows, chimney: new THREE.Vector3(0, 0.31, 0) }
  }


  // Starting a new garden: put up its signs.
  set(signs = []) {
    for (const model of this.signModels.values()) this.dispose(model.group)
    for (const hut of this.huts.values()) this.dispose(hut.group)
    for (const cell of this.hidden?.values() ?? []) cell.plants.visible = true
    this.signModels.clear()
    this.huts.clear()
    this.alive.clear()
    this.hidden = new Map()
    this.signs = signs
    for (const sign of signs) {
      const [row, col] = sign.cell
      const cell = this.cell(row, col)
      const group = this.buildSign(sign.size)
      group.position.y = LAND_TOP
      group.rotation.y = (hash(row * 10 + col) - 0.5) * 0.16
      cell.land.add(group)
      this.signModels.set(row * 10 + col, { group, cell, down: null })
    }
  }

  dispose(group) {
    group.parent?.remove(group)
    group.traverse((child) => { child.geometry?.dispose(); if (child.material?.map) { child.material.map.dispose(); child.material.dispose() } })
  }

  // Which tiles carry a hut and which villages are alive, after the grid changes.
  update(grid, time, animate) {
    const wanted = new Map()
    const aliveNow = new Map()
    for (const village of villages(grid, this.signs)) {
      const signKey = village.sign.cell[0] * 10 + village.sign.cell[1]
      for (const [r, c] of village.cells) {
        const key = r * 10 + c
        if (key !== signKey || village.complete) wanted.set(key, signKey)
      }
      if (village.complete) aliveNow.set(signKey, village.cells.map(([r, c]) => r * 10 + c))
    }
    // Huts go up on newly joined tiles and come down from tiles that left a village.
    for (const [key, signKey] of wanted) {
      if (this.huts.has(key) && !this.huts.get(key).leaving) continue
      if (this.huts.has(key)) this.dispose(this.huts.get(key).group)
      const cell = this.garden.cells[key]
      const seed = hash(key + signKey * 0.37)
      const hut = this.buildHut(seed)
      hut.group.position.set((hash(key + 3) - 0.5) * 0.12, LAND_TOP, (hash(key + 5) - 0.5) * 0.12)
      hut.group.rotation.y = Math.floor(seed * 4) * Math.PI / 2 + (hash(key + 7) - 0.5) * 0.5
      cell.land.add(hut.group)
      // The final hut, where the sign stood, waits a beat for the sign to come down.
      const isSign = key === signKey
      hut.born = animate ? time + (isSign ? 0.55 : 0) : -100
      hut.scale = 0.001
      hut.group.scale.setScalar(0.001)
      this.huts.set(key, hut)
      this.hide(key, cell)
    }
    for (const [key, hut] of this.huts) {
      if (wanted.has(key) || hut.leaving) continue
      hut.leaving = animate ? time : -100
    }
    // Signs come down when their village is complete, and go back up if it is undone.
    for (const [key, model] of this.signModels) {
      const complete = aliveNow.has(key)
      if (complete && !model.down) model.down = { at: animate ? time : -100 }
      if (!complete && model.down) model.down = null
    }
    // Villages that just came to life light their windows one by one and start their fires.
    for (const [signKey, keys] of aliveNow) {
      if (!this.alive.has(signKey)) {
        this.alive.set(signKey, { since: animate ? time + 0.8 : -100, keys })
        if (animate) this.onAlive?.(signKey)
      } else this.alive.get(signKey).keys = keys
    }
    for (const signKey of [...this.alive.keys()]) if (!aliveNow.has(signKey)) this.alive.delete(signKey)
  }

  // Trees step aside on tiles that hold a hut or a sign, so the village reads clearly.
  hide(key, cell) {
    cell.plants.visible = false
    this.hidden.set(key, cell)
  }

  isVillage(cells) {
    return cells.some(({ row, col }) => this.signModels.has(row * 10 + col))
  }

  animate(time, reducedMotion) {
    for (const [key, hut] of this.huts) {
      const cell = this.garden.cells[key]
      if (hut.leaving !== undefined) {
        const t = reducedMotion ? 1 : (time - hut.leaving) / 0.35
        hut.group.scale.setScalar(Math.max(0.001, 1 - clamp(t, 0, 1)))
        if (t >= 1) {
          this.dispose(hut.group)
          this.huts.delete(key)
          if (!this.signModels.has(key)) { cell.plants.visible = true; this.hidden.delete(key) }
        }
        continue
      }
      const t = reducedMotion ? 1 : (time - hut.born) / 0.5
      let scale = t <= 0 ? 0.001 : pop(t)
      // A living village's huts each give a little hop as it wakes.
      const village = [...this.alive.values()].find((alive) => alive.keys.includes(key))
      if (village && !reducedMotion) {
        const order = village.keys.indexOf(key)
        const hop = time - village.since - order * 0.12
        if (hop > 0 && hop < 0.4) scale *= 1 + Math.sin(hop / 0.4 * Math.PI) * 0.15
      }
      hut.group.scale.setScalar(Math.max(0.001, scale * 1.65))
      // Windows glow once the village is alive, one hut after another.
      const lit = village && (reducedMotion || time - village.since - village.keys.indexOf(key) * 0.12 > 0)
      if (hut.windows) hut.windows.material = lit ? this.materials.windowOn : this.materials.windowOff
    }
    for (const model of this.signModels.values()) {
      model.cell.plants.visible = false
      if (!model.down) { model.group.visible = true; model.group.scale.setScalar(SIGN_SCALE); model.group.position.y = LAND_TOP; continue }
      // The sign spins down into the ground.
      const t = reducedMotion ? 1 : clamp((time - model.down.at) / 0.6, 0, 1)
      model.group.visible = t < 1
      model.group.scale.setScalar(Math.max(0.001, SIGN_SCALE * (1 - t * t)))
      model.group.position.y = LAND_TOP - t * 0.15
      model.group.rotation.y += reducedMotion ? 0 : 0.25 * (1 - t)
    }
    this.animateSmoke(time, reducedMotion)
  }

  // Each living hut sends soft puffs up from its thatched crown that swell, drift, and fade away.
  animateSmoke(time, reducedMotion) {
    let n = 0
    if (!reducedMotion) {
      for (const village of this.alive.values()) {
        for (const key of village.keys) {
          const hut = this.huts.get(key)
          if (!hut || hut.leaving !== undefined || n + PUFFS > SMOKE) continue
          const age = time - village.since - village.keys.indexOf(key) * 0.12
          if (age < 0.3) continue
          hut.group.updateWorldMatrix(true, false)
          this.chimneyAt.copy(hut.chimney).applyMatrix4(hut.group.matrixWorld)
          for (let i = 0; i < PUFFS; i++) {
            const t = ((age - 0.3) / 2.6 + i / PUFFS + hash(key) * 0.3) % 1
            const grow = Math.sin(Math.min(1, t * 1.6) * Math.PI / 2)
            this.dummy.position.set(this.chimneyAt.x + Math.sin(t * 4 + key) * 0.05 + t * 0.16, this.chimneyAt.y + t * 0.7, this.chimneyAt.z - t * 0.08)
            this.dummy.scale.setScalar(Math.max(0.001, (0.03 + t * 0.08) * grow * (1 - t * t)))
            this.dummy.updateMatrix()
            this.smoke.setMatrixAt(n++, this.dummy.matrix)
          }
        }
      }
    }
    this.smoke.count = n
    this.smoke.instanceMatrix.needsUpdate = true
  }

  get hutCount() { return [...this.huts.values()].filter((hut) => hut.leaving === undefined).length }
  get aliveCount() { return this.alive.size }
}
