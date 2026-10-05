import * as THREE from 'three'
import { part, merge } from './look.js'

// The plants in a cell, baked into one geometry. A cell with seed N holds N plants
// laid out like the pips on a die, so the number always reads at a glance, and
// grows through three stages:
//   sprout  a tiny seedling with a rosette of round leaves, the same for every bed
//   bud     the bed is complete: it grows through a fat bud into an open flower
//   bloom   the garden is solved: every flower grows bigger still
// A wilting cell breaks a rule: its plants droop (sprouts slump) and turn straw coloured.

const SPHERE = new THREE.SphereGeometry(1, 8, 6)
const ROUND = new THREE.SphereGeometry(1, 16, 12)
const STEM = new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0)
// petals and centres are smooth and round
const PETAL = new THREE.SphereGeometry(1, 14, 10)
// An inflated petal, like a little balloon: narrow where it joins the flower,
// swelling to a wide, round, puffy tip. It lies along x, base at -1, tip at 1.
const PUFF = (() => {
  const g = new THREE.SphereGeometry(1, 22, 14)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const t = (p.getX(i) + 1) / 2
    const w = 0.42 + 0.58 * Math.sin(Math.min(1, t / 0.72) * Math.PI / 2)
    p.setZ(i, p.getZ(i) * w)
    p.setY(i, p.getY(i) * (0.62 + 0.38 * w))
  }
  g.computeVertexNormals()
  return g
})()

// Where the plants go in a cell (x, z), like a die's pips.
const D = 0.22
export const PIPS = {
  1: [[0, 0]],
  2: [[-D, -D], [D, D]],
  3: [[-D, -D], [0, 0], [D, D]],
  4: [[-D, -D], [D, -D], [-D, D], [D, D]],
  5: [[-D, -D], [D, -D], [0, 0], [-D, D], [D, D]],
  6: [[-0.2, -0.24], [0.2, -0.24], [-0.2, 0], [0.2, 0], [-0.2, 0.24], [0.2, 0.24]],
}
// Every seed number has its own colour, carried by the sprout's bud tip and
// its little upright leaves, and by the dots on its seed packet. They are far
// apart in hue and in lightness (soft pastels: strawberry, apricot, butter,
// baby blue, lilac, white), so
// no two are easily confused, even for colour-blind players; the die layout
// still tells them apart too.
export const NUM = { 1: 0xff8a9a, 2: 0xff9f55, 3: 0xfff27a, 4: 0x7fc3ff, 5: 0xbc8cff, 6: 0xffffff }
// fewer sprouts grow bigger, so a single one fills its cell like a big pip
const SCALE = { 1: 1.55, 2: 1.3, 3: 1.18, 4: 1.12, 5: 1.02, 6: 0.95 }
// Buds are all one size, whatever their number.
const GROWN = 1.15
// In full bloom the plots no longer matter: each flower head reaches this far
// from its middle (in cell widths), as big as its plot allows and more,
// overlapping its neighbours into one lush carpet.
const BLOOM = { 1: 0.42, 2: 0.34, 3: 0.31, 4: 0.3, 5: 0.28, 6: 0.25 }
// A completed bed's flowers are open but modest: every head reaches this far,
// whatever the plot's number, so the dice faces still read.
const OPEN = 0.165

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

// every kind of plant, sunflowers included
export const FLOWERS_ALL = Object.keys(COLORS)

