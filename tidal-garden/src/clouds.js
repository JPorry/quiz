import * as THREE from 'three'

const SLOTS = 2
const PUFFS = 8
const TAU = Math.PI * 2

// Clear skies are the rule: the first cloud turns up after a while, and later ones
// are spaced well apart, at random, so a passing shadow always feels like a small event.
export function cloudDelay(random, first = false) {
  return first ? 25 + random() * 35 : 45 + random() * 75
}

// A cloud is a loose cluster of puffs, stretched along its heading, that drifts in from
// beyond one side of the tray and out past the other, along a random line.
export function makeCloud(random, reach, born) {
  const heading = random() * TAU
  const size = 1.8 + random() * 1.5
  const dir = { x: Math.cos(heading), z: Math.sin(heading) }
  const across = { x: -dir.z, z: dir.x }
  const lateral = (random() - 0.5) * reach * 1.5
  const distance = reach + size * 2 + 0.5
  const puffs = Array.from({ length: 5 + Math.floor(random() * 4) }, () => {
    const along = (random() - 0.5) * size * 2.2, side = (random() - 0.5) * size * 1.1
    return { x: dir.x * along + across.x * side, z: dir.z * along + across.z * side, r: size * (0.42 + random() * 0.38) }
  })
  return {
    born, dir, puffs, size,
    start: { x: -dir.x * distance + across.x * lateral, z: -dir.z * distance + across.z * lateral },
    speed: 0.55 + random() * 0.35,
    travel: distance * 2,
    seed: random() * 100,
    strength: 0.32 + random() * 0.1,
  }
}

export function cloudCenter(cloud, time) {
  const moved = (time - cloud.born) * cloud.speed
  return { x: cloud.start.x + cloud.dir.x * moved, z: cloud.start.z + cloud.dir.z * moved, done: moved > cloud.travel }
}

// The shadows of clouds passing overhead, drawn as a soft darkening over the tray.
export class CloudShadows {
  constructor(garden, { tray, height = 1.4, random = Math.random } = {}) {
    this.garden = garden
    this.random = random
    this.reach = tray / 2
    this.clouds = []
    this.next = cloudDelay(random, true)
    this.puffs = Array.from({ length: SLOTS * PUFFS }, () => new THREE.Vector4())
    this.slots = Array.from({ length: SLOTS }, () => new THREE.Vector4())
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uPuffs: { value: this.puffs }, uClouds: { value: this.slots } },
      vertexShader: `varying vec2 vXZ; void main() { vXZ = (modelMatrix * vec4(position, 1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vXZ;
        uniform float uTime;
        uniform float uFade;
        uniform vec4 uPuffs[${SLOTS * PUFFS}];
        uniform vec4 uClouds[${SLOTS}];
        float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
        }
        void main() {
          float shade = 0.0;
          for (int c = 0; c < ${SLOTS}; c++) {
            vec4 cloud = uClouds[c];
            if (cloud.w <= 0.0) continue;
            float density = 0.0;
            for (int j = 0; j < ${PUFFS}; j++) {
              vec4 puff = uPuffs[c * ${PUFFS} + j];
              if (puff.z <= 0.0) continue;
              density += 1.0 - smoothstep(0.15, 1.0, length(vXZ - puff.xy) / puff.z);
            }
            // Noise that travels with the cloud frays its edges and slowly churns its shape.
            vec2 local = (vXZ - cloud.xy) * 0.85 + cloud.z;
            float n = noise(local + uTime * 0.05) * 0.6 + noise(local * 2.3 - uTime * 0.07) * 0.4;
            density += (n - 0.5) * 0.9;
            shade = max(shade, smoothstep(0.3, 0.85, density) * cloud.w);
          }
          vec2 edge = abs(vXZ) - ${(this.reach - 0.25).toFixed(2)};
          float inside = 1.0 - smoothstep(0.0, 0.25, max(edge.x, edge.y));
          gl_FragColor = vec4(0.06, 0.22, 0.38, shade * inside * uFade);
          #include <colorspace_fragment>
        }
      `,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(tray, tray).rotateX(-Math.PI / 2), this.material)
    this.mesh.position.y = height
    this.mesh.renderOrder = 20
    garden.scene.add(this.mesh)
  }

  // `progress` starts a cloud partway through its crossing, so tools can show one right away.
  spawn(time, progress = 0) {
    if (this.clouds.length >= SLOTS) return false
    const cloud = makeCloud(this.random, this.reach, time)
    cloud.born -= progress * cloud.travel / cloud.speed
    this.clouds.push(cloud)
    return true
  }

  update(time, reducedMotion) {
    this.material.uniforms.uTime.value = reducedMotion ? 0 : time
    // Reduced motion keeps the sky clear rather than sliding shadows across the board.
    if (!reducedMotion && time >= this.next) {
      this.spawn(time)
      this.next = time + cloudDelay(this.random)
    }
    this.clouds = this.clouds.filter((cloud) => !cloudCenter(cloud, time).done)
    for (let c = 0; c < SLOTS; c++) {
      const cloud = this.clouds[c]
      const center = cloud && cloudCenter(cloud, time)
      this.slots[c].set(center?.x ?? 0, center?.z ?? 0, cloud?.seed ?? 0, cloud?.strength ?? 0)
      for (let j = 0; j < PUFFS; j++) {
        const puff = cloud?.puffs[j]
        this.puffs[c * PUFFS + j].set(puff ? center.x + puff.x : 0, puff ? center.z + puff.z : 0, puff?.r ?? 0, 0)
      }
    }
    this.mesh.visible = this.clouds.length > 0
  }
}
