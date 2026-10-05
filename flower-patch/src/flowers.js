import * as THREE from 'three'
import { part, merge } from './look.js'

// The plants in a cell, baked into one geometry. A cell with seed N holds N plants
// laid out like the pips on a die, so the number always reads at a glance, and
// grows through three stages:
//   sprout  a chubby green bud, the same for every bed
//   bud     the bed is complete: it grows through a fat bud into an open flower
//   bloom   the garden is solved: every flower grows bigger still
// A wilting cell breaks a rule: its plants droop (sprouts slump) and turn straw coloured.

const SPHERE = new THREE.SphereGeometry(1, 8, 6)
const BALL = new THREE.SphereGeometry(1, 6, 4)
const ROUND = new THREE.SphereGeometry(1, 16, 12)
const STEM = new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0)
// petals and centres are smooth and round
const PETAL = new THREE.SphereGeometry(1, 10, 7)

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

const SPROUT = 0x7ad85c
const SPROUT_LIGHT = 0xbdf28a
const SPROUT_LEAF = 0x5fc24a
const FACE = 0x3a2e3e
const CHEEK = 0xff9fb2
const MOUND = 0x5e3a24
const EARTH = 0x7a4e33
const SOIL_RING = new THREE.TorusGeometry(1, 0.42, 8, 18).rotateX(Math.PI / 2)
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
        const fx = Math.cos(a) * 0.04, fz = Math.sin(a) * 0.04, fy = y + (f === 0 ? 0.012 : 0)
        if (open < 0.5) { add(PETAL, 0xffb3d1, [fx, fy + 0.01, fz], [0.032, 0.03, 0.032]); continue }
        for (let k = 0; k < 5; k++) {
          const pa = a + (k / 5) * Math.PI * 2
          add(PETAL, c.petal, [fx + Math.cos(pa) * 0.027, fy, fz + Math.sin(pa) * 0.027], [0.027, 0.014, 0.027])
        }
        add(PETAL, c.inner, [fx, fy + 0.009, fz], [0.014, 0.011, 0.014])
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

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k) }
// Blends two colours round the colour wheel the short way, staying bright and
// a touch lighter in the middle, so green warms into pink through fresh
// yellows and peaches instead of muddy browns.
const mix = (a, b, k) => {
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
// how high the middle of a sprout's body sits: low, so it is half in the soil
const SEAT = 0.034

// A plant on its way from sprout to bud, g from 0 to 1. It is one creature the
// whole way, every part carried continuously from one shape to the other:
//
//   g = 0  a chubby little seedling with a sleepy smile: a round green body,
//          two tiny leaves tucked up on top, dot eyes and rosy cheeks, on a
//          mound of soil. From above it reads as one round pip.
//   g = 1  a plump, round bud in the bed's colour, three petals hugging it, in
//          a green cup on a rosette of round leaves.
//
// On the way the body swells, rises and blushes into the flower's colour; its
// two leaves slide down and wrap round it as the outer petals (a third one
// joins them); it closes its eyes; the mound sinks away as leaves unfurl from
// the soil and a green cup grows under the bud. Lavender and forget-me-nots
// sprout a cluster of little beads instead.
function morph(add, type, spin, g, wilt) {
  const c = COLORS[type] ?? COLORS.daisy
  const cluster = CLUSTER.has(type)
  const wrap = new THREE.Color(c.petal).lerp(new THREE.Color(0xffffff), 0.25).getHex()
  const beadColors = type === 'lavender' ? [c.petal, 0xbb9af2] : [0xffb3d1, c.petal]
  const blush = smooth(0.15, 0.85, g)
  const L = (a, b) => lerp(a, b, g)
  // the soil mound sinks away
  // the sprout sits half buried, a little ring of loose earth hugging it; the
  // earth settles back as the bud rises out of it
  const mound = 1 - smooth(0, 0.7, g)
  if (mound > 0.01) {
    add(SPHERE, MOUND, [0, -0.004, 0], [0.11 * mound, 0.02, 0.11 * mound])
    add(SOIL_RING, EARTH, [0, 0.008, 0], [0.095 * mound, 0.07 * mound, 0.095 * mound])
    for (let k = 0; k < 4; k++) {
      const a = spin + k * 1.7
      add(BALL, k % 2 ? EARTH : MOUND, [Math.cos(a) * 0.115 * mound, 0.004, Math.sin(a) * 0.11 * mound], [0.016 * mound, 0.01 * mound, 0.014 * mound])
    }
  }
  // leaves unfurl from the soil
  const unfurl = smooth(0.1, 0.9, g)
  if (unfurl > 0.01) {
    for (let k = 0; k < 3; k++) {
      const a = spin + (k / 3) * Math.PI * 2
      const r = lerp(0.02, 0.035 * K, unfurl)
      add(PETAL, c.leaf, [Math.cos(a) * r, 0.014 * K, Math.sin(a) * r], [0.042 * K * unfurl, 0.014 * K, 0.03 * K * unfurl], [0, -a, lerp(1.2, 0.25, unfurl)])
    }
  }
  // the body becomes the bud, or the middle bead of a cluster
  const body = cluster ? { y: 0.11 * K, r: [0.038 * K, 0.036 * K, 0.038 * K], color: beadColors[0] } : { y: 0.092 * K, r: [0.072 * K, 0.074 * K, 0.072 * K], color: c.petal }
  const by = L(SEAT, body.y)
  add(ROUND, mix(SPROUT, body.color, blush), [0, by, 0], [L(0.098, body.r[0]), L(0.08, body.r[1]), L(0.092, body.r[2])])
  const belly = 1 - smooth(0, 0.6, g)
  if (belly > 0.01) add(ROUND, mix(SPROUT_LIGHT, body.color, blush), [0, lerp(SEAT - 0.004, by, g), 0.042 * belly], [0.07 * belly, 0.056 * belly, 0.052 * belly])
  // a green cup grows under the bud
  if (!cluster) {
    const cup = smooth(0.35, 1, g)
    for (let k = 0; k < 5 && cup > 0.01; k++) {
      const a = spin + (k / 5) * Math.PI * 2
      add(PETAL, 0x62b552, [Math.cos(a) * 0.04 * K * cup, lerp(by, 0.05 * K, cup), Math.sin(a) * 0.04 * K * cup], [0.036 * K * cup, 0.014 * K * cup, 0.03 * K * cup], [0, -a, 0.85])
    }
  }
  // the two top leaves slide down and wrap the bud; more join them
  const wraps = cluster ? 5 : 3
  for (let k = 0; k < wraps; k++) {
    const a = cluster ? spin + (k / 5) * Math.PI * 2 : spin + 0.5 + (k / 3) * Math.PI * 2
    const to = cluster
      ? { p: [Math.cos(a) * 0.036 * K, 0.075 * K, Math.sin(a) * 0.036 * K], s: [0.034 * K, 0.032 * K, 0.034 * K], tilt: 0, color: beadColors[k % 2] }
      : { p: [Math.cos(a) * 0.05 * K, 0.08 * K, Math.sin(a) * 0.05 * K], s: [0.04 * K, 0.06 * K, 0.045 * K], tilt: 0.18, color: wrap }
    if (k < 2) {
      const sa = k === 0 ? 0.25 : Math.PI - 0.25
      const from = { p: [Math.cos(sa) * 0.032, SEAT + 0.102, -Math.sin(sa) * 0.01], s: [0.04, 0.014, 0.026], tilt: 0.55, color: k === 0 ? SPROUT_LIGHT : SPROUT_LEAF }
      const turn = lerp(-sa, -a, smooth(0, 0.7, g))
      add(SPHERE, mix(from.color, to.color, blush), from.p.map((v, i) => lerp(v, to.p[i], g)), from.s.map((v, i) => lerp(v, to.s[i], g)), [0, turn, lerp(from.tilt, to.tilt, g)])
    } else {
      const grow = smooth(0.3, 1, g)
      if (grow > 0.01) add(PETAL, mix(SPROUT_LEAF, to.color, blush), to.p.map((v, i) => lerp(i === 1 ? by : 0, v, grow)), to.s.map((v) => v * grow), [0, -a, to.tilt])
    }
  }
  // the little stem on top draws in, and a curl (or a peek of the flower's middle) appears
  const stem = 1 - smooth(0, 0.5, g)
  if (stem > 0.01) add(STEM, SPROUT, [0, L(SEAT + 0.066, body.y + body.r[1]), 0], [0.008 * stem, 0.03 * stem, 0.008 * stem])
  if (!cluster) {
    const tip = smooth(0.5, 1, g)
    const color = { daisy: 0xffd34d, sunflower: 0x9a6a3a, buttercup: 0xffaa33 }[type] ?? wrap
    if (tip > 0.01) add(PETAL, color, [0, 0.164 * K, 0], [0.02 * K * tip, 0.014 * K * tip, 0.02 * K * tip])
  }
  // the face: big shiny eyes, rosy cheeks and a smile, high on the front so the
  // tilted camera sees it. It closes its eyes as it changes, and the face fades.
  const face = (color, position, scale, rotation) => add(BALL, color, position, scale, rotation, true)
  const lift = by - 0.074 // the face was drawn for a body centred at 0.074
  const open = 1 - smooth(0, 0.3, g)
  const fade = 1 - smooth(0.15, 0.45, g)
  if (fade <= 0.01) return
  for (const s of [-1, 1]) {
    if (wilt || open < 0.35) face(FACE, [s * 0.032, 0.101 + lift, 0.081], [0.017 * fade, 0.005, 0.006], [-0.5, 0, 0])
    else {
      face(FACE, [s * 0.032, 0.103 + lift, 0.079], [0.016, 0.02 * open, 0.009], [-0.5, 0, 0])
      face(0xffffff, [s * 0.032 + 0.006, 0.112 + lift, 0.084], [0.0055 * open, 0.0055 * open, 0.003])
    }
    face(CHEEK, [s * 0.06, 0.085 + lift, 0.074], [0.02 * fade, 0.011 * fade, 0.007], [-0.4, s * 0.55, 0])
  }
  face(FACE, [0, 0.086 + lift, 0.09], [0.009 * fade, 0.0045 * fade, 0.004], [-0.5, 0, 0])
}

// A bud opening into its flower, b from 0 (exactly the finished bud of morph)
// to 1 (in full bloom). A stem lifts the bud as the ball of wrapped petals
// shrinks and its outer petals fold back and fade, while the flower's own
// petals grow and unfurl from inside it. The green cup slips down to hold the
// flower, and the leaves stay round its foot.
function bloom(add, type, spin, b, size, k) {
  const c = COLORS[type] ?? COLORS.daisy
  const cluster = CLUSTER.has(type)
  const wrap = new THREE.Color(c.petal).lerp(new THREE.Color(0xffffff), 0.25).getHex()
  const beadColors = type === 'lavender' ? [c.petal, 0xbb9af2] : [0xffb3d1, c.petal]
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
    const from = k < 2 ? (k === 0 ? SPROUT_LIGHT : SPROUT_LEAF) : SPROUT_LEAF
    add(k < 2 ? SPHERE : PETAL, mix(from, to.color, 1), [to.p[0] * out, to.p[1] + up, to.p[2] * out], to.s.map((v) => v * fold), [0, -a, lerp(to.tilt, -0.5, open)])
  }
  if (!cluster) {
    const tip = 1 - smooth(0, 0.3, b)
    const color = { daisy: 0xffd34d, sunflower: 0x9a6a3a, buttercup: 0xffaa33 }[type] ?? wrap
    if (tip > 0.01) add(PETAL, color, [0, 0.164 * K + up, 0], [0.02 * K * tip, 0.014 * K * tip, 0.02 * K * tip])
  }
  // the flower grows and unfurls from inside, big enough to fill its plot
  const h = size / (GROWN * spread(type)) * smooth(0, 0.75, b)
  if (h < 0.002) return
  const headParts = []
  const into = (geometry, color, position, scale, rotation) => headParts.push([geometry, color, position, scale, rotation])
  // a little green cup holds the flower
  into(PETAL, 0x62b552, [0, -0.004, 0], [0.026, 0.016, 0.026])
  head(into, type, 0.01, open, spin)
  for (const [geometry, color, [x, y, z], [sx, sy, sz], rotation] of headParts) {
    add(geometry, color, [x * h, top + y * h, z * h], [sx * h, sy * h, sz * h], rotation)
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
export function cellGeometry(type, stage, value, wilt = false, step = stage === 'bud' ? GROW_STEPS : STEPS) {
  if (stage === 'sprout') step = 0
  const key = `${stage === 'sprout' ? 'sprout' : type}|${stage}|${value}|${wilt}|${step}`
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
    if (stage === 'bloom') bloom(add, type, spin, 1, lerp(OPEN, BLOOM[value], smooth(0, 1, step / STEPS)), k)
    else if (opening > 0) bloom(add, type, spin, opening, OPEN, k)
    else morph(add, type, spin, toBud, wilt)
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