// A bed's flower sets the plant's shape and leaves; the seed's number sets
// its colour. Every plant of seed N blooms in N's colour (see NUM), whatever
// its kind, with a lighter and a deeper shade of it for the inner petals and a
// golden eye that stands out against it.
const tone = (hex, to, k) => new THREE.Color(hex).lerp(new THREE.Color(to), k).getHex()
// the same hue, a little deeper and richer, never muddy
const shade = (hex, dl) => { const h = new THREE.Color(hex).getHSL({}); return new THREE.Color().setHSL(h.h, Math.min(1, h.s + 0.1), h.l + dl).getHex() }
const palettes = new Map()
export function palette(type, value) {
  const key = `${type}|${value}`
  if (!palettes.has(key)) {
    const base = COLORS[type] ?? COLORS.daisy
    const petal = NUM[value] ?? NUM[1]
    const pale = value === 6
    palettes.set(key, {
      petal,
      leaf: base.leaf,
      light: pale ? 0xf4f1ff : tone(petal, 0xffffff, 0.32),
      dark: pale ? 0xd6cfe8 : shade(petal, -0.14),
      // the eye: gold, or deeper amber where the petals are yellow or white
      eye: value === 3 || value === 6 ? 0xffbb55 : value === 2 ? 0xffec8a : 0xffe07a,
      eyeDeep: value === 3 || value === 6 ? 0xf5a03c : 0xf7c95f,
      carpet: '#' + tone(petal, 0xffffff, pale ? 0 : 0.1).toString(16).padStart(6, '0'),
    })
  }
  return palettes.get(key)
}

const SPROUT = 0x8fe06a
const SPROUT_LIGHT = 0xc8f59a
const SPROUT_LEAF = 0x68c950
const SPROUT_STEM = 0x7acb58
// crumbs of earth match the soil's own colour, so they read as part of it
const EARTH = 0x8a5b3a
const EARTH_LIGHT = 0x9c6a45
const CRUMB = new THREE.IcosahedronGeometry(1, 1)
const STRAW = new THREE.Color(0xc9a45c)

