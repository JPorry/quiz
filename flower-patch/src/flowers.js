import * as THREE from 'three'
import { part, merge } from './look.js'

// The plants in a cell, baked into one geometry. A cell with seed N holds N plants
// laid out like the pips on a die, so the number always reads at a glance, and
// grows through three stages:
//   sprout  a chubby green bud, the same for every bed
//   bud     the bed is complete: taller, with a half-open head in its flower
//   bloom   the garden is solved: the flower opens fully
// A wilting cell breaks a rule: its plants droop (sprouts slump) and turn straw coloured.

const SPHERE = new THREE.SphereGeometry(1, 8, 6)
const BALL = new THREE.SphereGeometry(1, 6, 4)
const ROUND = new THREE.SphereGeometry(1, 16, 12)
const STEM = new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0)
// petals and centres are smooth and round
const PETAL = new THREE.SphereGeometry(1, 10, 7)

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
  tulip: { petal: 0xff6f86, inner: 0xff9aab, leaf: 0x6fbf6a, carpet: '#ff8fa0' },
  marigold: { petal: 0xff9a3c, inner: 0xffcf5a, leaf: 0x62b552, carpet: '#ffb066' },
  buttercup: { petal: 0xffd447, inner: 0xffaa33, leaf: 0x6abb55, carpet: '#ffe27a' },
  daisy: { petal: 0xfffbf2, inner: 0xffc23d, leaf: 0x66b856, carpet: '#fffbf2' },
  forgetmenot: { petal: 0x93cdff, inner: 0xffe066, leaf: 0x6dba5c, carpet: '#aed8ff' },
  cornflower: { petal: 0x6f8fff, inner: 0x3b3f9e, leaf: 0x7ab38a, carpet: '#8aa3ff' },
  lavender: { petal: 0xa784e8, inner: 0xd8c6f7, leaf: 0x8ab87e, carpet: '#bfa2f0' },
  pansy: { petal: 0x8f5ad9, inner: 0xffd34d, leaf: 0x62b552, carpet: '#a982e6' },
  rose: { petal: 0xff86b8, inner: 0xf2639c, leaf: 0x58a852, carpet: '#ffa3c9' },
  sunflower: { petal: 0xffc53d, inner: 0x7a4a26, leaf: 0x62b552, carpet: '#ffd45c' },
}

const SPROUT = 0x7ad85c
const SPROUT_LIGHT = 0xbdf28a
const SPROUT_LEAF = 0x5fc24a
const FACE = 0x3a2e3e
const CHEEK = 0xff9fb2
const MOUND = 0x5e3a24
const STRAW = new THREE.Color(0xc9a45c)

// A part placed in plant space, then carried to its spot in the cell.
// Faces go on their own, without the sticker outline that would ring every dot.
function builder(matrix, wilt) {
  const parts = []
  const flats = []
  const add = (geometry, color, position, scale, rotation, flat = false) => {
    const c = new THREE.Color(color)
    if (wilt && color !== FACE) c.lerp(STRAW, 0.6)
    const g = part(geometry, c, position, scale, rotation)
    g.applyMatrix4(matrix)
    ;(flat ? flats : parts).push(g)
  }
  return { parts, flats, add }
}

// A petal pointing out at angle a, its base `r` from the middle, tilted up by `tilt`.
function petal(add, color, a, r, y, [len, thick, wid], tilt, geometry = SPHERE) {
  const reach = r + Math.cos(tilt) * len
  add(geometry, color, [Math.cos(a) * reach, y + Math.sin(tilt) * len, Math.sin(a) * reach], [len, thick, wid], [0, -a, tilt])
}

const lerp = (a, b, k) => a + (b - a) * k

