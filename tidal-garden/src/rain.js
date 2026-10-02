import * as THREE from 'three'
import { cloudCenter } from './clouds.js'

const clamp = THREE.MathUtils.clamp
const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x) }
const LAND_TOP = 0.44
const WATER_Y = 0.06
const SOCKET_TOP = 0.1
const FALL_FROM = 2.6
const FALL_SPEED = 7
const UP = new THREE.Vector3(0, 1, 0)

// How hard a rain cloud is raining right now: it builds as the cloud drifts over the tray
// and eases off as it leaves.
export function showerStrength(center, size, reach) {
  const out = Math.max(Math.abs(center.x), Math.abs(center.z))
  return smooth((reach + size * 0.8 - out) / (size * 1.4))
}

// A passing shower: slanted streaks fall beneath a rain cloud, each drop dimpling the
// water or splashing on the grass, and once the cloud has moved on a faint rainbow
// often hangs over the garden for a while.
export class Rain {
  constructor(garden, { reach, random = Math.random }) {
    this.garden = garden
    this.reach = reach
    this.random = random
    this.drops = []
    this.marks = []
    this.capacity = garden.mobile ? 140 : 240
    this.dummy = new THREE.Object3D()
    this.streaks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xf2faff, transparent: true, opacity: 0.75, depthWrite: false }), this.capacity)
    this.streaks.count = 0
    this.streaks.frustumCulled = false
    garden.scene.add(this.streaks)
    // Rings brighten what is under them; their color fades them out.
    this.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.035, 0.055, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    }), this.capacity)
    this.rings.count = 0
    this.rings.frustumCulled = false
    this.rings.renderOrder = 2
    for (let i = 0; i < this.capacity; i++) this.rings.setColorAt(i, new THREE.Color(0xffffff))
    garden.scene.add(this.rings)
    this.ringColor = new THREE.Color()
    this.buildRainbow()
    this.rainbow = null
    this.strength = 0
  }

  // A soft arc of pastel bands on a card that always faces the camera.
  buildRainbow() {
    this.rainbowMaterial = new THREE.ShaderMaterial({
      // A translucent tint rather than added light, so it stays colored over pale sockets and sand.
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uOpacity;
        vec3 spectrum(float t) {
          return clamp(vec3(abs(t * 6.0 - 3.0) - 1.0, 2.0 - abs(t * 6.0 - 2.0), 2.0 - abs(t * 6.0 - 4.0)), 0.0, 1.0);
        }
        void main() {
          // The arc's center sits at the bottom middle of the card.
          vec2 p = (vUv - vec2(0.5, 0.0)) * vec2(2.0, 1.0);
          float radius = length(p);
          float band = (radius - 0.72) / 0.2;
          if (band < 0.0 || band > 1.0) discard;
          vec3 color = mix(spectrum(1.0 - band * 0.82), vec3(1.0), 0.18);
          float edges = smoothstep(0.0, 0.25, band) * smoothstep(1.0, 0.7, band);
          // It fades toward its feet, as rainbows do.
          float feet = smoothstep(0.05, 0.55, p.y / radius);
          gl_FragColor = vec4(color, edges * feet * uOpacity);
          #include <colorspace_fragment>
        }
      `,
    })
    this.rainbowMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), this.rainbowMaterial)
    this.rainbowMesh.renderOrder = 21
    this.rainbowMesh.visible = false
    this.garden.scene.add(this.rainbowMesh)
  }

  showRainbow(time) {
    this.rainbow = { started: time, roll: (this.random() - 0.5) * 0.5, drop: 1.5 + this.random() * 1.5, side: (this.random() - 0.5) * 3 }
  }

  surface(x, z) {
    const value = this.garden.grid?.[Math.floor(z + 5)]?.[Math.floor(x + 5)]
    return value === 1 ? { y: LAND_TOP, land: true } : value === null ? { y: SOCKET_TOP, land: true } : { y: WATER_Y, land: false }
  }

  // A raindrop lands somewhere under one of the cloud's puffs, inside the tray.
  spawnDrop(cloud, center, time) {
    const puff = cloud.puffs[Math.floor(this.random() * cloud.puffs.length)]
    const angle = this.random() * Math.PI * 2, distance = Math.sqrt(this.random()) * puff.r * 0.8
    const x = center.x + puff.x + Math.cos(angle) * distance, z = center.z + puff.z + Math.sin(angle) * distance
    if (Math.abs(x) > this.reach - 0.2 || Math.abs(z) > this.reach - 0.2) return
    const ground = this.surface(x, z)
    // Rain slants a little with the cloud's drift.
    const vx = cloud.dir.x * 2.2, vz = cloud.dir.z * 2.2
    const fall = (FALL_FROM - ground.y) / FALL_SPEED
    this.drops.push({ x, z, vx, vz, ground, born: time, lands: time + fall })
  }

  update(time, dt, clouds, reducedMotion) {
    let strength = 0
    if (!reducedMotion && !this.garden.finale?.active) {
      for (const cloud of clouds.clouds) {
        if (!cloud.rain) continue
        const center = cloudCenter(cloud, time)
        const amount = showerStrength(center, cloud.size, this.reach)
        cloud.rained = Math.max(cloud.rained ?? 0, amount)
        strength = Math.max(strength, amount)
        // A heavier shower drops more at once; fractions carry over between frames.
        cloud.owed = (cloud.owed ?? 0) + amount * (this.garden.mobile ? 80 : 140) * dt
        while (cloud.owed >= 1 && this.drops.length < this.capacity) { cloud.owed -= 1; this.spawnDrop(cloud, center, time) }
        cloud.owed = Math.min(cloud.owed, 4)
      }
      if (!this.rainbow && clouds.departed.some((cloud) => cloud.rain && cloud.rained > 0.5) && this.random() < 0.75) this.showRainbow(time)
    }
    this.strength = strength
    this.updateDrops(time)
    this.updateRainbow(time, reducedMotion)
  }

  updateDrops(time) {
    const landed = this.drops.filter((drop) => time >= drop.lands)
    for (const drop of landed) this.marks.push({ x: drop.x, z: drop.z, y: drop.ground.y + 0.008, land: drop.ground.land, born: time })
    this.drops = this.drops.filter((drop) => time < drop.lands)
    this.marks = this.marks.filter((mark) => time - mark.born < (mark.land ? 0.35 : 0.7)).slice(-this.capacity)
    const direction = new THREE.Vector3()
    this.drops.forEach((drop, index) => {
      const left = drop.lands - time
      this.dummy.position.set(drop.x - drop.vx * left, drop.ground.y + FALL_SPEED * left + 0.15, drop.z - drop.vz * left)
      direction.set(drop.vx, FALL_SPEED, drop.vz).normalize()
      this.dummy.quaternion.setFromUnitVectors(UP, direction)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.streaks.setMatrixAt(index, this.dummy.matrix)
    })
    this.streaks.count = this.drops.length
    this.streaks.instanceMatrix.needsUpdate = true
    this.marks.forEach((mark, index) => {
      const t = (time - mark.born) / (mark.land ? 0.35 : 0.7)
      this.dummy.position.set(mark.x, mark.y, mark.z)
      this.dummy.quaternion.identity()
      this.dummy.scale.setScalar((mark.land ? 0.5 : 0.7) + t * (mark.land ? 1 : 2.8))
      this.dummy.updateMatrix()
      this.rings.setMatrixAt(index, this.dummy.matrix)
      this.rings.setColorAt(index, this.ringColor.setRGB(0.85, 0.95, 1).multiplyScalar((1 - t) ** 1.5 * (mark.land ? 0.45 : 0.85)))
    })
    this.rings.count = this.marks.length
    this.rings.instanceMatrix.needsUpdate = true
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true
  }

  updateRainbow(time, reducedMotion) {
    const rainbow = this.rainbow
    if (!rainbow) { this.rainbowMesh.visible = false; return }
    const age = time - rainbow.started
    const opacity = smooth(age / 3.5) * (1 - smooth((age - 12) / 6))
    if (age > 18 || reducedMotion) { this.rainbow = null; this.rainbowMesh.visible = false; return }
    // It faces the camera and rises from behind the garden, so it reads at any camera angle.
    const camera = this.garden.camera
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    this.rainbowMesh.quaternion.copy(camera.quaternion)
    this.rainbowMesh.rotateZ(rainbow.roll)
    this.rainbowMesh.position.set(0, 1.6, 0).addScaledVector(up, -rainbow.drop).addScaledVector(right, rainbow.side)
    this.rainbowMaterial.uniforms.uOpacity.value = opacity * 0.3 * (1 - (this.garden.finale?.view.blend ?? 0))
    this.rainbowMesh.visible = true
  }
}