// A part placed in plant space, then carried to its spot in the cell.
// Faces go on their own, without the sticker outline that would ring every dot.
function builder(matrix, wilt) {
  const parts = []
  const flats = []
  const add = (geometry, color, position, scale, rotation, flat = false) => {
    const c = new THREE.Color(color)
    if (wilt) c.lerp(STRAW, 0.6)
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
// Every flower is a soft, inflated toy, like modelling clay: petals are
// puffy balloons, narrow at the base and round at the tip, nearly as thick as
// they are wide; centres are big soft domes, some ringed with little beads.
// No spikes, no thin slivers, no faces.
function head(add, type, y, open, spin, value = 1) {
  const c = palette(type, value)
  // n balloon petals of length len and width wid, puff times as thick as wide
  const ring = (n, color, r, [len, wid], closed, opened, at = y, offset = 0, puff = 0.6) => {
    for (let k = 0; k < n; k++) petal(add, color, spin + offset + (k / n) * Math.PI * 2, r, at, [len, wid * puff, wid], lerp(closed, opened, open), PUFF)
  }
  const dome = (color, at, r, flat = 0.6) => add(ROUND, color, [0, at, 0], [r, r * flat, r])
  // a ring of little round beads around a centre
  const beads = (color, at, r, size, n) => {
    for (let k = 0; k < n; k++) {
      const a = spin + (k / n) * Math.PI * 2
      add(ROUND, color, [Math.cos(a) * r, at, Math.sin(a) * r], [size, size * 0.85, size])
    }
  }
  switch (type) {
    case 'tulip':
      // a tall, plump cup of balloon petals, two rings, standing up
      ring(5, c.petal, 0.006, [0.06, 0.048], 1.5, 1.15, y, 0, 0.66)
      ring(4, c.light, 0.002, [0.05, 0.042], 1.58, 1.3, y + 0.006, Math.PI / 5, 0.66)
      if (open > 0.5) dome(c.eye, y + 0.024, 0.016, 0.8)
      break
    case 'marigold':
      // a puffy zinnia: two crowded layers of balloon petals, a soft eye
      ring(10, c.petal, 0.016, [0.05, 0.034], 1.2, 0.2)
      ring(8, c.light, 0.01, [0.038, 0.03], 1.35, 0.55, y + 0.014, 0.3)
      dome(c.eye, y + 0.028, 0.026, 0.75)
      break
    case 'buttercup':
      // five big round balloon petals, a little cupped, and a fat eye
      ring(5, c.petal, 0.008, [0.054, 0.056], 1.2, 0.42, y, 0, 0.56)
      dome(c.eye, y + 0.018, 0.03, 0.75)
      break
    case 'daisy':
      // eight long balloon petals and a domed centre ringed with beads
      ring(8, open > 0.4 ? c.petal : c.light, 0.022, [0.058, 0.038], 1.3, 0.12, y, 0, 0.58)
      dome(c.eye, y + 0.014, 0.03, 0.6)
      beads(c.eyeDeep, y + 0.012, 0.032, 0.009, 12)
      break
    case 'forgetmenot':
      // a posy of three round florets of fat little beads
      for (let f = 0; f < 3; f++) {
        const a = spin + (f / 3) * Math.PI * 2
        const fx = Math.cos(a) * 0.042, fz = Math.sin(a) * 0.042, fy = y + (f === 0 ? 0.014 : 0)
        if (open < 0.5) { add(ROUND, c.light, [fx, fy + 0.012, fz], [0.034, 0.032, 0.034]); continue }
        for (let k = 0; k < 5; k++) {
          const pa = a + (k / 5) * Math.PI * 2
          add(ROUND, c.petal, [fx + Math.cos(pa) * 0.026, fy + 0.004, fz + Math.sin(pa) * 0.026], [0.03, 0.022, 0.03])
        }
        add(ROUND, c.eye, [fx, fy + 0.016, fz], [0.016, 0.013, 0.016])
      }
      break
    case 'cornflower':
      // eight short, round, puffy petals around a fat button, like a sweet
      ring(8, c.petal, 0.016, [0.034, 0.036], 1.2, 0.18, y, 0, 0.72)
      dome(c.eye, y + 0.016, 0.03, 0.75)
      break
    case 'lavender': {
      // a plump puff of round beads, pale until it opens
      const size = lerp(0.8, 1.15, open)
      const color = open < 0.5 ? c.light : c.petal
      for (let k = 0; k < 7; k++) {
        const a = spin + (k / 7) * Math.PI * 2
        add(ROUND, k % 2 ? color : c.light, [Math.cos(a) * 0.034 * size, y + 0.012, Math.sin(a) * 0.034 * size], [0.027 * size, 0.025 * size, 0.027 * size])
      }
      add(ROUND, c.petal, [0, y + 0.032 * size, 0], [0.033 * size, 0.031 * size, 0.033 * size])
      break
    }
    case 'pansy':
      // five big, round, overlapping balloon petals and an eye
      ring(2, c.light, 0.006, [0.06, 0.064], 1.3, 0.35, y + 0.004, -Math.PI / 2 - 0.5, 0.5)
      ring(3, c.petal, 0.006, [0.058, 0.062], 1.3, 0.3, y + 0.012, Math.PI / 2 - 2.1, 0.5)
      dome(c.eye, y + 0.026, 0.018, 0.75)
      break
    case 'rose':
      // a round cup of balloon petals in three rings, closing in the middle
      ring(6, c.petal, 0.016, [0.05, 0.046], 1.25, 0.6, y, 0, 0.66)
      ring(5, c.light, 0.008, [0.042, 0.04], 1.45, 1.05, y + 0.014, 0.6, 0.7)
      ring(3, c.petal, 0.003, [0.032, 0.03], 1.55, 1.35, y + 0.028, 1.1, 0.75)
      break
    case 'sunflower':
      // twelve long balloon petals around a big toasty dome ringed with beads
      ring(12, c.petal, 0.042, [0.058, 0.032], 1.3, 0.1, y, 0, 0.62)
      dome(0xb98256, y + 0.01, 0.05, 0.5)
      beads(0x9c6a44, y + 0.012, 0.05, 0.011, 14)
      break
  }
}

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k) }
// Blends two colours round the colour wheel the short way, staying bright and
// a touch lighter in the middle, so green warms into pink through fresh
// yellows and peaches instead of muddy browns.
const mix = (a, b, k) => {
  if (k >= 1) return new THREE.Color(b)
  const p = new THREE.Color(a).getHSL({}), q = new THREE.Color(b).getHSL({})
  // a white or pale target keeps the green's hue and simply fades to it
  if (q.s < 0.15) q.h = p.h
  let dh = q.h - p.h
  if (dh > 0.5) dh -= 1
  if (dh < -0.5) dh += 1
  const h = (p.h + dh * k + 1) % 1
  const lift = Math.sin(k * Math.PI) * 0.08
  return new THREE.Color().setHSL(h, lerp(p.s, q.s, k), Math.min(0.92, lerp(p.l, q.l, k) + lift))
}
const CLUSTER = new Set(['lavender', 'forgetmenot'])
// buds are drawn this much bigger than the sprout's own units, as chunky as it
const K = 1.8