// A flower head sitting at height y, half open at `open` 0 and fully at 1.
// Every flower is built from plump, rounded petals and big soft centres, so
// the garden looks like a box of sweets: no spikes, no thin slivers.
function head(add, type, y, open, spin) {
  const c = COLORS[type]
  const ring = (n, color, r, size, closed, opened, at = y, offset = 0) => {
    for (let k = 0; k < n; k++) petal(add, color, spin + offset + (k / n) * Math.PI * 2, r, at, size, lerp(closed, opened, open), PETAL)
  }
  const dome = (color, at, r, flat = 0.6) => add(PETAL, color, [0, at, 0], [r, r * flat, r])
  switch (type) {
    case 'tulip':
      // a plump cup that never quite opens: three petals outside, three in
      ring(3, c.petal, 0.006, [0.06, 0.05, 0.05], 1.42, 1.0)
      ring(3, c.inner, 0.004, [0.055, 0.045, 0.045], 1.5, 1.15, y + 0.006, Math.PI / 3)
      if (open > 0.5) dome(0xffd36e, y + 0.03, 0.018)
      break
    case 'marigold':
      // a puffy pompom of round petals
      ring(9, c.petal, 0.02, [0.04, 0.032, 0.036], 1.2, 0.28)
      ring(7, 0xffb347, 0.012, [0.034, 0.03, 0.032], 1.35, 0.7, y + 0.016, 0.35)
      dome(c.inner, y + 0.03, 0.03, 0.8)
      break
    case 'buttercup':
      // five round, glossy cupped petals around a big soft eye
      ring(5, c.petal, 0.006, [0.05, 0.028, 0.05], 1.3, 0.55)
      dome(c.inner, y + 0.012, 0.026)
      dome(0xfff6c8, y + 0.022, 0.012)
      break
    case 'daisy':
      // eight chubby white petals and a big golden button
      ring(8, open > 0.4 ? c.petal : 0xe9f5dc, 0.022, [0.055, 0.018, 0.034], 1.3, 0.12)
      dome(c.inner, y + 0.012, 0.036, 0.7)
      dome(0xffe27a, y + 0.024, 0.02)
      break
    case 'forgetmenot':
      // a posy of three round florets, pink in bud
      for (let f = 0; f < 3; f++) {
        const a = spin + (f / 3) * Math.PI * 2
        const fx = Math.cos(a) * 0.05, fz = Math.sin(a) * 0.05, fy = y + (f === 0 ? 0.012 : 0)
        if (open < 0.5) { add(PETAL, 0xffb3d1, [fx, fy + 0.01, fz], [0.032, 0.03, 0.032]); continue }
        for (let k = 0; k < 5; k++) {
          const pa = a + (k / 5) * Math.PI * 2
          add(PETAL, c.petal, [fx + Math.cos(pa) * 0.026, fy, fz + Math.sin(pa) * 0.026], [0.024, 0.012, 0.024])
        }
        add(PETAL, c.inner, [fx, fy + 0.008, fz], [0.012, 0.01, 0.012])
      }
      break
    case 'cornflower':
      // six round blue petals with a white halo and a deep blue middle
      ring(6, c.petal, 0.012, [0.055, 0.026, 0.048], 1.3, 0.3)
      ring(6, 0xdfe7ff, 0.006, [0.026, 0.02, 0.024], 1.4, 0.55, y + 0.01, Math.PI / 6)
      dome(c.inner, y + 0.018, 0.022, 0.8)
      break
    case 'lavender': {
      // a plump purple puff of little beads, pale until it opens
      const size = lerp(0.8, 1.15, open)
      const color = open < 0.5 ? c.inner : c.petal
      for (let k = 0; k < 7; k++) {
        const a = spin + (k / 7) * Math.PI * 2
        add(PETAL, k % 2 ? color : 0xbb9af2, [Math.cos(a) * 0.034 * size, y + 0.012, Math.sin(a) * 0.034 * size], [0.024 * size, 0.022 * size, 0.024 * size])
      }
      add(PETAL, 0x9670dc, [0, y + 0.03 * size, 0], [0.03 * size, 0.028 * size, 0.03 * size])
      add(PETAL, 0xd8c6f7, [-0.008, y + 0.05 * size, -0.006], [0.01, 0.008, 0.01])
      break
    }
    case 'pansy':
      // five big round petals overlapping, with a golden eye
      ring(2, 0xb48cf0, 0.008, [0.058, 0.02, 0.06], 1.3, 0.35, y + 0.004, -Math.PI / 2 - 0.5)
      ring(3, c.petal, 0.008, [0.056, 0.022, 0.058], 1.3, 0.3, y + 0.01, Math.PI / 2 - 2.1)
      if (open > 0.5) add(PETAL, 0x5a3596, [0, y + 0.02, 0.01], [0.026, 0.006, 0.026])
      dome(c.inner, y + 0.024, 0.014)
      break
    case 'rose':
      // a round cabbage rose: rings of cupped petals around a tight swirl
      ring(5, c.petal, 0.022, [0.05, 0.036, 0.048], 1.25, 0.6)
      ring(4, 0xffa8cf, 0.012, [0.04, 0.034, 0.04], 1.45, 1.05, y + 0.014, 0.6)
      dome(c.inner, y + 0.032, 0.026, 0.9)
      break
    case 'sunflower':
      // ten round golden petals around a big brown button
      ring(10, c.petal, 0.04, [0.06, 0.016, 0.034], 1.3, 0.1)
      dome(c.inner, y + 0.008, 0.06, 0.45)
      dome(0x8a5a2b, y + 0.018, 0.04, 0.45)
      break
  }
}

