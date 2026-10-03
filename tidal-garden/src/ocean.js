import { SPLASH_SLOTS } from './waterLife.js'

// Toy-diorama water: flat pigment, a pale shallow rim and a foam lip that hug every shore,
// and a few drifting wave marks out in the open. Lighting and shadows come from three.js.

function terrainValue(terrain, x, z, size) {
  const col = Math.floor(x + size / 2), row = Math.floor(z + size / 2)
  return col >= 0 && row >= 0 && col < size && row < size ? terrain[(row * size + col) * 4] : 0
}

export function terrainIsSolid(terrain, x, z, size = 16) {
  return terrainValue(terrain, x, z, size) > 51
}

// Water cells that no path free of land connects to the rim of the board are lakes.
// Undecided cells might still hold water, so they never seal a lake.
export function findLakes(grid) {
  const size = grid.length
  const open = grid.map((row) => row.map((value) => value !== 1))
  const queue = []
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    if (open[row][col] && (row === 0 || col === 0 || row === size - 1 || col === size - 1)) {
      open[row][col] = false
      queue.push([row, col])
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [row, col] = queue[i]
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = row + dr, c = col + dc
      if (!open[r]?.[c]) continue
      open[r][c] = false
      queue.push([r, c])
    }
  }
  return grid.map((row, r) => row.map((value, c) => value === 0 && open[r][c]))
}

export const RIM = Object.freeze({ extent: 12, resolution: 144, min: -0.15, max: 2.85 })

// Signed distance to a box with rounded corners, centered at (cx, cz).
function boxDistance(x, z, { cx, cz, hx, hz, radius }) {
  const qx = Math.abs(x - cx) - hx + radius, qz = Math.abs(z - cz) - hz + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - radius
}

// The same rounded, merged coastline the land meshes are built from, as boxes per land cell:
// a rounded core, bridges to land neighbors east and south, and a filler where four tiles meet.
function coastBoxes(grid, inset, radius) {
  const half = grid.length / 2
  const land = (row, col) => grid[row]?.[col] === 1
  return grid.map((cells, row) => cells.map((_, col) => {
    const cx = col + 0.5 - half, cz = row + 0.5 - half, core = 0.5 - inset
    // Empty sockets are solid board too, so the water laps against their rims.
    if (grid[row][col] === null) return [{ cx, cz, hx: 0.5, hz: 0.5, radius: 0.14 }]
    if (!land(row, col)) return []
    const boxes = [{ cx, cz, hx: core, hz: core, radius }]
    if (land(row, col + 1)) boxes.push({ cx: cx + 0.5, cz, hx: 0.5, hz: core, radius: 0 })
    if (land(row + 1, col)) boxes.push({ cx, cz: cz + 0.5, hx: core, hz: 0.5, radius: 0 })
    if (land(row, col + 1) && land(row + 1, col) && land(row + 1, col + 1)) boxes.push({ cx: cx + 0.5, cz: cz + 0.5, hx: 0.5, hz: 0.5, radius: 0 })
    return boxes
  }))
}

// Red: distance from each point of water to the nearest land shore, in tiles.
// Green: whether the point lies in an enclosed lake. Blue: an empty socket, where no water is poured yet.
// Alpha: the garden's starting water, which runs deep and dark.
export function createRimField(grid, { inset = 0.06, radius = 0.24 } = {}, clues = null) {
  const half = grid.length / 2
  const { extent, resolution, min, max } = RIM
  const lakes = findLakes(grid)
  const boxes = coastBoxes(grid, inset, radius)
  const data = new Uint8Array(resolution * resolution * 4)
  for (let row = 0; row < resolution; row++) for (let col = 0; col < resolution; col++) {
    const x = (col + 0.5) / resolution * extent - extent / 2
    const z = (row + 0.5) / resolution * extent - extent / 2
    const c0 = Math.floor(x + half), r0 = Math.floor(z + half)
    let best = max
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      for (const box of boxes[r]?.[c] ?? []) best = Math.min(best, boxDistance(x, z, box))
    }
    const index = (row * resolution + col) * 4
    data[index] = Math.round((Math.min(max, Math.max(min, best)) - min) / (max - min) * 255)
    data[index + 1] = lakes[r0]?.[c0] ? 255 : 0
    data[index + 2] = grid[r0]?.[c0] === null ? 255 : 0
    data[index + 3] = clues?.[r0]?.[c0] === 0 ? 255 : 0
  }
  return data
}

const srgb = (hex) => `pow(vec3(${[16, 8, 0].map((shift) => ((hex >> shift & 255) / 255).toFixed(3)).join(', ')}), vec3(2.2))`

export const WATER_COLORS = Object.freeze({ deep: 0x35b3c4, shallow: 0x62d0cf, lake: 0x5cc7b9, mark: 0xa6ecec, foam: 0xf7fcf9, flash: 0xc8fbf5, ancient: 0x1c5f86, ancientShallow: 0x2f7f9c })

export const waterVertexHead = `varying vec2 vXZ;`
export const waterVertexBody = `vXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`

export const waterFragmentHead = `
  varying vec2 vXZ;
  uniform float uTime;
  uniform sampler2D uRim;
  uniform vec4 uSplashes[${SPLASH_SLOTS}];
  uniform vec2 uWindShift;
  uniform float uGust;
  float waterHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float waterNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), u.x), mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + 1.0), u.x), u.y);
  }
`