// A plant on its way from sprout to bud, g from 0 to 1. It is one creature the
// whole way, every part carried continuously from one shape to the other:
//
//   g = 0  a tiny seedling: a rosette of plump round leaves on a short stem.
//   g = 1  a plump, round bud in the bed's colour, three petals hugging it, in
//          a green cup on a rosette of round leaves.
//
// On the way the curled middle leaf swells, rises and ripens into the
// flower's colour, petals grow out of it and wrap round it, and the seedling's
// leaves slide down to become the bud's rosette. Lavender and forget-me-nots
// grow a cluster of little beads instead.
function morph(add, type, spin, g, wilt, fold = 0, value = 1) {
  const tint = NUM[value]
  const c = palette(type, value)
  const cluster = CLUSTER.has(type)
  const wrap = new THREE.Color(c.petal).lerp(new THREE.Color(0xffffff), 0.25).getHex()
  const beadColors = type === 'lavender' ? [c.petal, c.light] : [c.light, c.petal]
  const blush = smooth(0.15, 0.85, g)
  const L = (a, b) => lerp(a, b, g)
  // A few crumbs of earth heaved up round the seedling's foot. They settle
  // back into the soil as the bud rises.
  const heave = 1 - smooth(0, 0.6, g)
  if (heave > 0.01) {
    for (let k = 0; k < 5; k++) {
      const a = spin + k * 1.27
      const d = 0.1 + (k % 2) * 0.014
      const r = (0.028 - (k % 3) * 0.005) * heave
      add(CRUMB, k % 2 ? EARTH : EARTH_LIGHT, [Math.cos(a) * d, -0.004, Math.sin(a) * d * 0.9], [r * 1.3, r * 0.8, r], [0.3, a, 0.2])
    }
  }
  // The seedling: a short, chubby stem with a rosette of four plump, round
  // leaves, two shades of green, and a tiny curled new leaf in the middle.
  // From above the rosette reads as one round pip. A sleepy seedling (fold 1)
  // has its leaves folded up around the middle; they open as it wakes. A
  // wilting one lets them droop.
  // As it grows into a bud, three of its leaves slide down to become the
  // bud's rosette, the fourth tucks away, and the middle swells into the bud.
  // Two big seed leaves sit low and wide; two smaller, paler true leaves stand
  // higher between them, so the seedling looks layered, like a real one.
  const leafAt = (k) => {
    const a = spin + k * Math.PI / 2
    const big = k % 2 === 0
    const reach = lerp(big ? 0.054 : 0.036, 0.016, fold)
    const tilt = wilt ? -0.25 : lerp(big ? 0.22 : 0.62, 1.3, fold)
    const y = (big ? 0.066 : 0.08) + fold * 0.016
    return { a, p: [Math.cos(a) * reach, y, Math.sin(a) * reach], s: big ? [0.06, 0.018, 0.05] : [0.042, 0.015, 0.034], tilt, color: big ? SPROUT_LEAF : SPROUT }
  }
  const unfurl = smooth(0.05, 0.9, g)
  for (let k = 0; k < 3; k++) {
    const from = leafAt(k)
    const a = spin + (k / 3) * Math.PI * 2
    const to = { p: [Math.cos(a) * 0.035 * K, 0.014 * K, Math.sin(a) * 0.035 * K], s: [0.042 * K, 0.014 * K, 0.03 * K], tilt: 0.25 }
    const turn = lerp(-from.a, -a, unfurl)
    add(PETAL, mix(new THREE.Color(from.color).lerp(new THREE.Color(tint), from.color === SPROUT ? 0.55 : 0.12).getHex(), c.leaf, unfurl), from.p.map((v, i) => lerp(v, to.p[i], unfurl)), from.s.map((v, i) => lerp(v, to.s[i], unfurl)), [0, turn, lerp(from.tilt, to.tilt, unfurl)])
  }
  const tuck = 1 - smooth(0, 0.5, g)
  if (tuck > 0.01) {
    const l = leafAt(3)
    add(PETAL, l.color, l.p, l.s.map((v) => v * tuck), [0, -l.a, l.tilt])
    // a soft highlight on each leaf, fading as they change
    for (let k = 0; k < 4; k++) {
      const h = leafAt(k)
      const out = 0.012 * (1 - fold)
      add(PETAL, SPROUT_LIGHT, [h.p[0] + Math.cos(h.a) * out, h.p[1] + 0.01 + Math.sin(h.tilt) * 0.012, h.p[2] + Math.sin(h.a) * out], [0.026 * tuck, 0.008 * tuck, 0.02 * tuck], [0, -h.a, h.tilt])
    }
  }
  // the middle: a tiny curled leaf that swells and ripens into the bud, or into
  // the middle bead of a cluster
  const body = cluster ? { y: 0.11 * K, r: [0.038 * K, 0.036 * K, 0.038 * K], color: beadColors[0] } : { y: 0.092 * K, r: [0.072 * K, 0.074 * K, 0.072 * K], color: c.petal }
  const by = L(0.088 + fold * 0.012, body.y)
  // the bud tip carries the seed's colour
  add(ROUND, mix(tint, body.color, blush), [0, by, 0], [L(0.042, body.r[0]), L(0.05, body.r[1]), L(0.042, body.r[2])])
  // a green cup grows under the bud
  if (!cluster) {
    const cup = smooth(0.35, 1, g)
    for (let k = 0; k < 5 && cup > 0.01; k++) {
      const a = spin + (k / 5) * Math.PI * 2
      add(PETAL, 0x62b552, [Math.cos(a) * 0.04 * K * cup, lerp(by, 0.05 * K, cup), Math.sin(a) * 0.04 * K * cup], [0.036 * K * cup, 0.014 * K * cup, 0.03 * K * cup], [0, -a, 0.85])
    }
  }
  // petals grow out of the middle and wrap round the bud
  const wraps = cluster ? 5 : 3
  const grow = smooth(0.25, 1, g)
  for (let k = 0; k < wraps && grow > 0.01; k++) {
    const a = cluster ? spin + (k / 5) * Math.PI * 2 : spin + 0.5 + (k / 3) * Math.PI * 2
    const to = cluster
      ? { p: [Math.cos(a) * 0.036 * K, 0.075 * K, Math.sin(a) * 0.036 * K], s: [0.034 * K, 0.032 * K, 0.034 * K], tilt: 0, color: beadColors[k % 2] }
      : { p: [Math.cos(a) * 0.05 * K, 0.08 * K, Math.sin(a) * 0.05 * K], s: [0.04 * K, 0.06 * K, 0.045 * K], tilt: 0.18, color: wrap }
    add(PETAL, mix(SPROUT_LEAF, to.color, blush), to.p.map((v, i) => lerp(i === 1 ? by : 0, v, grow)), to.s.map((v) => v * grow), [0, -a, to.tilt])
  }
  // the stem shortens away under the bud
  const stem = 1 - smooth(0, 0.5, g)
  if (stem > 0.01) add(STEM, SPROUT_STEM, [0, -0.02, 0], [0.013 * stem, 0.095 * stem, 0.013 * stem])
  if (!cluster) {
    const tip = smooth(0.5, 1, g)
    const color = { daisy: c.eye, sunflower: 0x9a6a3a, buttercup: c.eye }[type] ?? wrap
    if (tip > 0.01) add(PETAL, color, [0, 0.164 * K, 0], [0.02 * K * tip, 0.014 * K * tip, 0.02 * K * tip])
  }
}

