import * as THREE from 'three'
import { NUM } from './flowers.js'
import { toon } from './look.js'

// Marker flags: the player's notes. A little garden flag on a wooden stake, in
// a seed's own colour with its number on it, stuck in a plot to say "this one
// might be a 3". A plot holds up to six, one per number, each in its own place
// (1 to 3 along the back, 4 to 6 along the front) so they read like a grid.

const STAKE = 0.24
const W = 0.26, H = 0.2
const SPOTS = [[-0.36, -0.02], [-0.07, -0.02], [0.22, -0.02], [-0.36, 0.38], [-0.07, 0.38], [0.22, 0.38]]

const stake = new THREE.CylinderGeometry(0.016, 0.021, STAKE, 6).translate(0, STAKE / 2, 0)
// the flag hangs off the top of its stake with a soft ripple in it
const cloth = (() => {
  const g = new THREE.PlaneGeometry(W, H, 6, 1).translate(W / 2, 0, 0)
  const p = g.attributes.position
  for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getX(k) / W * Math.PI * 1.2) * 0.012)
  g.computeVertexNormals()
  return g
})()
const knob = new THREE.SphereGeometry(0.027, 8, 6)

const ink = '#3e3a4a'
const hex = (n) => '#' + n.toString(16).padStart(6, '0')

// Each number's flag face is drawn once, and drawn again when the game's
// rounded font arrives, so the numbers match the rest of the game.
function face(n) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 96
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const draw = () => {
    const c = canvas.getContext('2d')
    c.clearRect(0, 0, 128, 96)
    c.fillStyle = hex(NUM[n])
    c.strokeStyle = n === 6 ? '#b7a585' : 'rgba(62, 58, 74, .55)'
    c.lineWidth = 7
    c.beginPath()
    c.roundRect(4, 4, 120, 88, 18)
    c.fill()
    c.stroke()
    c.fillStyle = 'rgba(255, 255, 255, .35)'
    c.beginPath()
    c.roundRect(14, 12, 100, 20, 10)
    c.fill()
    c.fillStyle = ink
    c.font = "700 74px Fredoka, Nunito, ui-rounded, system-ui, sans-serif"
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(String(n), 64, 53)
    texture.needsUpdate = true
  }
  draw()
  document.fonts?.load("700 74px Fredoka").then(draw, () => {})
  return texture
}

let looks = null
function look() {
  if (looks) return looks
  looks = {
    wood: toon(0xc89a68, { rim: 0.2 }),
    knob: toon(0xfff3dc, { rim: 0.2 }),
    cloth: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [n, new THREE.MeshBasicMaterial({ map: face(n), side: THREE.DoubleSide, transparent: true, alphaTest: 0.3 })])),
  }
  return looks
}

// One flag, standing in its spot in a plot. `tilt` leans the cloth back
// towards the camera, so the number reads from above.
export function makeFlag(n, tilt) {
  const m = look()
  const group = new THREE.Group()
  const [x, z] = SPOTS[n - 1]
  group.position.set(x, 0, z)
  const pole = new THREE.Mesh(stake, m.wood)
  pole.castShadow = true
  const top = new THREE.Mesh(knob, m.knob)
  top.position.y = STAKE
  const flag = new THREE.Group()
  flag.position.set(0.008, STAKE - H / 2 - 0.012, 0)
  flag.rotation.x = -tilt
  const sheet = new THREE.Mesh(cloth, m.cloth[n])
  sheet.castShadow = true
  flag.add(sheet)
  group.add(pole, top, flag)
  group.scale.setScalar(0.001)
  return { group, flag, n, show: 0, target: 1, phase: Math.random() * 6 }
}
