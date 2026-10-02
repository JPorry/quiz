import * as THREE from 'three'
import { findEnclosedRegions, chooseCompletionVariant } from './terrain.js'
import { HabitatWildlife } from './wildlife.js'

const clamp = THREE.MathUtils.clamp
const ease = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3

export class RegionCompletions {
  constructor(garden) {
    this.garden = garden
    this.regions = new Map()
    this.active = []
    this.events = []
    this.lastVariant = {}
    this.wildlife = new HabitatWildlife(garden)
    this.petalGeometry = new THREE.SphereGeometry(0.045, 6, 4)
    this.dropGeometry = new THREE.IcosahedronGeometry(0.036, 1)
    this.ringGeometry = new THREE.TorusGeometry(0.22, 0.009, 4, 40)
    this.lilyMaterial = new THREE.MeshStandardMaterial({ color: 0x509273, roughness: 1 })
  }

  removeDecoration(region) {
    this.garden.scene.remove(region.group)
    region.group.traverse((child) => child.geometry?.dispose())
  }

  removeEffect(effect) {
    this.garden.scene.remove(effect.group)
    effect.group.traverse((child) => child.material?.dispose())
  }

  clear() {
    for (const region of this.regions.values()) this.removeDecoration(region)
    this.active.forEach((effect) => this.removeEffect(effect))
    this.regions.clear()
    this.active = []
    this.events = []
    this.lastVariant = {}
  }

  update(grid, animateNew) {
    const enclosed = findEnclosedRegions(grid)
    const current = new Set(enclosed.map((region) => region.id))
    for (const [id, region] of this.regions) {
      if (current.has(id)) continue
      this.removeDecoration(region)
      this.regions.delete(id)
    }
    this.active = this.active.filter((effect) => {
      if (current.has(effect.id)) return true
      this.removeEffect(effect)
      return false
    })
    for (const region of enclosed) {
      if (this.regions.has(region.id)) continue
      const decoration = this.makeDecoration(region, animateNew)
      this.regions.set(region.id, decoration)
      if (!animateNew) continue
      const variant = chooseCompletionVariant(region.value, this.lastVariant[region.value])
      this.lastVariant[region.value] = variant
      this.events.push({ id: region.id, value: region.value, variant, habitat: decoration.habitat.kind, cells: region.cells.length, time: this.garden.time })
      if (this.events.length > 64) this.events.shift()
      if (this.garden.reducedMotion) continue
      if (this.active.length >= 5) this.removeEffect(this.active.shift())
      this.active.push(this.makeEffect(region, variant))
    }
  }

  makeDecoration(region, animateNew) {
    const owner = this.garden
    const group = new THREE.Group()
    owner.scene.add(group)
    const nodes = []
    const chosen = region.value === 1 ? region.cells : region.cells.filter((_, index) => index % Math.max(1, Math.ceil(region.cells.length / 6)) === 0)
    chosen.forEach((cell, index) => {
      const node = new THREE.Group()
      node.position.set(cell.col - 4.5, 0, cell.row - 4.5)
      group.add(node)
      if (region.value === 1) {
        for (let i = 0; i < 3; i++) {
          const angle = i * 2.1 + index * 0.9
          owner.addFlower(node, Math.cos(angle) * 0.27, 0.445, Math.sin(angle) * 0.27, cell.row * 10 + cell.col + i)
        }
      } else {
        const angle = index * 2.4
        const x = Math.cos(angle) * 0.15, z = Math.sin(angle) * 0.15
        const pad = owner.mesh(new THREE.CircleGeometry(0.17, 16, 0.15, Math.PI * 1.87), this.lilyMaterial, node, x, 0.073, z)
        pad.rotation.x = -Math.PI / 2
        owner.addFlower(node, x, 0.075, z, index)
      }
      owner.mergeDetails(node)
      nodes.push({ group: node, cell, index })
    })
    const started = animateNew ? owner.time : -100
    const habitat = this.wildlife.create(region, group, started)
    return { ...region, group, nodes, habitat, started }
  }