// A bud opening into its flower, b from 0 (exactly the finished bud of morph)
// to 1 (in full bloom). A stem lifts the bud as the ball of wrapped petals
// shrinks and its outer petals fold back and fade, while the flower's own
// petals grow and unfurl from inside it. The green cup slips down to hold the
// flower, and the leaves stay round its foot.
function bloom(add, type, spin, b, size, k, value = 1) {
  const c = palette(type, value)
  const cluster = CLUSTER.has(type)
  const wrap = new THREE.Color(c.petal).lerp(new THREE.Color(0xffffff), 0.25).getHex()
  const beadColors = type === 'lavender' ? [c.petal, c.light] : [c.light, c.petal]
  const lift = smooth(0, 1, b)
  const open = smooth(0.15, 1, b)
  // the leaves, as on the bud
  for (let k = 0; k < 3; k++) {
    const a = spin + (k / 3) * Math.PI * 2
    add(PETAL, c.leaf, [Math.cos(a) * 0.035 * K, 0.014 * K, Math.sin(a) * 0.035 * K], [0.042 * K, 0.014 * K, 0.03 * K], [0, -a, 0.25])
  }
  // the stem rises, carrying everything above it
  const body = cluster ? { y: 0.11 * K, r: [0.038 * K, 0.036 * K, 0.038 * K], color: beadColors[0] } : { y: 0.092 * K, r: [0.072 * K, 0.074 * K, 0.072 * K], color: c.petal }
  // neighbouring flowers stand at slightly different heights so they overlap cleanly
  const tall = (0.15 + (k % 3) * 0.014) * (type === 'lavender' ? 1.2 : 1)
  const top = lerp(body.y, tall, lift)
  const up = top - body.y
  const stem = smooth(0, 0.3, b)
  if (stem > 0.01) add(STEM, 0x62b552, [0, 0, 0], [0.016 * stem, top, 0.016 * stem])
  // the ball shrinks away into the flower's middle
  const ball = 1 - smooth(0, 0.55, b)
  if (ball > 0.01) add(ROUND, mix(SPROUT, body.color, 1), [0, top, 0], body.r.map((v) => v * ball))
  // the cup slips down under the flower
  const sepals = 1 - smooth(0.5, 1, b)
  if (!cluster && sepals > 0.01) {
    for (let k = 0; k < 5; k++) {
      const a = spin + (k / 5) * Math.PI * 2
      add(PETAL, 0x62b552, [Math.cos(a) * 0.04 * K, 0.05 * K + up, Math.sin(a) * 0.04 * K], [0.036 * K * sepals, 0.014 * K * sepals, 0.03 * K * sepals], [0, -a, lerp(0.85, 0.4, open)])
    }
  }
  // the wrapped petals fold back and fade
  const fold = 1 - smooth(0.25, 0.75, b)
  const wraps = cluster ? 5 : 3
  for (let k = 0; k < wraps && fold > 0.01; k++) {
    const a = cluster ? spin + (k / 5) * Math.PI * 2 : spin + 0.5 + (k / 3) * Math.PI * 2
    const to = cluster
      ? { p: [Math.cos(a) * 0.036 * K, 0.075 * K, Math.sin(a) * 0.036 * K], s: [0.034 * K, 0.032 * K, 0.034 * K], tilt: 0, color: beadColors[k % 2] }
      : { p: [Math.cos(a) * 0.05 * K, 0.08 * K, Math.sin(a) * 0.05 * K], s: [0.04 * K, 0.06 * K, 0.045 * K], tilt: 0.18, color: wrap }
    const out = 1 + open * 0.6
    const from = SPROUT_LEAF
    add(PETAL, mix(from, to.color, 1), [to.p[0] * out, to.p[1] + up, to.p[2] * out], to.s.map((v) => v * fold), [0, -a, lerp(to.tilt, -0.5, open)])
  }
  if (!cluster) {
    const tip = 1 - smooth(0, 0.3, b)
    const color = { daisy: c.eye, sunflower: 0x9a6a3a, buttercup: c.eye }[type] ?? wrap
    if (tip > 0.01) add(PETAL, color, [0, 0.164 * K + up, 0], [0.02 * K * tip, 0.014 * K * tip, 0.02 * K * tip])
  }
  // the flower grows and unfurls from inside, big enough to fill its plot
  const h = size / (GROWN * spread(type)) * smooth(0, 0.75, b)
  if (h < 0.002) return
  const headParts = []
  const into = (geometry, color, position, scale, rotation, flat) => headParts.push([geometry, color, position, scale, rotation, flat])
  // a little green cup holds the flower
  into(PETAL, 0x62b552, [0, -0.004, 0], [0.026, 0.016, 0.026])
  head(into, type, 0.01, open, spin, value)
  for (const [geometry, color, [x, y, z], [sx, sy, sz], rotation, flat] of headParts) {
    add(geometry, color, [x * h, top + y * h, z * h], [sx * h, sy * h, sz * h], rotation, flat)
  }
}

