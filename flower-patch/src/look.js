import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Shared looks: soft toon shading with a warm rim, sticker-style outlines, and a
// helper that bakes coloured parts into one mesh so whole buildings are one draw.

const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([150, 205, 238, 255]), 4, 1, THREE.RedFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()

const toons = new Map()
export function toon(color = 0xffffff, { vertexColors = false, rim = 0.22, emissive = 0x000000, transparent = false, opacity = 1 } = {}) {
  const key = [color, vertexColors, rim, emissive, transparent, opacity].join('-')
  if (toons.has(key)) return toons.get(key)
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient, vertexColors, emissive, transparent, opacity })
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 rimV = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
      float rimA = pow(1.0 - clamp(dot(normalize(normal), rimV), 0.0, 1.0), 2.6);
      outgoingLight += vec3(1.0, 0.96, 0.9) * rimA * ${rim.toFixed(2)};
      #include <opaque_fragment>`,
    )
  }
  // only the rim is baked into the shader; colours are uniforms, so every toon
  // material with the same rim shares one compiled program
  m.customProgramCacheKey = () => `toon-${rim.toFixed(2)}`
  toons.set(key, m)
  return m
}

// Soft clay, like a little toy modelled in plasticine: smooth shading with a
// gentle sheen and a warm rim, no hard bands.
const clays = new Map()
export function clay({ rim = 0.12, roughness = 0.42, fill = 0.5, key: sun = 1.4 } = {}) {
  const key = `${rim}-${roughness}-${fill}-${sun}`
  if (clays.has(key)) return clays.get(key)
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness, metalness: 0 })
  m.onBeforeCompile = (shader) => {
    // less flat fill light and more sun, so every petal is clearly modelled:
    // a lit side, a shaded side and a soft shadow where it tucks under the next
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= ${fill.toFixed(2)};
      reflectedLight.directDiffuse *= ${sun.toFixed(2)};`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 rimV = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
      float rimA = pow(1.0 - clamp(dot(normalize(normal), rimV), 0.0, 1.0), 2.2);
      outgoingLight += vec3(1.0, 0.97, 0.94) * rimA * ${rim.toFixed(2)};
      #include <opaque_fragment>`,
    )
  }
  m.customProgramCacheKey = () => `clay-${key}`
  clays.set(key, m)
  return m
}

const outlines = new Map()
// Inverted hull: the same shape pushed out along its normals, drawn from behind.
export function outline(color, width) {
  const key = `${color}-${width}`
  if (outlines.has(key)) return outlines.get(key)
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${width.toFixed(4)};`)
  }
  m.customProgramCacheKey = () => `outline-${width.toFixed(4)}`
  outlines.set(key, m)
  return m
}

// A coloured part: geometry placed by position, scale and rotation.
// Each source shape is flattened once (no index, just what parts need) and then
// copied, which keeps baking hundreds of parts quick.
const bases = new WeakMap()
function base(geometry) {
  let g = bases.get(geometry)
  if (!g) {
    g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'shade') g.deleteAttribute(name)
    bases.set(geometry, g)
  }
  return g
}
export function part(geometry, color, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], [rx, ry, rz] = [0, 0, 0]) {
  const g = base(geometry).clone()
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)))
  const c = new THREE.Color(color)
  const colors = new Float32Array(g.attributes.position.count * 3)
  // a shape can carry its own soft occlusion (darker in creases), baked in
  const shade = g.attributes.shade
  for (let i = 0; i < colors.length; i += 3) {
    const k = shade ? shade.getX(i / 3) : 1
    colors[i] = c.r * k; colors[i + 1] = c.g * k; colors[i + 2] = c.b * k
  }
  if (shade) g.deleteAttribute('shade')
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}
export const merge = (parts) => mergeGeometries(parts.filter(Boolean))

// One mesh of baked parts, with its outline, grouped so they move together.
export function baked(parts, { line = 0x5a4a5a, width = 0.012, shadow = true, rim } = {}) {
  const geometry = merge(parts)
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true, rim }))
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  group.add(mesh)
  if (width) group.add(new THREE.Mesh(geometry, outline(line, width)))
  return group
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export const seeded = (n) => {
  let s = Math.floor(Math.abs(n) * 9973) % 2147483646 + 1
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}
