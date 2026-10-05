import * as THREE from 'three'
import { part, merge } from './look.js'

// The plants in a cell, baked into one geometry. A cell with seed N holds N plants
// laid out like the pips on a die, so the number always reads at a glance, and
// grows through three stages:
//   sprout  a green seedling, the same for every bed
//   bud     the bed is complete: taller, with a half-open head in its flower
//   bloom   the garden is solved: the flower opens fully
// A wilting cell breaks a rule: its plants droop and turn straw coloured.

const SPHERE = new THREE.SphereGeometry(1, 8, 6)
const BALL = new THREE.SphereGeometry(1, 6, 4)
const STEM = new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0)
const CONE = new THREE.ConeGeometry(1, 1, 5).rotateZ(-Math.PI / 2).translate(0.5, 0, 0)

// Where the plants go in a cell (x, z), like a die's pips.
const D = 0.25
export const PIPS = {
  1: [[0, 0]],
  2: [[-D, -D], [D, D]],
  3: [[-D, -D], [0, 0], [D, D]],
  4: [[-D, -D], [D, -D], [-D, D], [D, D]],
  5: [[-D, -D], [D, -D], [0, 0], [-D, D], [D, D]],
  6: [[-0.22, -0.27], [0.22, -0.27], [-0.22, 0], [0.22, 0], [-0.22, 0.27], [0.22, 0.27]],
}
// fewer plants grow bigger, so a single flower fills its cell like a big pip
const SCALE = { 1: 1.55, 2: 1.3, 3: 1.18, 4: 1.12, 5: 1.02, 6: 0.95 }

export const COLORS = {
  tulip: { petal: 0xff5476, inner: 0xffc2cf, leaf: 0x6fb87a, carpet: '#ff7f98' },
  marigold: { petal: 0xff9124, inner: 0xffc443, leaf: 0x5aa84a, carpet: '#ffab52' },
  buttercup: { petal: 0xffd426, inner: 0xd6e86a, leaf: 0x62b04c, carpet: '#ffe066' },
  daisy: { petal: 0xffffff, inner: 0xffcf33, leaf: 0x5fb04f, carpet: '#ffffff' },
  forgetmenot: { petal: 0x8cd2ff, inner: 0xfff07a, leaf: 0x67b45a, carpet: '#a6dcff' },
  cornflower: { petal: 0x5a7dff, inner: 0x2f2a8a, leaf: 0x7aa889, carpet: '#7088ff' },
  lavender: { petal: 0xa97ee6, inner: 0xd2bdf5, leaf: 0x8fae80, carpet: '#bb98ee' },
  pansy: { petal: 0x7f48d1, inner: 0xffd84a, leaf: 0x5aa850, carpet: '#9a6be0' },
  rose: { petal: 0xff6fb0, inner: 0xe84a8f, leaf: 0x4f9a4a, carpet: '#ff94c4' },
  sunflower: { petal: 0xffc414, inner: 0x6b3f1f, leaf: 0x5aa84a, carpet: '#ffd23d' },
}

const SPROUT = 0x7fd04f
const SPROUT_LIGHT = 0xa6e46a
const MOUND = 0x5e3a24
const STRAW = new THREE.Color(0xc9a45c)

// A part placed in plant space, then carried to its spot in the cell.
function builder(matrix, wilt) {
  const parts = []
  const add = (geometry, color, position, scale, rotation) => {
    const c = new THREE.Color(color)
    if (wilt) c.lerp(STRAW, 0.6)
    const g = part(geometry, c, position, scale, rotation)
    g.applyMatrix4(matrix)
    parts.push(g)
  }
  return { parts, add }
}

// A petal pointing out at angle a, its base `r` from the middle, tilted up by `tilt`.
function petal(add, color, a, r, y, [len, thick, wid], tilt, geometry = SPHERE) {
  const reach = r + Math.cos(tilt) * len * (geometry === CONE ? 0 : 1)
  const x = geometry === CONE ? Math.cos(a) * r : Math.cos(a) * reach
  const z = geometry === CONE ? Math.sin(a) * r : Math.sin(a) * reach
  const lift = geometry === CONE ? 0 : Math.sin(tilt) * len
  add(geometry, color, [x, y + lift, z], [len, thick, wid], [0, -a, tilt])
}