// A sprout is a chubby little seedling with a sleepy smile: a round green body,
// two tiny leaves tucked up on top, dot eyes and rosy cheeks. The leaves stay
// small and close, so from above every seed still reads as one round pip.
function sprout(add, spin, wilt) {
  add(SPHERE, MOUND, [0, 0, 0], [0.118, 0.028, 0.118])
  // a soft, mochi-round body
  add(ROUND, SPROUT, [0, 0.074, 0], [0.098, 0.08, 0.092])
  // a paler belly facing the camera
  add(ROUND, SPROUT_LIGHT, [0, 0.07, 0.042], [0.07, 0.056, 0.052])
  add(STEM, SPROUT, [0, 0.14, 0], [0.008, 0.03, 0.008])
  for (const s of [-1, 1]) {
    const a = s > 0 ? 0.25 : Math.PI - 0.25
    add(SPHERE, s > 0 ? SPROUT_LIGHT : SPROUT_LEAF, [Math.cos(a) * 0.032, 0.176, -Math.sin(a) * 0.01], [0.04, 0.014, 0.026], [0, -a, 0.55])
  }
  // the face: big shiny eyes, rosy cheeks and a little smile, high on the
  // front so the tilted camera sees it
  const face = (color, position, scale, rotation) => add(BALL, color, position, scale, rotation, true)
  for (const s of [-1, 1]) {
    if (wilt) face(FACE, [s * 0.032, 0.1, 0.082], [0.017, 0.005, 0.006], [-0.5, 0, 0])
    else {
      face(FACE, [s * 0.032, 0.103, 0.079], [0.016, 0.02, 0.009], [-0.5, 0, 0])
      face(0xffffff, [s * 0.032 + 0.006, 0.112, 0.084], [0.0055, 0.0055, 0.003])
    }
    face(CHEEK, [s * 0.06, 0.085, 0.074], [0.02, 0.011, 0.007], [-0.4, s * 0.55, 0])
  }
  face(FACE, [0, 0.086, 0.09], [0.009, 0.0045, 0.004], [-0.5, 0, 0])
}

const ease = (k) => 1 - (1 - k) ** 2

