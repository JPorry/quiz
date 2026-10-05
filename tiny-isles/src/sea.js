import * as THREE from 'three'
import { toon } from './look.js'

// A cel-shaded sea. The surface is a real mesh that moves: gentle swells cross
// the open water, and near every island waves roll in toward its shore, grow as
// the water gets shallow, rise against its cliffs and break into foam that slowly
// dissolves. Lighting comes in hard bands, foam has crisp edges, and the depth
// shows as flat rings of colour, like a painted cartoon sea.
//
// The shoreline is baked once per level into a distance field (a texture), so
// the shaders know how far every point is from land without looping over islands.

const SPEED = 0.3 // waves reaching a shore per second
const K = 1.9 // waves per world unit
const FIELD = 384
const NOISE_PERIOD = 32

// value noise on a lattice of NOISE_PERIOD cells that wraps around, four texels a cell
const NOISE = (() => {
  const size = NOISE_PERIOD * 4
  const lattice = Array.from({ length: NOISE_PERIOD * NOISE_PERIOD }, () => Math.random())
  const at = (i, j) => lattice[((j + NOISE_PERIOD) % NOISE_PERIOD) * NOISE_PERIOD + ((i + NOISE_PERIOD) % NOISE_PERIOD)]
  const data = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x / 4, fy = y / 4
    const i = Math.floor(fx), j = Math.floor(fy)
    let u = fx - i, v = fy - j
    u = u * u * (3 - 2 * u)
    v = v * v * (3 - 2 * v)
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * u
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * u
    data[y * size + x] = Math.round((a + (b - a) * v) * 255)
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RedFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.minFilter = t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
})()

const COMMON = /* glsl */ `
  uniform sampler2D uField;
  uniform vec4 uBounds;
  uniform float uTime;
  uniform sampler2D uNoise;
  // smooth value noise, baked into a tiling texture so it costs one lookup
  float noise(vec2 p) { return texture2D(uNoise, p / ${NOISE_PERIOD.toFixed(1)}).r; }
  float shoreDist(vec2 p) { return texture2D(uField, (p - uBounds.xy) / uBounds.zw).r; }
  // where in its cycle the incoming wave is, 0..1; the crest sits near 0.15
  float wavePhase(vec2 p, float s) {
    float ph = 0.25 * sin(p.x * 1.3) + 0.25 * sin(p.y * 1.7 + 1.0);
    return fract(s * ${K.toFixed(2)} + uTime * ${SPEED.toFixed(2)} + ph);
  }
  // a steep front facing the shore and a long gentle back
  float profile(float x) { return smoothstep(0.0, 0.15, x) * (1.0 - smoothstep(0.2, 1.0, x)); }
  float seaHeight(vec2 p) {
    float s = shoreDist(p);
    float h = 0.011 * sin(dot(p, vec2(0.8, 0.6)) * 2.6 + uTime * 0.9) + 0.007 * sin(dot(p, vec2(-0.5, 0.9)) * 3.9 + uTime * 1.2);
    // waves grow as they reach shallow water, then surge up the cliff
    float amp = 0.034 * (1.0 - smoothstep(0.15, 1.5, s));
    h += amp * profile(wavePhase(p, max(s, 0.0)));
    return h;
  }
`