const lerp = (a, b, k) => a + (b - a) * k

// A flower head sitting at height y, half open at `open` 0 and fully at 1.
function head(add, type, y, open, spin) {
  const c = COLORS[type]
  const ring = (n, color, r, size, closed, opened, at = y, geometry, offset = 0) => {
    for (let k = 0; k < n; k++) petal(add, color, spin + offset + (k / n) * Math.PI * 2, r, at, size, lerp(closed, opened, open), geometry)
  }
  switch (type) {
    case 'tulip':
      ring(6, c.petal, 0.012, [0.07, 0.028, 0.045], 1.3, 0.62)
      if (open > 0.5) add(SPHERE, 0x3d2b2b, [0, y + 0.01, 0], [0.018, 0.012, 0.018])
      break
    case 'marigold':
      ring(11, c.petal, 0.02, [0.05, 0.022, 0.036], 1.25, 0.12)
      ring(8, c.inner, 0.012, [0.036, 0.02, 0.03], 1.35, 0.55, y + 0.012, SPHERE, 0.3)
      add(SPHERE, 0xe0701a, [0, y + 0.02, 0], [0.022, 0.018, 0.022])
      break
    case 'buttercup':
      ring(5, c.petal, 0.008, [0.058, 0.02, 0.054], 1.3, 0.38)
      add(SPHERE, c.inner, [0, y + 0.01, 0], [0.022, 0.016, 0.022])
      break
    case 'daisy':
      ring(14, open > 0.4 ? c.petal : 0xe8f2d8, 0.02, [0.085, 0.009, 0.02], 1.3, 0.06)
      add(SPHERE, c.inner, [0, y + 0.006, 0], [0.034, 0.022, 0.034])
      break
    case 'forgetmenot':
      // a little cluster of florets, pink in bud
      for (let f = 0; f < 3; f++) {
        const a = spin + (f / 3) * Math.PI * 2
        const fx = Math.cos(a) * 0.05, fz = Math.sin(a) * 0.05, fy = y + (f === 0 ? 0.012 : 0)
        if (open < 0.5) { add(BALL, 0xf5a3c7, [fx, fy + 0.01, fz], [0.03, 0.03, 0.03]); continue }
        for (let k = 0; k < 5; k++) {
          const pa = a + (k / 5) * Math.PI * 2
          add(SPHERE, c.petal, [fx + Math.cos(pa) * 0.026, fy, fz + Math.sin(pa) * 0.026], [0.023, 0.009, 0.023])
        }
        add(SPHERE, c.inner, [fx, fy + 0.006, fz], [0.011, 0.009, 0.011])
      }
      break
    case 'cornflower':
      ring(11, c.petal, 0.02, [0.085, 0.03, 0.032], 1.2, 0.18, y, CONE)
      ring(7, 0x8aa2ff, 0.01, [0.05, 0.024, 0.024], 1.35, 0.6, y + 0.01, CONE, 0.25)
      add(SPHERE, c.inner, [0, y + 0.016, 0], [0.024, 0.02, 0.024])
      break
    case 'lavender': {
      // three spikes of little florets leaning outwards, pale until they open
      const color = open < 0.5 ? c.inner : c.petal
      for (let f = 0; f < 3; f++) {
        const a = spin + (f / 3) * Math.PI * 2
        const lean = lerp(0.12, 0.3, open)
        for (let k = 0; k < 6; k++) {
          const h = y - 0.03 + k * 0.02
          const out = 0.012 + k * 0.02 * Math.sin(lean) * 2
          add(BALL, k % 2 ? color : 0x9469d6, [Math.cos(a) * out, h, Math.sin(a) * out], [0.024 * (1 - k / 10), 0.02, 0.024 * (1 - k / 10)])
        }
      }
      break
    }
    case 'pansy':
      ring(2, 0xa47ae8, 0.01, [0.062, 0.016, 0.06], 1.3, 0.3, y + 0.004, SPHERE, -Math.PI / 2 - 0.5)
      ring(3, c.petal, 0.01, [0.058, 0.018, 0.056], 1.3, 0.25, y + 0.01, SPHERE, Math.PI / 2 - 2.1)
      if (open > 0.5) add(SPHERE, 0x3a1f6a, [0, y + 0.02, 0.012], [0.03, 0.006, 0.03])
      add(SPHERE, c.inner, [0, y + 0.024, 0.006], [0.012, 0.01, 0.012])
      break
    case 'rose':
      ring(5, c.petal, 0.02, [0.06, 0.03, 0.05], 1.25, 0.45)
      ring(4, 0xff86bf, 0.01, [0.045, 0.03, 0.04], 1.45, 0.95, y + 0.012, SPHERE, 0.6)
      add(SPHERE, c.inner, [0, y + 0.03, 0], [0.025, 0.028, 0.025])
      break
    case 'sunflower':
      ring(16, c.petal, 0.045, [0.075, 0.01, 0.026], 1.3, 0.08)
      add(SPHERE, c.inner, [0, y + 0.004, 0], [0.058, 0.02, 0.058])
      add(SPHERE, 0x8a5a2b, [0, y + 0.012, 0], [0.036, 0.016, 0.036])
      break
  }
}