  makeEffect(region, variant) {
    const owner = this.garden
    const group = new THREE.Group()
    owner.scene.add(group)
    const particles = [], rings = []
    const count = variant === 'lake-ripples' ? 8 : 18
    const palette = variant === 'island-bloom' ? [0xf3baa6, 0xf7eac4]
      : variant === 'island-meadow' ? [0xb9d587, 0xe3edbc]
        : region.value === 1 ? [0xffe6a0, 0xf5f5d3] : [0xccece0, 0x9ad9db]
    for (let i = 0; i < count; i++) {
      const cell = region.cells[i % region.cells.length]
      const mat = new THREE.MeshBasicMaterial({ color: palette[i % palette.length], transparent: true, depthWrite: false })
      const mesh = new THREE.Mesh(variant === 'island-bloom' || variant === 'island-meadow' ? this.petalGeometry : this.dropGeometry, mat)
      group.add(mesh)
      particles.push({ mesh, x: cell.col - 4.5, z: cell.row - 4.5, angle: Math.random() * Math.PI * 2, delay: (i % 6) * 0.055, index: i })
    }
    {
      const count = region.value === 1 ? Math.min(region.cells.length, 8) : variant === 'lake-ripples' ? 9 : 3
      for (let i = 0; i < count; i++) {
        const cell = region.cells[i % region.cells.length]
        const mat = new THREE.MeshBasicMaterial({ color: region.value === 1 ? 0xf0edbf : i % 2 ? 0xa6dde1 : 0xe5f2d9, transparent: true, opacity: 0, depthWrite: false })
        const mesh = new THREE.Mesh(this.ringGeometry, mat)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(cell.col - 4.5, region.value === 1 ? 0.48 : 0.087, cell.row - 4.5)
        group.add(mesh)
        rings.push({ mesh, cell, delay: i * 0.15 + (variant === 'lake-fountain' ? 0.65 : 0) })
      }
    }
    return { id: region.id, value: region.value, cells: region.cells, variant, group, particles, rings, started: owner.time, duration: 3.2 }
  }

  animate(time) {
    const owner = this.garden
    this.active = this.active.filter((effect) => {
      const age = time - effect.started
      if (age >= effect.duration) { this.removeEffect(effect); return false }
      for (const particle of effect.particles) {
        const t = clamp((age - particle.delay) / 2.4, 0, 1)
        particle.mesh.visible = age >= particle.delay
        particle.mesh.material.opacity = Math.sin(t * Math.PI) * 0.9
        const angle = particle.angle + t * (effect.variant === 'island-fireflies' ? 8 : 3)
        let radius = 0.10 + t * 0.4, y = 0.45 + Math.sin(t * Math.PI) * 0.95
        if (effect.variant === 'island-fireflies') { radius = 0.25 + Math.sin(t * Math.PI) * 0.15; y = 0.70 + t * 0.95 + Math.sin(angle * 1.5) * 0.10 }
        if (effect.variant === 'island-meadow') { radius = t * 0.36; y = 0.49 + Math.sin(t * Math.PI) * 0.40 }
        if (effect.variant === 'lake-fountain') { radius = 0.06 + t * 0.24; y = 0.08 + Math.sin(t * Math.PI) * (0.65 + particle.index % 3 * 0.12) }
        if (effect.variant === 'lake-lotus') { radius = 0.12 + t * 0.14; y = 0.08 + Math.sin(t * Math.PI) * 0.40 }
        if (effect.variant === 'lake-ripples') { radius = 0.08 + t * 0.28; y = 0.10 + Math.sin(t * Math.PI) * 0.06 }
        particle.mesh.position.set(particle.x + Math.cos(angle) * radius, y, particle.z + Math.sin(angle) * radius)
        particle.mesh.rotation.set(angle, angle * 0.7, angle * 1.3)
        const scale = Math.sin(t * Math.PI) * 1.25
        particle.mesh.scale.set(scale * (effect.variant === 'island-bloom' ? 1.5 : 1), scale * (effect.variant === 'lake-fountain' ? 1.7 : 0.7), scale)
      }
      for (const ring of effect.rings) {
        const t = clamp((age - ring.delay) / 1.6, 0, 1)
        ring.mesh.visible = age >= ring.delay
        ring.mesh.scale.setScalar(0.2 + t * 1.6)
        ring.mesh.material.opacity = (1 - t) ** 2 * 0.6
        if (effect.value === 1) ring.mesh.position.y = 0.48 + owner.cells[ring.cell.row * 10 + ring.cell.col].land.position.y
      }
      if (effect.variant === 'island-meadow') effect.cells.forEach((position, index) => {
        const cell = owner.cells[position.row * 10 + position.col]
        const wave = Math.sin(Math.max(0, age - index * 0.07) * 7) * Math.exp(-age * 1.8)
        cell.land.position.y += wave * 0.025
        cell.plants.rotation.z += wave * 0.05
      })
      return true
    })
    for (const region of this.regions.values()) {
      for (const node of region.nodes) {
        const t = owner.reducedMotion ? 1 : clamp((time - region.started - node.index * 0.055) / 1.35, 0, 1)
        const growth = ease(t) + Math.sin(t * Math.PI * 2) * (1 - t) * 0.12
        node.group.scale.setScalar(Math.max(0.001, growth))
        node.group.position.y = region.value === 1 ? owner.cells[node.cell.row * 10 + node.cell.col].land.position.y : 0
      }
      this.wildlife.animate(region.habitat, time)
    }
  }
}