function material(flat) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uField: { value: null },
      uBounds: { value: new THREE.Vector4(-1, -1, 2, 2) },
      uTime: { value: 0 },
      uDusk: { value: 0 },
      uSun: { value: new THREE.Vector3(-5, 10, 6).normalize() },
      uNoise: { value: NOISE },
    },
    vertexShader: /* glsl */ `
      ${COMMON}
      uniform vec3 uSun;
      varying vec3 vWorld;
      varying float vLit;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vLit = 0.0;
        ${flat ? '' : `
        // lit per vertex from the wave's slope, so the pixels don't have to
        float h0 = seaHeight(w.xz);
        float e = 0.025;
        vec3 nrm = normalize(vec3(h0 - seaHeight(w.xz + vec2(e, 0.0)), e, h0 - seaHeight(w.xz + vec2(0.0, e))));
        vLit = dot(nrm, uSun) - uSun.y;
        w.y += h0;`}
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform float uDusk;
      varying vec3 vWorld;
      varying float vLit;
      void main() {
        vec2 p = vWorld.xz;
        float s = shoreDist(p);
        float n1 = noise(p * 5.0 + vec2(uTime * 0.15, -uTime * 0.1));
        float n2 = noise(p * 14.0 - vec2(uTime * 0.3, uTime * 0.2));

        // flat rings of colour by depth, with wobbly edges
        float sd = s + (n1 - 0.5) * 0.08;
        vec3 deep = vec3(0.22, 0.69, 0.82);
        vec3 col = deep;
        col = mix(col, vec3(0.30, 0.77, 0.86), step(sd, 0.9));
        col = mix(col, vec3(0.40, 0.83, 0.87), step(sd, 0.42));
        col = mix(col, vec3(0.56, 0.90, 0.88), step(sd, 0.15));

        // cel lighting from the wave's slope, in three hard bands
        col *= 1.0 + 0.05 * step(0.08, vLit) - 0.05 * step(vLit, -0.1);
        // the soft shadows of clouds drifting over
        float cloud = noise(p * 0.32 + vec2(uTime * 0.035, uTime * 0.012)) * 0.75 + noise(p * 0.9 - uTime * 0.02) * 0.25;
        col *= 1.0 - 0.06 * step(0.6, cloud);
        // now and then a ripple line drifting across open water
        float lines = abs(sin((p.x * 0.6 + p.y) * 9.0 + n1 * 6.0 + uTime * 0.6));
        float area = step(0.8, noise(p * 1.1 + uTime * 0.05));
        col = mix(col, vec3(0.7, 0.92, 0.94), step(lines, 0.04) * area * step(0.8, s) * 0.45);

        float foam = 0.0;
        float x = wavePhase(p, max(s, 0.0));
        // the breaking crest: a white band that thickens near the shore
        float near = 1.0 - smoothstep(0.08, 0.75, s);
        float crest = step(0.04, x) * step(x, 0.06 + 0.12 * near);
        foam = max(foam, crest * step(0.3 + 0.45 * (1.0 - near), n2 * 0.7 + n1 * 0.3 + 0.3 * near) * step(0.03, s));
        // backwash: foam spread over the shallows after a wave hits, dissolving
        float age = fract(uTime * ${SPEED.toFixed(2)} + 0.25 * sin(p.x * 1.3) + 0.25 * sin(p.y * 1.7 + 1.0) - 0.15);
        float wash = step(s, 0.04 + 0.13 * sqrt(age)) * step(age * 1.25, n2 * 0.9 + n1 * 0.3);
        foam = max(foam, wash);
        // a constant lacy lip where the water meets land
        foam = max(foam, step(s, 0.035 + 0.025 * n1));
        col = mix(col, vec3(1.0), foam);
        // a darker line just inside the foam lip, like an inked edge
        col *= 1.0 - 0.18 * step(s, 0.075 + 0.025 * n1) * (1.0 - foam);

        col = pow(col, vec3(2.2)); // the colours above are picked in sRGB
        col = mix(col, col * vec3(1.15, 0.78, 0.72) + vec3(0.06, 0.02, 0.05), uDusk);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

const DROP = new THREE.SphereGeometry(1, 10, 8)

export class Sea {
  constructor(scene) {
    this.near = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material(false))
    this.far = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), material(true))
    this.near.position.y = -0.02
    this.far.position.y = -0.05
    // the near surface is drawn first so the far one is hidden behind it for free
    this.near.renderOrder = -2
    this.far.renderOrder = -1
    scene.add(this.far, this.near)
    this.group = new THREE.Group()
    scene.add(this.group)
    this.drops = []
    this.time = 0
  }

  get materials() { return [this.near.material, this.far.material] }

  // shores: [{ x, z, radius(angle) }] for islands, or { x, z, r } for round rocks
  setShores(shores, reach) {
    this.shores = shores
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
    for (const s of shores) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x)
      minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z)
    }
    const pad = 3
    const size = Math.max(maxX - minX, maxZ - minZ) + pad * 2
    const ox = (minX + maxX) / 2 - size / 2, oz = (minZ + maxZ) / 2 - size / 2
    const data = new Uint16Array(FIELD * FIELD * 4)
    const toHalf = THREE.DataUtils.toHalfFloat
    for (let j = 0; j < FIELD; j++) {
      const z = oz + ((j + 0.5) / FIELD) * size
      for (let i = 0; i < FIELD; i++) {
        const x = ox + ((i + 0.5) / FIELD) * size
        let d = 9
        for (const s of shores) {
          const dx = x - s.x, dz = z - s.z
          const l = Math.sqrt(dx * dx + dz * dz)
          if (l - 1.6 > d) continue
          d = Math.min(d, l - (s.radius ? s.radius(Math.atan2(dz, dx)) : s.r))
        }
        data[(j * FIELD + i) * 4] = toHalf(d)
      }
    }
    if (this.field) this.field.dispose()
    this.field = new THREE.DataTexture(data, FIELD, FIELD, THREE.RGBAFormat, THREE.HalfFloatType)
    this.field.minFilter = this.field.magFilter = THREE.LinearFilter
    this.field.wrapS = this.field.wrapT = THREE.ClampToEdgeWrapping
    this.field.needsUpdate = true
    for (const m of this.materials) {
      m.uniforms.uField.value = this.field
      m.uniforms.uBounds.value.set(ox, oz, size, size)
    }
    // the moving surface covers everything the camera can see around the board
    const span = Math.max(size, reach * 2 + 6)
    const segs = Math.min(200, Math.round(span / 0.1))
    this.near.geometry.dispose()
    this.near.geometry = new THREE.PlaneGeometry(span, span, segs, segs).rotateX(-Math.PI / 2)
    this.near.position.x = (minX + maxX) / 2
    this.near.position.z = (minZ + maxZ) / 2
    // splash points spaced around every island's shore
    this.spots = []
    for (const s of shores) {
      if (!s.radius) continue
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + Math.random() * 0.3
        const r = s.radius(a) + 0.02
        const p = new THREE.Vector2(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r)
        this.spots.push({ p, a, last: this.phase(p) })
      }
    }
    for (const d of this.drops) d.mesh.removeFromParent()
    this.drops = []
  }

  // how far a point is from the nearest shore
  distance(x, z) {
    let d = Infinity
    for (const s of this.shores) d = Math.min(d, Math.hypot(x - s.x, z - s.z) - (s.radius ? s.radius(Math.atan2(z - s.z, x - s.x)) : s.r))
    return d
  }

  phase(p) {
    const ph = 0.25 * Math.sin(p.x * 1.3) + 0.25 * Math.sin(p.y * 1.7 + 1.0)
    const v = this.time * SPEED + ph
    return v - Math.floor(v)
  }

  update(dt, dusk) {
    this.time += dt
    for (const m of this.materials) {
      m.uniforms.uTime.value = this.time
      m.uniforms.uDusk.value = dusk
    }
    // when a crest reaches the shore, it throws up a few droplets
    for (const s of this.spots ?? []) {
      const x = this.phase(s.p)
      if (s.last < 0.15 && x >= 0.15 && Math.random() < 0.7) this.splash(s)
      s.last = x
    }
    for (const d of this.drops) {
      d.age += dt
      d.v.y -= dt * 2.2
      d.mesh.position.addScaledVector(d.v, dt)
      const k = d.age / d.life
      d.mesh.scale.setScalar(d.size * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) * 0.8))
      if (d.age >= d.life || d.mesh.position.y < -0.03) d.mesh.removeFromParent()
    }
    this.drops = this.drops.filter((d) => d.mesh.parent)
  }

  splash(spot) {
    const n = 2 + Math.floor(Math.random() * 3)
    for (let k = 0; k < n; k++) {
      const mesh = new THREE.Mesh(DROP, toon(0xffffff, { rim: 0.05 }))
      const a = spot.a + (Math.random() - 0.5) * 0.5
      mesh.position.set(spot.p.x + Math.cos(a) * 0.03, 0.02, spot.p.y + Math.sin(a) * 0.03)
      const out = 0.12 + Math.random() * 0.15
      const v = new THREE.Vector3(Math.cos(a) * out, 0.45 + Math.random() * 0.35, Math.sin(a) * out)
      this.group.add(mesh)
      this.drops.push({ mesh, v, age: 0, life: 0.55 + Math.random() * 0.25, size: 0.018 + Math.random() * 0.016 })
    }
  }
}