function sprout(add, spin) {
  add(SPHERE, MOUND, [0, 0, 0], [0.1, 0.035, 0.1])
  add(STEM, SPROUT, [0, 0, 0], [0.016, 0.1, 0.016])
  for (const s of [-1, 1]) {
    const a = spin + (s > 0 ? 0 : Math.PI)
    add(SPHERE, s > 0 ? SPROUT_LIGHT : SPROUT, [Math.cos(a) * 0.058, 0.108, Math.sin(a) * 0.058], [0.068, 0.016, 0.042], [0, -a, 0.35])
  }
}

function grown(add, type, stage, spin) {
  const c = COLORS[type]
  const bloom = stage === 'bloom'
  const tall = (bloom ? 0.17 : 0.13) * (type === 'lavender' ? 1.2 : 1)
  add(STEM, 0x5aa84a, [0, 0, 0], [0.013, tall, 0.013])
  // two leaves at the foot of the stem
  for (const s of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const a = spin + 0.8 + s
    const long = type === 'tulip' || type === 'lavender'
    add(SPHERE, c.leaf, [Math.cos(a) * 0.045, 0.045, Math.sin(a) * 0.045], [long ? 0.07 : 0.055, 0.01, long ? 0.02 : 0.03], [0, -a, 0.55])
  }
  if (!bloom) add(SPHERE, 0x5aa84a, [0, tall, 0], [0.022, 0.014, 0.022])
  head(add, type, tall + 0.01, bloom ? 1 : 0.3, spin)
}

const cache = new Map()

// The geometry for a cell holding `value` plants of `type` at `stage`.
export function cellGeometry(type, stage, value, wilt = false) {
  const key = `${stage === 'sprout' ? 'sprout' : type}|${stage}|${value}|${wilt}`
  if (cache.has(key)) return cache.get(key)
  const all = []
  const s = SCALE[value] * (stage === 'bloom' ? 1.1 : stage === 'bud' ? 1.08 : 1) * (type === 'sunflower' && stage !== 'sprout' ? 1.15 : 1)
  PIPS[value].forEach(([x, z], k) => {
    const spin = k * 2.4 + value
    const m = new THREE.Matrix4().makeTranslation(x, 0, z)
    m.multiply(new THREE.Matrix4().makeScale(s, s, s))
    // a wilting plant flops over to one side
    if (wilt) m.multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.cos(spin), 0, Math.sin(spin)), 0.75))
    const { parts, add } = builder(m, wilt)
    if (stage === 'sprout') sprout(add, spin)
    else grown(add, type, stage, spin)
    all.push(...parts)
  })
  const geometry = merge(all)
  geometry.computeBoundingSphere()
  cache.set(key, geometry)
  return geometry
}
