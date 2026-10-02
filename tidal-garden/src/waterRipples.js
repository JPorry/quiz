import * as THREE from 'three'
import { terrainIsSolid } from './ocean.js'

const CAPACITY = 8
const SEGMENTS = 48
const ROWS = 3
const RINGS = 2
const VERTICES_PER_RING = (SEGMENTS + 1) * ROWS

export function clearWaterPath(terrain, x, z, targetX, targetZ) {
  let cellX = Math.floor(x), cellZ = Math.floor(z)
  const endX = Math.floor(targetX), endZ = Math.floor(targetZ)
  const dx = targetX - x, dz = targetZ - z
  const stepX = Math.sign(dx), stepZ = Math.sign(dz)
  const deltaX = dx ? Math.abs(1 / dx) : Infinity
  const deltaZ = dz ? Math.abs(1 / dz) : Infinity
  let crossingX = dx ? (cellX + (stepX > 0 ? 1 : 0) - x) / dx : Infinity
  let crossingZ = dz ? (cellZ + (stepZ > 0 ? 1 : 0) - z) / dz : Infinity
  // Traverse every crossed cell, including both sides of a shared corner.
  while (cellX !== endX || cellZ !== endZ) {
    const nextX = cellX === endX ? Infinity : crossingX
    const nextZ = cellZ === endZ ? Infinity : crossingZ
    if (Math.abs(nextX - nextZ) < 1e-10) {
      if (terrainIsSolid(terrain, cellX + stepX + 0.5, cellZ + 0.5)
        || terrainIsSolid(terrain, cellX + 0.5, cellZ + stepZ + 0.5)) return false
      cellX += stepX; cellZ += stepZ
      crossingX += deltaX; crossingZ += deltaZ
    } else if (nextX < nextZ) {
      cellX += stepX; crossingX += deltaX
    } else {
      cellZ += stepZ; crossingZ += deltaZ
    }
    if (terrainIsSolid(terrain, cellX + 0.5, cellZ + 0.5)) return false
  }
  return !terrainIsSolid(terrain, targetX, targetZ)
}

export class WaterRipples {
  constructor(terrain, reducedMotion = false, reach = Infinity) {
    this.terrain = terrain
    // Rings fade out at the edge of the water, not just at land.
    this.reach = reach
    this.reducedMotion = reducedMotion
    this.active = 0
    const geometry = new THREE.BufferGeometry()
    const count = CAPACITY * RINGS * VERTICES_PER_RING
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage))
    const indices = []
    for (let ring = 0; ring < CAPACITY * RINGS; ring++) for (let segment = 0; segment < SEGMENTS; segment++) for (let row = 0; row < ROWS - 1; row++) {
      const a = ring * VERTICES_PER_RING + segment * ROWS + row, b = a + ROWS
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
    geometry.setIndex(indices)
    geometry.setDrawRange(0, 0)
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 24)
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.renderOrder = 1
    this.mesh.visible = false
    this.color = new THREE.Color(0xf2fbf8)
  }

  animate(time, ripples) {
    const positions = this.mesh.geometry.attributes.position
    const colors = this.mesh.geometry.attributes.color
    let active = 0
    if (!this.reducedMotion) for (const ripple of ripples) {
      const age = time - ripple.z
      if (age < 0 || age >= 2.7 || active >= CAPACITY) continue
      const start = terrainIsSolid(this.terrain, ripple.x, ripple.y) ? 0.5 : 0.16
      const envelope = (1 - age / 2.7) * Math.min(1, age / 0.12)
      for (let ring = 0; ring < RINGS; ring++) {
        const radius = start + age * 1.35 - ring * 0.22
        for (let segment = 0; segment <= SEGMENTS; segment++) {
          const angle = segment / SEGMENTS * Math.PI * 2
          const dx = Math.cos(angle), dz = Math.sin(angle)
          const x = ripple.x + dx * radius, z = ripple.y + dz * radius
          const visible = radius > 0 && Math.max(Math.abs(x), Math.abs(z)) < this.reach && clearWaterPath(this.terrain, ripple.x, ripple.y, x, z)
          for (let row = 0; row < ROWS; row++) {
            const vertex = (active * RINGS + ring) * VERTICES_PER_RING + segment * ROWS + row
            const r = Math.max(0, radius + (row - 1) * 0.035)
            positions.setXYZ(vertex, ripple.x + dx * r, 0.07, ripple.y + dz * r)
            colors.setXYZW(vertex, this.color.r, this.color.g, this.color.b, visible && row === 1 ? envelope * (ring ? 0.30 : 0.65) : 0)
          }
        }
      }
      active++
    }
    this.active = active
    this.mesh.visible = active > 0
    this.mesh.geometry.setDrawRange(0, active * RINGS * SEGMENTS * (ROWS - 1) * 6)
    if (active) { positions.needsUpdate = true; colors.needsUpdate = true }
  }
}
