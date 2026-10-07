import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { part, baked } from './look.js'

// The habitat's little residents and their things, as chunky toys with sticker
// outlines: hamsters in a few coats, and the furniture that fills a room once
// it's finished (a bed, a food bowl, a wheel, seeds, chew blocks, a ball, a
// carrot and a wooden hideout).

export const LINE = 0x6a4a3a
const BALL = new THREE.SphereGeometry(1, 20, 14)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24)
const TORUS = new THREE.TorusGeometry(1, 0.13, 10, 32)
const CONE = new THREE.ConeGeometry(1, 1, 16)
const ARCH = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI)
const softs = new Map()
export const SOFT = (r = 0.25) => {
  if (!softs.has(r)) softs.set(r, new RoundedBoxGeometry(1, 1, 1, 3, r))
  return softs.get(r)
}
export { BALL, CYL, TORUS, CONE }

// coat and belly
export const COATS = [[0xf5a65b, 0xfff3e2], [0xf0c48c, 0xfff6ea], [0xd9d1c9, 0xffffff], [0x9b7b66, 0xf3e3d3], [0xfff6ea, 0xffffff], [0xe8b07a, 0xfff3e2], [0xc9a27e, 0xfff6ea]]

// A hamster, sitting up, facing +z. `eyes`: 'open' or 'shut' (happy and asleep).
export function hamsterParts(coat = 0, eyes = 'open') {
  const [f, b] = COATS[coat % COATS.length]
  const P = []
  P.push(part(BALL, f, [0, 0.24, 0], [0.29, 0.25, 0.27]))
  P.push(part(BALL, b, [0, 0.2, 0.15], [0.2, 0.18, 0.13]))
  for (const s of [-1, 1]) {
    P.push(part(BALL, f, [s * 0.16, 0.44, -0.02], [0.075, 0.075, 0.05]))
    P.push(part(BALL, 0xf7aeb4, [s * 0.16, 0.445, 0.02], [0.048, 0.05, 0.02]))
    P.push(part(BALL, 0xf79a9a, [s * 0.165, 0.25, 0.235], [0.055, 0.035, 0.02]))
    P.push(part(BALL, 0xf9c3b5, [s * 0.1, 0.04, 0.2], [0.055, 0.03, 0.06]))
    P.push(part(BALL, 0xf9c3b5, [s * 0.07, 0.17, 0.27], [0.04, 0.03, 0.03]))
    if (eyes === 'shut') P.push(part(BALL, 0x3a2a22, [s * 0.095, 0.31, 0.25], [0.045, 0.009, 0.02]))
    else {
      P.push(part(BALL, 0x2a1d17, [s * 0.095, 0.31, 0.245], [0.038, 0.042, 0.03]))
      P.push(part(BALL, 0xffffff, [s * 0.085, 0.322, 0.272], [0.012, 0.012, 0.008]))
    }
  }
  P.push(part(BALL, 0xe88a8a, [0, 0.26, 0.275], [0.024, 0.018, 0.015]))
  return P
}

// One hamster that can blink, open or shut its eyes, and hop.
export class Hamster {
  constructor(coat = 0, scale = 1) {
    this.group = new THREE.Group()
    this.body = new THREE.Group()
    this.group.add(this.body)
    this.open = baked(hamsterParts(coat, 'open'), { line: LINE, width: 0.014 })
    this.shut = baked(hamsterParts(coat, 'shut'), { line: LINE, width: 0.014 })
    this.shut.visible = false
    this.body.add(this.open, this.shut)
    this.group.scale.setScalar(scale)
    this.hop = -1
    this.hopHeight = 0.25
    this.blink = 2 + Math.random() * 3
    this.asleep = false
    this.turn = 0
    this.turnTarget = 0
    this.wait = Math.random() * 3
  }

  jump(height = 0.25) { this.hop = 0; this.hopHeight = height }

  setAsleep(asleep) { this.asleep = asleep }

  update(dt, time, { idle = true } = {}) {
    // blinks now and then; eyes stay shut while asleep
    this.blink -= dt
    const blinking = this.blink < 0.12
    if (this.blink < 0) this.blink = 2 + Math.random() * 4
    const shut = this.asleep || blinking
    this.open.visible = !shut
    this.shut.visible = shut
    let y = 0, squash = 1
    if (this.hop >= 0) {
      this.hop += dt / 0.5
      const k = Math.min(1, this.hop)
      y = Math.sin(k * Math.PI) * this.hopHeight
      squash = 1 + Math.sin(k * Math.PI * 2) * 0.08 * (1 - k)
      if (k >= 1) this.hop = -1
    }
    // breathing, a slow rise and fall; a sleeper breathes slower and deeper
    const breath = Math.sin(time * (this.asleep ? 1.6 : 3) + this.group.id) * (this.asleep ? 0.03 : 0.015)
    this.body.position.y = y
    this.body.scale.set(1 / Math.sqrt(squash) + breath * 0.5, squash + breath, 1 / Math.sqrt(squash) + breath * 0.5)
    if (idle && !this.asleep) {
      // looks around every so often
      this.wait -= dt
      if (this.wait < 0) { this.wait = 1.5 + Math.random() * 3; this.turnTarget = (Math.random() - 0.5) * 1.4 }
    } else this.turnTarget = 0
    this.turn = THREE.MathUtils.damp(this.turn, this.turnTarget, 6, dt)
    this.body.rotation.y = this.turn
  }
}

