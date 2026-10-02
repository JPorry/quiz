import * as THREE from 'three'

const clamp = THREE.MathUtils.clamp
const easeOutBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2
const HOLE = 0.74
export const SOCKET_TOP = 0.1

function roundedRect(size, radius) {
  const shape = new THREE.Shape()
  const h = size / 2
  shape.moveTo(-h + radius, -h)
  shape.lineTo(h - radius, -h)
  shape.absarc(h - radius, -h + radius, radius, -Math.PI / 2, 0)
  shape.lineTo(h, h - radius)
  shape.absarc(h - radius, h - radius, radius, 0, Math.PI / 2)
  shape.lineTo(-h + radius, h)
  shape.absarc(-h + radius, h - radius, radius, Math.PI / 2, Math.PI)
  shape.lineTo(-h, -h + radius)
  shape.absarc(-h + radius, -h + radius, radius, Math.PI, Math.PI * 1.5)
  return shape
}

// A sheet of drawing paper with a dashed pencil outline: the plan for a tile not yet built.
function sketchTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  context.fillStyle = '#efe5cd'
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 260; i++) {
    const x = Math.sin(i * 12.9898) * 43758.5453 % 1, y = Math.sin(i * 78.233) * 12543.123 % 1
    context.fillStyle = i % 3 ? '#e3d6ba' : '#f7efdc'
    context.fillRect(Math.abs(x) * size, Math.abs(y) * size, 2, 2)
  }
  context.strokeStyle = '#b3a283'
  context.lineWidth = 3.2
  context.lineCap = 'round'
  context.setLineDash([9, 8])
  context.beginPath()
  context.roundRect(20, 20, size - 40, size - 40, 16)
  context.stroke()
  context.setLineDash([])
  context.lineWidth = 2.4
  for (const [x, y] of [[size / 2, size / 2]]) {
    context.beginPath()
    context.moveTo(x - 6, y); context.lineTo(x + 6, y)
    context.moveTo(x, y - 6); context.lineTo(x, y + 6)
    context.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// Undecided tiles are empty sockets in the unfinished diorama: cream plaster frames around a
// sketched paper floor, with no water poured yet. Building a tile pushes its socket away;
// clearing one pops a socket back up.
export class SocketBoard {
  constructor(garden) {
    this.garden = garden
    const frameShape = roundedRect(1, 0.002)
    frameShape.holes.push(roundedRect(HOLE, 0.12))
    const frame = new THREE.ExtrudeGeometry(frameShape, { depth: SOCKET_TOP + 0.06, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2).translate(0, -0.06, 0)
    const floor = new THREE.PlaneGeometry(HOLE + 0.02, HOLE + 0.02).rotateX(-Math.PI / 2)
    const frameMaterials = [new THREE.MeshLambertMaterial({ color: 0xf6eedb }), new THREE.MeshLambertMaterial({ color: 0xdccdaa })]
    const floorMaterial = new THREE.MeshLambertMaterial({ map: sketchTexture() })
    this.cells = Array.from({ length: 100 }, (_, index) => {
      const group = new THREE.Group()
      const row = Math.floor(index / 10), col = index % 10
      group.position.set(col - 4.5, 0, row - 4.5)
      garden.mesh(frame, frameMaterials, group)
      garden.mesh(floor, floorMaterial, group, 0, -0.02, 0).castShadow = false
      group.visible = false
      garden.scene.add(group)
      return { row, col, group, present: false, changed: -10 }
    })
  }

  update(grid, time, { intro = false, animate = true } = {}) {
    for (const cell of this.cells) {
      const present = grid[cell.row][cell.col] === null
      if (present === cell.present && !intro) continue
      cell.present = present
      // A fresh board assembles itself in a wave from the top-left corner.
      cell.changed = !animate ? -10 : intro ? time + (cell.row + cell.col) * 0.03 : time
    }
  }

  animate(time, reducedMotion) {
    for (const cell of this.cells) {
      const age = reducedMotion ? 10 : time - cell.changed
      const { group } = cell
      if (cell.present) {
        // Pops up from below with a springy overshoot and a little squash.
        const t = clamp(age / 0.55, 0, 1)
        group.visible = age >= 0
        group.position.y = -0.3 * (1 - easeOutBack(t))
        const squash = Math.sin(t * Math.PI) * 0.12
        group.scale.set(1 + squash * 0.5, Math.max(0.05, 1 - squash), 1 + squash * 0.5)
      } else {
        // Pushed down out of the way as the water floods in or the land rises.
        const t = clamp(age / 0.4, 0, 1)
        group.visible = t < 1
        group.position.y = -0.32 * t * t
        group.scale.set(1 - t * 0.12, 1, 1 - t * 0.12)
      }
    }
  }
}