// How far a fully open flower of this kind reaches from its middle.
const spreads = new Map()
function spread(type) {
  if (!spreads.has(type)) {
    let r = 0
    head((geometry, color, [x, , z], [sx, , sz]) => { r = Math.max(r, Math.hypot(x, z) + Math.max(sx, sz)) }, type, 0, 1, 0)
    spreads.set(type, r)
  }
  return spreads.get(type)
}

// How many in-between shapes a bud passes through as it opens.
export const STEPS = 16

const cache = new Map()

// How many in-between shapes a sprout passes through on its way to an open
// flower: the first half grows it into a bud, the second half opens the bud.
export const GROW_STEPS = 24

// The shapes for a cell holding `value` plants of `type` at `stage`:
//   sprout  the smiling seedling
//   bud     the bed is complete. `step` (0 to GROW_STEPS) runs from the sprout,
//           through a fat bud, to an open flower; at GROW_STEPS it is in flower.
//   bloom   the garden is solved. `step` (0 to STEPS) grows the open flower
//           bigger still, until the flowers overlap into one carpet.
// Each stage's last shape is the next one's first, so nothing ever jumps.
// `fold` (0 to 1) folds a sprout's leaves up around its middle: it is still
// waking up out of the soil.
export function cellGeometry(type, stage, value, wilt = false, step = stage === 'bud' ? GROW_STEPS : STEPS, fold = 0) {
  fold = stage === 'sprout' ? Math.round(fold * 8) / 8 : 0
  if (stage === 'sprout') step = 0
  const key = `${stage === 'sprout' ? 'sprout' : type}|${stage}|${value}|${wilt}|${step}|${fold}`
  if (cache.has(key)) return cache.get(key)
  const all = []
  const flat = []
  const g = stage === 'bud' ? step / GROW_STEPS : 0
  const toBud = Math.min(1, g * 2), opening = Math.max(0, g * 2 - 1)
  const s = stage === 'bloom' ? GROWN : lerp(SCALE[value], GROWN, toBud)
  PIPS[value].forEach(([x, z], k) => {
    const spin = k * 2.4 + value
    const m = new THREE.Matrix4().makeTranslation(x, 0, z)
    m.multiply(new THREE.Matrix4().makeScale(s, s, s))
    // a wilting sprout slumps; a wilting plant flops over to one side
    if (wilt && stage === 'sprout') m.multiply(new THREE.Matrix4().makeScale(1.1, 0.72, 1.1))
    else if (wilt) m.multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.cos(spin), 0, Math.sin(spin)), 0.75))
    const { parts, flats, add } = builder(m, wilt)
    if (stage === 'bloom') bloom(add, type, spin, 1, lerp(OPEN, BLOOM[value], smooth(0, 1, step / STEPS)), k, value)
    else if (opening > 0) bloom(add, type, spin, opening, OPEN, k, value)
    else morph(add, type, spin, toBud, wilt, fold, value)
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

// How high the tops of a cell's plants reach, so insects land on them rather
// than in them.
const tops = new Map()
export function plantTop(type, stage, value) {
  const key = `${type}|${stage}|${value}`
  if (!tops.has(key)) {
    const g = cellGeometry(type, stage, value).body
    g.computeBoundingBox()
    tops.set(key, g.boundingBox.max.y)
  }
  return tops.get(key)
}