// A grown plant. For a bud, t is how far it has grown from a seedling (0) to a
// full bud (1). For a bloom, t is how far the bud has opened.
function grown(add, type, stage, spin, t) {
  const c = COLORS[type]
  const bloom = stage === 'bloom'
  const lav = type === 'lavender' ? 1.2 : 1
  const g = bloom ? 1 : ease(t)
  const tall = (bloom ? lerp(0.12, 0.15, ease(t)) : lerp(0.03, 0.12, g)) * lav
  add(SPHERE, MOUND, [0, 0, 0], [0.09 * (1 - g * 0.6), 0.025, 0.09 * (1 - g * 0.6)])
  add(STEM, 0x62b552, [0, 0, 0], [0.016, tall, 0.016])
  // two round, plump leaves at the foot of the stem, unrolling as it grows
  for (const s of [0, Math.PI]) {
    const a = spin + 0.8 + s
    const l = lerp(0.4, 1, g)
    add(PETAL, c.leaf, [Math.cos(a) * 0.05 * l, 0.04 * l, Math.sin(a) * 0.05 * l], [0.055 * l, 0.016, 0.036 * l], [0, -a, lerp(1.1, 0.5, g)])
  }
  const open = bloom ? lerp(0.3, 1, ease(t)) : 0.3
  // the head swells as the bud grows, from a green nub to its colour
  const h = bloom ? 1 : lerp(0.25, 1, g)
  const headParts = []
  const into = (geometry, color, position, scale, rotation) => headParts.push([geometry, color, position, scale, rotation])
  // a little green cup holds the flower
  into(PETAL, 0x62b552, [0, -0.004, 0], [0.026, 0.016, 0.026])
  head(into, type, 0.01, open, spin)
  const tint = new THREE.Color()
  for (const [geometry, color, [x, y, z], [sx, sy, sz], rotation] of headParts) {
    // a young bud is still mostly green
    tint.set(color).lerp(new THREE.Color(0x7cc95a), bloom ? 0 : (1 - g) * 0.8)
    add(geometry, tint.getHex(), [x * h, tall + y * h, z * h], [sx * h, sy * h, sz * h], rotation)
  }
}

// How many in-between shapes a plant passes through as it grows or opens.
export const STEPS = 8

const cache = new Map()

// The shapes for a cell holding `value` plants of `type` at `stage`. `step`
// (0 to STEPS) is how far a bud has grown or a bloom has opened.
export function cellGeometry(type, stage, value, wilt = false, step = STEPS) {
  if (stage === 'sprout') step = STEPS
  const key = `${stage === 'sprout' ? 'sprout' : type}|${stage}|${value}|${wilt}|${step}`
  if (cache.has(key)) return cache.get(key)
  const t = step / STEPS
  const all = []
  const flat = []
  const grow = stage === 'bloom' ? lerp(1.08, 1.1, t) : stage === 'bud' ? 1.08 : 1
  const s = SCALE[value] * grow * (type === 'sunflower' && stage !== 'sprout' ? 1.15 : 1)
  PIPS[value].forEach(([x, z], k) => {
    const spin = k * 2.4 + value
    const m = new THREE.Matrix4().makeTranslation(x, 0, z)
    m.multiply(new THREE.Matrix4().makeScale(s, s, s))
    // a wilting sprout slumps; a wilting plant flops over to one side
    if (wilt && stage === 'sprout') m.multiply(new THREE.Matrix4().makeScale(1.1, 0.72, 1.1))
    else if (wilt) m.multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.cos(spin), 0, Math.sin(spin)), 0.75))
    const { parts, flats, add } = builder(m, wilt)
    if (stage === 'sprout') sprout(add, spin, wilt)
    else grown(add, type, stage, spin, t)
    all.push(...parts)
    flat.push(...flats)
  })
  // body is outlined; face is drawn without one
  const shapes = { body: merge(all), face: flat.length ? merge(flat) : null }
  shapes.body.computeBoundingSphere()
  shapes.face?.computeBoundingSphere()
  cache.set(key, shapes)
  return shapes
}