/* ---------- furniture ---------- */

export function bedParts() {
  return [
    part(SOFT(0.3), 0xf7b9c4, [0, 0.07, 0], [0.72, 0.14, 0.62]),
    part(SOFT(0.3), 0xfde3e8, [0, 0.12, 0], [0.6, 0.06, 0.5]),
    part(SOFT(0.45), 0xffffff, [0, 0.18, -0.17], [0.32, 0.1, 0.16]),
  ]
}
function bowl() {
  const P = [part(CYL, 0x7cc0e6, [0, 0.07, 0], [0.24, 0.14, 0.24]), part(CYL, 0xc9e8f8, [0, 0.145, 0], [0.19, 0.01, 0.19])]
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4, r = 0.03 + (k % 3) * 0.05
    P.push(part(BALL, k % 2 ? 0x4a3a30 : 0xe9d7b5, [Math.cos(a) * r, 0.17 + (k % 2) * 0.02, Math.sin(a) * r], [0.035, 0.022, 0.055], [0, a, 0.3]))
  }
  return P
}
function wheel() {
  const P = [part(TORUS, 0xffd166, [0, 0.4, 0], [0.32, 0.32, 0.9]), part(CYL, 0xffd166, [0, 0.4, 0], [0.04, 0.12, 0.04], [Math.PI / 2, 0, 0])]
  for (let k = 0; k < 6; k++) P.push(part(CYL, 0xffe4a0, [0, 0.4, 0], [0.012, 0.6, 0.012], [0, 0, k * Math.PI / 3]))
  P.push(part(SOFT(0.3), 0xf2a65a, [0, 0.03, 0], [0.5, 0.06, 0.24]))
  P.push(part(CYL, 0xf2a65a, [0, 0.2, -0.06], [0.03, 0.36, 0.03]))
  return P
}
function seedPile() {
  const P = []
  for (let k = 0; k < 16; k++) {
    const a = k * 2.2, r = (k % 5) * 0.05, y = 0.03 + (4 - (k % 5)) * 0.025
    P.push(part(BALL, k % 3 ? 0x4a3a30 : 0xf0e3c8, [Math.cos(a) * r, y, Math.sin(a) * r], [0.045, 0.028, 0.075], [0, a, 0.4]))
  }
  return P
}
function blocks() {
  return [
    part(SOFT(0.2), 0xe3b182, [-0.1, 0.09, 0.05], [0.26, 0.18, 0.26], [0, 0.3, 0]),
    part(SOFT(0.2), 0xd69a64, [0.15, 0.09, -0.08], [0.24, 0.18, 0.24], [0, -0.2, 0]),
    part(SOFT(0.2), 0xf0c48c, [0.02, 0.26, -0.01], [0.22, 0.16, 0.22], [0, 0.6, 0]),
  ]
}
function carrot() {
  return [
    part(CONE, 0xff9a4d, [0, 0.07, 0], [0.08, 0.4, 0.08], [0, 0, Math.PI / 2 + 0.2]),
    part(BALL, 0x6cc070, [0.22, 0.1, 0], [0.06, 0.03, 0.03], [0, 0, 0.6]),
    part(BALL, 0x6cc070, [0.22, 0.1, 0.03], [0.07, 0.025, 0.025], [0, 0.5, 0.3]),
  ]
}
function ball() {
  return [part(BALL, 0xc7a3ff, [0, 0.17, 0], [0.17, 0.17, 0.17]), part(TORUS, 0xffffff, [0, 0.17, 0], [0.17, 0.17, 0.4], [0.4, 0, 0.3])]
}
function hideout() {
  return [part(ARCH, 0xd69a64, [0, 0, 0], [0.3, 0.55, 0.3], [Math.PI / 2, Math.PI / 2, 0]), part(CYL, 0x6b4128, [0, 0.0, 0.275], [0.17, 0.01, 0.17], [Math.PI / 2, 0, 0])]
}
function cushion() {
  return [part(SOFT(0.45), 0xb9e4d0, [0, 0.06, 0], [0.5, 0.12, 0.5]), part(BALL, 0xffffff, [0, 0.13, 0], [0.06, 0.02, 0.06])]
}
function sunflower() {
  const P = [part(CYL, 0x6cc070, [0, 0.2, 0], [0.025, 0.4, 0.025]), part(CYL, 0xf3a68a, [0, 0.06, 0], [0.12, 0.12, 0.12])]
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; P.push(part(BALL, 0xffd166, [Math.cos(a) * 0.09, 0.44, Math.sin(a) * 0.09 * 0.4 + 0.02], [0.05, 0.03, 0.03], [0.9, 0, a])) }
  P.push(part(BALL, 0x7a5232, [0, 0.44, 0.03], [0.06, 0.06, 0.03]))
  return P
}
export const FURNITURE = [bowl, wheel, seedPile, blocks, ball, carrot, hideout, cushion, sunflower]

// a sunflower seed: the player's mark for "this is bedding"
export function seedParts() {
  return [part(BALL, 0x4a3a30, [0, 0.05, 0], [0.09, 0.05, 0.15], [0, 0.6, 0]), part(BALL, 0xf0e3c8, [0, 0.085, 0], [0.02, 0.02, 0.12], [0, 0.6, 0])]
}