export const waterFragmentColor = `
  vec4 rimField = texture2D(uRim, vXZ / ${RIM.extent.toFixed(1)} + 0.5);
  if (rimField.b > 0.5) discard;
  float shore = rimField.r * ${(RIM.max - RIM.min).toFixed(2)} + ${RIM.min.toFixed(2)};
  float lake = rimField.g;
  float wobble = (waterNoise(vXZ * 3.1 + uTime * 0.12) - 0.5) * 0.06;
  vec3 water = mix(${srgb(WATER_COLORS.deep)}, ${srgb(WATER_COLORS.lake)}, lake * 0.55);
  water = mix(${srgb(WATER_COLORS.shallow)}, water, smoothstep(0.12, 0.24, shore + wobble));
  // The garden's starting water is old and deep: the whole tile runs a dark blue.
  float ancient = smoothstep(0.25, 0.75, rimField.a);
  vec3 depths = mix(${srgb(WATER_COLORS.ancientShallow)}, ${srgb(WATER_COLORS.ancient)}, smoothstep(0.12, 0.3, shore + wobble));
  water = mix(water, depths, ancient);

  // Little wave marks drift across open water and breathe in and out.
  vec2 wave = (vXZ - uWindShift) * vec2(2.1, 2.9) + vec2(uTime * 0.07, 0.0);
  vec2 cell = floor(wave), local = fract(wave) - 0.5;
  float seed = waterHash(cell);
  local.x += (seed - 0.5) * 0.3;
  float crest = abs(local.y - 0.075 * sin(local.x * 13.0)) ;
  float mark = (1.0 - smoothstep(0.03, 0.06, crest)) * (1.0 - smoothstep(0.17, 0.23, abs(local.x)));
  float breathe = max(smoothstep(0.1, 0.7, 0.5 + 0.5 * sin(uTime * 0.7 + seed * 6.283)), uGust * 0.8);
  water = mix(water, ${srgb(WATER_COLORS.mark)}, mark * step(0.64, seed) * breathe * smoothstep(0.45, 0.7, shore) * (1.0 - lake * 0.6));

  // Slow swells of light roll across the open water.
  float swell = sin(dot(vXZ, vec2(0.55, 0.83)) * 1.5 - uTime * 0.5 + waterNoise(vXZ * 0.45) * 2.6);
  water = mix(water, ${srgb(WATER_COLORS.shallow)}, smoothstep(0.7 - uGust * 0.25, 1.0, swell) * (0.16 + uGust * 0.14) * smoothstep(0.3, 0.6, shore));

  // Sunlight shimmers in a moving web over the shallows.
  float web = abs(waterNoise(vXZ * 4.2 + uTime * 0.32) - waterNoise(vXZ * 4.2 - uTime * 0.27 + 7.1));
  float shimmer = (1.0 - smoothstep(0.0, 0.03, web)) * smoothstep(0.07, 0.12, shore) * (1.0 - smoothstep(0.16, 0.3, shore));
  water = mix(water, ${srgb(WATER_COLORS.foam)}, shimmer * 0.25);

  // Now and then a glint of sun twinkles on the surface.
  vec2 glint = vXZ * 3.1;
  vec2 glintCell = floor(glint);
  float glintSeed = waterHash(glintCell + 3.7);
  vec2 glintAt = fract(glint) - 0.5 - (vec2(waterHash(glintCell + 1.3), waterHash(glintCell + 8.1)) - 0.5) * 0.6;
  float twinkle = pow(max(0.0, sin(uTime * (1.1 + glintSeed) + glintSeed * 40.0)), 18.0) * step(0.72, glintSeed);
  float star = max(1.0 - smoothstep(0.0, 0.01, abs(glintAt.x)), 1.0 - smoothstep(0.0, 0.01, abs(glintAt.y))) * (1.0 - smoothstep(0.015, 0.08, length(glintAt)));
  star = max(star, 1.0 - smoothstep(0.008, 0.02, length(glintAt)));
  water = mix(water, vec3(1.0), clamp(star * twinkle, 0.0, 1.0) * smoothstep(0.35, 0.6, shore));

  // A foam lip hugs every shore and gently laps in and out.
  float lip = 0.07 + 0.018 * sin(uTime * 1.3 + vXZ.x * 1.7 + vXZ.y * 2.3) * (1.0 - lake * 0.7) + wobble * 0.5;
  water = mix(water, ${srgb(WATER_COLORS.foam)}, 1.0 - smoothstep(lip - 0.014, lip, shore));

  // Splashes: a foam ring rolls outward, and a new water tile floods with light from its center.
  for (int i = 0; i < ${SPLASH_SLOTS}; i++) {
    vec4 splash = uSplashes[i];
    float age = uTime - splash.z;
    if (age < 0.0 || age > 2.0) continue;
    vec2 offset = vXZ - splash.xy;
    float radius = length(offset);
    bool placed = splash.w < 1.5;
    float front = (placed ? 0.2 : 0.06) + age * (placed ? 1.25 : 0.6);
    float ring = 1.0 - smoothstep(0.0, placed ? 0.055 : 0.03, abs(radius - front));
    float ringFade = (1.0 - age / 2.0) * (placed ? 0.85 : 0.6);
    water = mix(water, ${srgb(WATER_COLORS.foam)}, ring * ringFade * step(0.02, shore));
    if (placed) {
      vec2 square = abs(offset);
      float inside = 1.0 - smoothstep(0.46, 0.5, max(square.x, square.y));
      float flood = 1.0 - smoothstep(age * 1.6 - 0.08, age * 1.6, radius);
      float glow = flood * inside * (1.0 - smoothstep(0.35, 1.4, age));
      water = mix(water, ${srgb(WATER_COLORS.flash)}, glow * 0.9);
      float edge = (1.0 - smoothstep(0.0, 0.04, abs(radius - age * 1.6))) * inside * (1.0 - smoothstep(0.2, 0.5, age));
      water = mix(water, ${srgb(WATER_COLORS.foam)}, edge);
    }
  }
  vec4 diffuseColor = vec4(water, opacity);
`
