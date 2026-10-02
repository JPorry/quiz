import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { connectedTerrain, landMask, landOutline } from './terrain.js'
import { createRimField, RIM, waterVertexHead, waterVertexBody, waterFragmentHead, waterFragmentColor } from './ocean.js'
import { RegionCompletions } from './completions.js'
import { renderProfile, frameIsDue, scheduledFrameTime } from './renderProfile.js'
import { WaterRipples } from './waterRipples.js'
import { WaterLife } from './waterLife.js'

const COLORS = {
  sand: 0xf4dfae, cliff: 0xd9a868, grass: 0x92d46f, grassSide: 0x58a352,
  leaf: 0x54b25c, leafLight: 0x9fe282, leafDark: 0x2f8a4c, blossom: 0xff9fb2, flower: 0xffe07a,
  petal: 0xffffff, rock: 0xb9c7c2, trunk: 0xa0704a, brass: 0xf3c34b,
  mist: 0xc9ece7, mistSide: 0x9fd3cd, trayWater: 0x2f9fb0, trayEarth: 0xd2a467, foam: 0xf3fbf8,
}
const MAT_SIZE = 16
const RIPPLE_COUNT = 8
const TRAY = 10.6
const WATER_Y = 0.06
const clamp = THREE.MathUtils.clamp
// The camera looks almost straight down; a small tilt reveals the south-facing cliffs.
const TILT = (() => {
  const tilt = Number(new URLSearchParams(location.search).get('tilt'))
  return (tilt > 0 && tilt < 45 ? tilt : 10) * Math.PI / 180
})()
const LOUPE_SIZE = 104
const LOUPE_SPAN = 1.6
const LAND = { sand: { inset: 0.06, radius: 0.24, bottom: -0.32, top: 0.34 }, grass: { inset: 0.15, radius: 0.2, bottom: 0.3, top: 0.44 } }
const seeded = (index) => THREE.MathUtils.euclideanModulo(Math.sin(index * 127.1 + 311.7) * 43758.5453, 1)
const material = (color, options = {}) => new THREE.MeshLambertMaterial({ color, ...options })

function roundedRect(width, depth, radius) {
  const shape = new THREE.Shape()
  const w = width / 2, d = depth / 2
  shape.moveTo(-w + radius, -d)
  shape.lineTo(w - radius, -d)
  shape.absarc(w - radius, -d + radius, radius, -Math.PI / 2, 0)
  shape.lineTo(w, d - radius)
  shape.absarc(w - radius, d - radius, radius, 0, Math.PI / 2)
  shape.lineTo(-w + radius, d)
  shape.absarc(-w + radius, d - radius, radius, Math.PI / 2, Math.PI)
  shape.lineTo(-w, -d + radius)
  shape.absarc(-w + radius, -d + radius, radius, Math.PI, Math.PI * 1.5)
  return shape
}

// A plan-view shape extruded upward between two heights.
function slab(shape, bottom, top) {
  return new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2).translate(0, bottom, 0)
}

export class GardenScene {
  constructor(container, { onCell, safeArea }) {
    this.container = container
    this.onCell = onCell
    this.safeArea = safeArea
    this.mobile = container.clientWidth < 700
    this.cells = []
    this.targets = []
    this.time = 0
    this.profile = renderProfile(container.clientWidth, devicePixelRatio, matchMedia('(pointer: coarse)').matches)
    this.lastFrame = -Infinity
    this.lastShadowFrame = -Infinity
    this.renderedFrames = 0
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.rippleIndex = 0
    this.ripples = Array.from({ length: RIPPLE_COUNT }, () => new THREE.Vector4(0, 0, -100, 0))
    this.particles = []
    this.landGeometries = new Map()
    this.daylight = 0
    this.daylightTarget = 0
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 120)
    this.camera.position.copy(this.cameraOffset())
    this.camera.lookAt(0, 0, 0)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(this.profile.pixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.setAttribute('aria-label', 'A little island diorama seen from above, with interactive land and water puzzle cells')
    this.renderer.domElement.setAttribute('role', 'img')
    container.append(this.renderer.domElement)
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3)
    this.aimPoint = new THREE.Vector3()
    this.aim = null
    this.loupeCamera = new THREE.OrthographicCamera(-LOUPE_SPAN / 2, LOUPE_SPAN / 2, LOUPE_SPAN / 2, -LOUPE_SPAN / 2, 0.1, 120)
    this.loupe = document.createElement('div')
    this.loupe.className = 'aim-loupe'
    this.loupe.setAttribute('aria-hidden', 'true')
    container.append(this.loupe)
    this.materials = Object.fromEntries(Object.entries(COLORS).map(([name, color]) => [name, material(color)]))
    // Shadows only see the sky, which tints them a soft blue instead of grey.
    this.scene.add(new THREE.HemisphereLight(0xbcd9ff, 0x9fd0c8, 1.45))
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.5)
    sun.castShadow = true
    sun.shadow.mapSize.set(this.profile.shadowSize, this.profile.shadowSize)
    Object.assign(sun.shadow.camera, { left: -8.5, right: 8.5, top: 8.5, bottom: -8.5, near: 1, far: 50 })
    sun.shadow.radius = 3
    sun.shadow.normalBias = 0.02
    sun.shadow.bias = -0.0004
    this.scene.add(sun)
    this.sun = sun
    this.placeSun(0)
    this.buildWorld()
    this.buildCells()
    this.buildBoardGuides()
    this.buildParticles()
    this.buildClouds()
    this.hover = this.createHover()
    this.scene.add(this.hover)
    this.completions = new RegionCompletions(this)
    this.bindEvents()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.renderer.setAnimationLoop((time) => this.animate(time))
  }

  mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  markTerrain(x, z, value) {
    const col = Math.floor(x + MAT_SIZE / 2)
    const row = Math.floor(z + MAT_SIZE / 2)
    if (row < 0 || row >= MAT_SIZE || col < 0 || col >= MAT_SIZE) return
    this.terrainData[(row * MAT_SIZE + col) * 4] = value
  }

  // The sun crosses the sky as the garden fills: morning light from the northeast,
  // golden hour from the northwest, so shadows slowly swing across the board.
  placeSun(progress) {
    const azimuth = THREE.MathUtils.lerp(0.75, -0.75, progress)
    const elevation = THREE.MathUtils.lerp(0.95, 0.62, progress * progress)
    this.sun.position.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(22)
    const golden = THREE.MathUtils.smoothstep(progress, 0.6, 1)
    this.sun.color.setHex(0xfff1d6).lerp(new THREE.Color(0xffc887), golden * 0.7)
    this.sun.intensity = 2.5 + golden * 0.25
  }

  buildWorld() {
    this.terrainData = new Uint8Array(MAT_SIZE * MAT_SIZE * 4)
    for (let i = 3; i < this.terrainData.length; i += 4) this.terrainData[i] = 255
    // The diorama tray: a slice of sea above a layer of sand, sitting on a soft table shadow.
    this.tray = new THREE.Group()
    this.scene.add(this.tray)
    this.mesh(new RoundedBoxGeometry(TRAY, 0.34, TRAY, 3, 0.16), this.materials.trayWater, this.tray, 0, -0.13, 0).castShadow = false
    this.mesh(new RoundedBoxGeometry(TRAY, 0.42, TRAY, 3, 0.16), this.materials.trayEarth, this.tray, 0, -0.47, 0)
    const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x0c3c47, opacity: 0.2 }))
    table.position.y = -0.69
    table.receiveShadow = true
    this.scene.add(table)
    this.rimTexture = new THREE.DataTexture(new Uint8Array(RIM.resolution * RIM.resolution * 4), RIM.resolution, RIM.resolution)
    this.rimTexture.minFilter = THREE.LinearFilter
    this.rimTexture.magFilter = THREE.LinearFilter
    this.waterUniforms = { uTime: { value: 0 }, uRim: { value: this.rimTexture } }
    this.waterMaterial = material(0xffffff)
    this.waterMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.waterUniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${waterVertexHead}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${waterVertexBody}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${waterFragmentHead}`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', waterFragmentColor)
    }
    this.water = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(TRAY - 0.04, TRAY - 0.04, 0.2), 8).rotateX(-Math.PI / 2), this.waterMaterial)
    this.water.position.y = WATER_Y
    this.water.receiveShadow = true
    this.scene.add(this.water)
    this.waterRipples = new WaterRipples(this.terrainData, this.reducedMotion, TRAY / 2 - 0.12)
    this.scene.add(this.waterRipples.mesh)
    this.waterLife = new WaterLife(this, { reach: TRAY / 2 - 0.12, waterY: WATER_Y })
    this.waterUniforms.uSplashes = { value: this.waterLife.splashes }
  }

  landGeometry(layer, mask) {
    const key = `${layer}:${mask}`
    if (!this.landGeometries.has(key)) {
      const { inset, radius, bottom, top } = LAND[layer]
      const shape = new THREE.Shape(landOutline(mask, inset, radius).map(([x, y]) => new THREE.Vector2(x, y)))
      this.landGeometries.set(key, slab(shape, bottom, top))
    }
    return this.landGeometries.get(key)
  }

  buildCells() {
    const targetMaterial = new THREE.MeshBasicMaterial({ visible: false })
    const targetGeometry = new THREE.PlaneGeometry(1, 1)
    const mistGeometry = slab(roundedRect(0.76, 0.76, 0.2), 0, 0.11)
    const pinGeometry = new THREE.SphereGeometry(0.055, 12, 8)
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const index = row * 10 + col
        const group = new THREE.Group()
        group.position.set(col - 4.5, 0, row - 4.5)
        this.scene.add(group)
        const target = this.mesh(targetGeometry, targetMaterial, group, 0, 0.16, 0)
        target.rotation.x = -Math.PI / 2
        target.castShadow = false
        target.userData.cell = { row, col }
        this.targets.push(target)
        // Undecided tiles float as pale mist sandbars just above the water.
        const sand = new THREE.Group()
        this.mesh(mistGeometry, [this.materials.mist, this.materials.mistSide], sand)
        group.add(sand)
        const land = new THREE.Group()
        const body = this.mesh(this.landGeometry('sand', 0), [this.materials.sand, this.materials.cliff], land)
        const terrace = this.mesh(this.landGeometry('grass', 0), [this.materials.grass, this.materials.grassSide], land)
        const plants = this.addGarden(land, index)
        group.add(land)
        const pin = this.mesh(pinGeometry, this.materials.brass, group, 0.33, 0.5, -0.33)
        const error = this.mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 32), material(0xff8a6b, { emissive: 0xc2452a, emissiveIntensity: 0.45, depthTest: false }), group, 0, 0.5, 0)
        error.rotation.x = Math.PI / 2
        error.renderOrder = 4
        error.castShadow = false
        error.visible = false
        this.cells.push({ row, col, group, target, sand, land, body, terrace, plants, pin, error, value: undefined, mask: -1, started: -10, reactionAt: -10, direction: new THREE.Vector2() })
      }
    }
  }

  addGarden(parent, index, decorative = false) {
    const group = new THREE.Group()
    group.rotation.y = seeded(index + 30) * Math.PI * 2
    parent.add(group)
    const variant = decorative ? 0 : Math.floor(seeded(index + 29) * 6)
    const top = LAND.grass.top
    group.userData.perchHeight = variant <= 1 ? 1.0 : variant === 2 ? 1.07 : variant === 3 ? 0.68 : 0.46
    if (variant <= 1) {
      // A round lollipop tree: the canopy casts the long, soft shadow that sells the height.
      const x = (seeded(index + 7) - 0.5) * 0.2, z = (seeded(index + 8) - 0.5) * 0.2
      this.mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 7), this.materials.trunk, group, x, top + 0.13, z)
      this.mesh(new THREE.IcosahedronGeometry(0.25, 2), variant ? this.materials.leafDark : this.materials.leaf, group, x, top + 0.42, z)
      this.mesh(new THREE.IcosahedronGeometry(0.1, 1), this.materials.leafLight, group, x - 0.09, top + 0.55, z - 0.08)
    } else if (variant === 2) {
      for (let i = 0; i < 3; i++) {
        const cone = this.mesh(new THREE.ConeGeometry(0.21 - i * 0.045, 0.26, 8), this.materials.leafDark, group, 0.02, top + 0.16 + i * 0.15, 0.02)
        cone.rotation.y = i * 0.6
      }
    } else if (variant === 3) {
      this.mesh(new THREE.IcosahedronGeometry(0.16, 2), this.materials.leaf, group, -0.08, top + 0.1, 0.04)
      this.mesh(new THREE.IcosahedronGeometry(0.12, 2), this.materials.leafLight, group, 0.12, top + 0.07, -0.06)
      this.addFlower(group, -0.02, top, -0.2, index)
    } else if (variant === 4) {
      for (let i = 0; i < 5; i++) this.addFlower(group, Math.cos(i * 2.4) * 0.2, top, Math.sin(i * 2.4) * 0.2, index + i)
    } else {
      const rock = this.mesh(new THREE.DodecahedronGeometry(0.13, 0), this.materials.rock, group, -0.1, top + 0.05, -0.06)
      rock.scale.set(1.3, 0.75, 1)
      for (let i = 0; i < 3; i++) this.addFlower(group, -0.16 + i * 0.16, top, 0.2, index + i)
    }
    this.mergeDetails(group)
    return group
  }

  addFlower(parent, x, y, z, index) {
    const head = [this.materials.flower, this.materials.blossom, this.materials.petal][index % 3]
    this.mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.07, 4), this.materials.leafDark, parent, x, y + 0.03, z)
    this.mesh(new THREE.IcosahedronGeometry(0.04, 1), head, parent, x, y + 0.075, z).scale.y = 0.6
  }

  mergeDetails(group) {
    const batches = new Map()
    // Nested groups stay separate so they can keep animating on their own.
    for (const child of group.children.filter((child) => child.isMesh)) {
      child.updateMatrix()
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
      geometry.applyMatrix4(child.matrix)
      const batch = batches.get(child.material) ?? []
      batch.push(geometry)
      batches.set(child.material, batch)
      group.remove(child)
      child.geometry.dispose()
    }
    for (const [mat, batch] of batches) {
      this.mesh(mergeGeometries(batch), mat, group)
      batch.forEach((geometry) => geometry.dispose())
    }
  }

  buildParticles() {
    this.particleMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.03, 0), material(0xffffff), 100)
    this.particleMesh.count = 0
    this.particleMesh.castShadow = false
    this.scene.add(this.particleMesh)
    this.particleDummy = new THREE.Object3D()
    for (let i = 0; i < 100; i++) this.particleMesh.setColorAt(i, new THREE.Color(0xffffff))
  }

  // Soft cloud shadows drift over the diorama now and then.
  buildClouds() {
    this.cloudMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vXZ; void main() { vXZ = (modelMatrix * vec4(position, 1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vXZ;
        uniform float uTime;
        float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
        }
        void main() {
          vec2 p = vXZ * 0.17 + vec2(uTime * 0.028, uTime * 0.011);
          float n = noise(p) * 0.6 + noise(p * 2.1 + 3.7) * 0.3 + noise(p * 4.3 + 9.1) * 0.1;
          float cloud = smoothstep(0.6, 0.74, n);
          vec2 edge = abs(vXZ) - ${(TRAY / 2 - 0.25).toFixed(2)};
          float inside = 1.0 - smoothstep(0.0, 0.25, max(edge.x, edge.y));
          gl_FragColor = vec4(0.06, 0.22, 0.38, cloud * inside * 0.15);
          #include <colorspace_fragment>
        }
      `,
    })
    const clouds = new THREE.Mesh(new THREE.PlaneGeometry(TRAY, TRAY).rotateX(-Math.PI / 2), this.cloudMaterial)
    clouds.position.y = 1.4
    clouds.renderOrder = 20
    this.scene.add(clouds)
  }

  createHover() {
    const group = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false })
    for (const [w, d, x, z] of [[0.92, 0.04, 0, -0.46], [0.92, 0.04, 0, 0.46], [0.04, 0.92, -0.46, 0], [0.04, 0.92, 0.46, 0]]) {
      const edge = this.mesh(new THREE.BoxGeometry(w, 0.01, d), mat, group, x, 0, z)
      edge.castShadow = false
      edge.renderOrder = 10
    }
    group.visible = false
    return group
  }

  buildBoardGuides() {
    this.guides = new THREE.Group()
    this.scene.add(this.guides)
    this.boundaryMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false })
    for (const [width, depth, x, z] of [[10.04, 0.04, 0, -5], [10.04, 0.04, 0, 5], [0.04, 10.04, -5, 0], [0.04, 10.04, 5, 0]]) {
      const line = this.mesh(new THREE.BoxGeometry(width, 0.004, depth), this.boundaryMaterial, this.guides, x, WATER_Y + 0.012, z)
      line.castShadow = false
      line.renderOrder = 3
    }
    this.crossMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 edge = abs(vUv - 0.5);
          float soft = (1.0 - smoothstep(0.4, 0.5, edge.x)) * (1.0 - smoothstep(0.4, 0.5, edge.y));
          gl_FragColor = vec4(1.0, 1.0, 0.97, soft * 0.26);
          #include <colorspace_fragment>
        }
      `,
    })
    this.crossTiles = this.cells.map((cell) => {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.crossMaterial)
      plane.rotation.x = -Math.PI / 2
      plane.position.set(cell.col - 4.5, 0.5, cell.row - 4.5)
      plane.visible = false
      plane.renderOrder = 2
      this.scene.add(plane)
      return plane
    })
  }

  cellHeight(cell) {
    const value = cell.value
    return value === 1 ? LAND.grass.top + 0.02 : value === null ? 0.13 : WATER_Y + 0.01
  }

  update(grid, clues, invalid, complete) {
    const hadGrid = !!this.grid && this.clues === clues
    if (!hadGrid) { this.clearSelection(); this.completions.clear() }
    const changed = this.cells.filter((cell) => grid[cell.row][cell.col] !== cell.value)
    this.grid = grid.map((row) => [...row])
    this.clues = clues
    this.complete = complete
    for (const cell of this.cells) {
      const value = grid[cell.row][cell.col]
      if (value !== cell.value) { cell.previous = cell.value; cell.started = this.time; cell.value = value }
      cell.sand.visible = value === null
      cell.land.visible = value === 1
      if (value === 1) {
        const mask = landMask(grid, cell.row, cell.col)
        if (mask !== cell.mask) {
          cell.mask = mask
          cell.body.geometry = this.landGeometry('sand', mask)
          cell.terrace.geometry = this.landGeometry('grass', mask)
        }
      }
      cell.pin.visible = clues[cell.row][cell.col] !== null
      cell.pin.position.y = this.cellHeight(cell) + 0.05
      cell.target.position.y = this.cellHeight(cell)
      cell.error.position.y = this.cellHeight(cell) + 0.03
      cell.error.visible = invalid.has(`${cell.row}:${cell.col}`)
      this.markTerrain(cell.col - 4.5, cell.row - 4.5, value === 0 ? 0 : 180)
    }
    if (changed.length) {
      this.rimTexture.image.data.set(createRimField(grid, LAND.sand))
      this.rimTexture.needsUpdate = true
      this.renderer.shadowMap.needsUpdate = true
    }
    this.waterLife.grid = this.grid
    const filled = grid.flat().filter((value) => value !== null).length
    this.daylightTarget = complete ? 1 : filled / 100
    if (!hadGrid) this.daylight = this.daylightTarget
    if (hadGrid && changed.length > 0 && changed.length <= 4) changed.forEach((cell) => this.react(cell))
    this.completions.update(grid, hadGrid && changed.length > 0 && changed.length <= 4)
    this.updateAccessibility()
    this.showHover(this.hoverCell)
  }

  react(origin) {
    if (this.reducedMotion) return
    const x = origin.col - 4.5, z = origin.row - 4.5
    this.ripples[this.rippleIndex].set(x, z, this.time, origin.value === 0 ? 1 : 0)
    this.rippleIndex = (this.rippleIndex + 1) % RIPPLE_COUNT
    const connected = new Set(connectedTerrain(this.grid, origin.row, origin.col).map((cell) => `${cell.row}:${cell.col}`))
    for (const cell of this.cells) {
      const dx = cell.col - origin.col, dz = cell.row - origin.row
      const distance = Math.hypot(dx, dz)
      if (distance > 2.6 || distance === 0) continue
      cell.reactionAt = this.time + distance * 0.095
      cell.direction.set(dx / distance, dz / distance)
      cell.reactionStrength = connected.has(`${cell.row}:${cell.col}`) ? 1 : 0.55
    }
    if (origin.value === 0) { this.waterLife.splash(x, z, this.time); return }
    for (let i = 0; i < 16; i++) {
      const angle = seeded(i + this.time) * Math.PI * 2
      const speed = 0.3 + seeded(i + 12) * 0.65
      this.particles.push({ x, z, height: this.cellHeight(origin), started: this.time, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, vy: 0.85 + seeded(i + 88) * 0.7, water: origin.value === 0 })
    }
    this.particles = this.particles.slice(-100)
  }

  updateAccessibility() {
    const overlay = this.container.querySelector('.board-access')
    if (!overlay) return
    this.cells.forEach((cell, index) => {
      const button = overlay.children[index]
      button.setAttribute('aria-label', `Row ${cell.row + 1}, column ${cell.col + 1}: ${cell.value === null ? 'undecided' : cell.value === 0 ? 'water' : 'land'}${this.clues[cell.row][cell.col] !== null ? ', fixed' : ''}`)
      button.disabled = this.clues[cell.row][cell.col] !== null || this.complete
    })
    this.positionAccess()
  }

  positionAccess() {
    const overlay = this.container.querySelector('.board-access')
    if (!overlay) return
    const { width, height } = this.container.getBoundingClientRect()
    const cellWidth = width / (this.camera.right - this.camera.left)
    this.cells.forEach((cell, index) => {
      const p = new THREE.Vector3(cell.col - 4.5, this.cellHeight(cell), cell.row - 4.5).project(this.camera)
      const button = overlay.children[index]
      button.style.left = `${(p.x + 1) * width / 2}px`
      button.style.top = `${(1 - p.y) * height / 2}px`
      button.style.width = `${cellWidth * 0.86}px`
      button.style.height = `${cellWidth * Math.cos(TILT) * 0.86}px`
    })
  }

  // Snap any point over the board to the cell beneath it, with a little grace past the outer edge.
  cellAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.ray.intersectPlane(this.aimPlane, this.aimPoint)
    if (!hit || Math.abs(hit.x) > 5.4 || Math.abs(hit.z) > 5.4) return null
    return { row: clamp(Math.floor(hit.z + 5), 0, 9), col: clamp(Math.floor(hit.x + 5), 0, 9) }
  }

  bindEvents() {
    const canvas = this.renderer.domElement
    const touches = new Set()
    let down = null, gesture = false
    const touchLike = (event) => event.pointerType === 'touch' || event.pointerType === 'pen'
    const endAim = () => {
      this.aim = null
      this.loupe.classList.remove('visible')
      this.showHover(null)
    }
    canvas.addEventListener('pointerdown', (event) => {
      if (!touchLike(event)) { down = { x: event.clientX, y: event.clientY }; return }
      touches.add(event.pointerId)
      if (touches.size > 1 || gesture) { gesture = true; endAim(); return }
      // Touch aims first and commits on lift, so a finger covering the cell never guesses.
      this.aim = { id: event.pointerId, x: event.clientX, y: event.clientY, cell: this.cellAt(event.clientX, event.clientY) }
      this.showHover(this.aim.cell)
    })
    canvas.addEventListener('pointermove', (event) => {
      if (!touchLike(event)) { this.showHover(this.cellAt(event.clientX, event.clientY)); return }
      if (this.aim?.id !== event.pointerId) return
      Object.assign(this.aim, { x: event.clientX, y: event.clientY, cell: this.cellAt(event.clientX, event.clientY) })
      this.showHover(this.aim.cell)
    })
    canvas.addEventListener('pointerleave', (event) => { if (!touchLike(event)) this.showHover(null) })
    canvas.addEventListener('pointerup', (event) => {
      if (!touchLike(event)) {
        const moved = !down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6
        down = null
        const cell = moved ? null : this.cellAt(event.clientX, event.clientY)
        if (cell) this.onCell(cell.row, cell.col)
        return
      }
      touches.delete(event.pointerId)
      const cell = this.aim?.id === event.pointerId && !gesture ? this.aim.cell : null
      if (this.aim?.id === event.pointerId) endAim()
      if (!touches.size) gesture = false
      if (cell) this.onCell(cell.row, cell.col)
    })
    canvas.addEventListener('pointercancel', (event) => {
      down = null
      touches.delete(event.pointerId)
      if (this.aim?.id === event.pointerId) endAim()
      if (!touches.size) gesture = false
    })
  }

  // A magnified view of the aimed cell, drawn just above the finger that hides it.
  renderLoupe() {
    const cell = this.aim?.cell
    if (!cell) { this.loupe.classList.remove('visible'); return }
    const rect = this.container.getBoundingClientRect()
    const half = LOUPE_SIZE / 2
    const x = clamp(this.aim.x - rect.left, half + 8, rect.width - half - 8)
    let y = this.aim.y - rect.top - 92
    if (y - half < 8) y = this.aim.y - rect.top + 92
    const left = Math.round(x - half), top = Math.round(y - half)
    const target = this.cells[cell.row * 10 + cell.col]
    const center = new THREE.Vector3(cell.col - 4.5, this.cellHeight(target), cell.row - 4.5)
    this.loupeCamera.quaternion.copy(this.camera.quaternion)
    this.loupeCamera.position.copy(this.camera.position).add(center)
    this.loupeCamera.updateMatrixWorld()
    this.renderer.setScissorTest(true)
    this.renderer.setScissor(left, rect.height - top - LOUPE_SIZE, LOUPE_SIZE, LOUPE_SIZE)
    this.renderer.setViewport(left, rect.height - top - LOUPE_SIZE, LOUPE_SIZE, LOUPE_SIZE)
    this.renderer.render(this.scene, this.loupeCamera)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, rect.width, rect.height)
    this.loupe.style.transform = `translate(${left}px, ${top}px)`
    this.loupe.classList.add('visible')
  }

  showHover(cell) {
    this.hoverCell = cell ? { row: cell.row, col: cell.col } : null
    const active = this.hoverCell ?? this.selectedCell
    this.activeCell = active
    this.hover.visible = !!active
    if (active) this.hover.position.set(active.col - 4.5, this.cellHeight(this.cells[active.row * 10 + active.col]) + 0.04, active.row - 4.5)
    this.crossTiles.forEach((plane, index) => {
      const target = this.cells[index]
      plane.visible = !!active && (target.row === active.row || target.col === active.col)
      plane.position.y = this.cellHeight(target) + 0.02
    })
    this.container.style.cursor = cell && this.clues?.[cell.row][cell.col] === null ? 'pointer' : 'default'
  }

  selectCell(cell) {
    this.selectedCell = cell ? { row: cell.row, col: cell.col } : null
    this.showHover(this.hoverCell)
  }

  clearSelection() {
    this.selectedCell = null
    this.showHover(null)
  }

  resetPresentation() {
    this.grid = null
    this.clearSelection()
    this.completions.clear()
  }

  cameraOffset() {
    return new THREE.Vector3(0, Math.cos(TILT) * 30, Math.sin(TILT) * 30)
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect()
    if (!width || !height) return
    this.mobile = width < 700
    const profile = renderProfile(width, devicePixelRatio, matchMedia('(pointer: coarse)').matches)
    this.renderer.setPixelRatio(profile.pixelRatio)
    if (profile.shadowSize !== this.profile.shadowSize) {
      this.sun.shadow.map?.dispose()
      this.sun.shadow.map = null
      this.sun.shadow.mapSize.set(profile.shadowSize, profile.shadowSize)
      this.renderer.shadowMap.needsUpdate = true
    }
    this.profile = profile
    // Fit the whole tray, plus the sliver of south cliff the tilt reveals, into the open band of the layout.
    const safe = this.safeArea?.() ?? { top: 0, bottom: height, left: 0, right: width }
    const boardWidth = TRAY + 0.1
    const boardDepth = TRAY * Math.cos(TILT) + 0.75 * Math.sin(TILT) + 0.1
    const unit = Math.max(boardWidth / Math.max(120, safe.right - safe.left), boardDepth / Math.max(120, safe.bottom - safe.top))
    this.camera.left = -width * unit / 2
    this.camera.right = width * unit / 2
    this.camera.top = height * unit / 2
    this.camera.bottom = -height * unit / 2
    this.camera.setViewOffset(width, height, width / 2 - (safe.left + safe.right) / 2, height / 2 - (safe.top + safe.bottom) / 2, width, height)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.positionAccess()
  }

  animate(time) {
    if (!frameIsDue(time, this.lastFrame, this.profile.maxFps, document.hidden)) return
    const delta = Math.min(0.1, (time - (Number.isFinite(this.lastFrame) ? this.lastFrame : time)) / 1000)
    this.lastFrame = scheduledFrameTime(time, this.lastFrame, this.profile.maxFps)
    this.time = time / 1000
    const motionTime = this.reducedMotion ? 0 : this.time
    this.waterUniforms.uTime.value = motionTime
    this.cloudMaterial.uniforms.uTime.value = motionTime
    this.waterRipples.animate(this.time, this.ripples)
    this.waterLife.update(this.time, delta, this.reducedMotion)
    const sunMoving = Math.abs(this.daylightTarget - this.daylight) > 0.0005
    if (sunMoving) {
      this.daylight = this.reducedMotion ? this.daylightTarget : this.daylight + (this.daylightTarget - this.daylight) * Math.min(1, delta * 1.6)
      this.placeSun(this.daylight)
    }
    for (const cell of this.cells) {
      const t = this.reducedMotion ? 1 : clamp((this.time - cell.started) / 0.7, 0, 1)
      // Land springs up past its height and settles; its shadow stretches out with it.
      const pop = 1 + Math.sin(t * Math.PI * 2.0) * (1 - t) * 0.16
      cell.land.scale.y = (0.08 + t * 0.92) * pop
      const age = this.time - cell.reactionAt
      const reaction = this.reducedMotion || age < 0 || age > 1.35 ? 0 : Math.sin(age * 10) * Math.exp(-age * 3.5) * (cell.reactionStrength ?? 0)
      cell.land.position.y = reaction * 0.05
      cell.sand.position.y = reaction * 0.02 + (this.reducedMotion ? 0 : Math.sin(motionTime * 1.3 + cell.row * 0.7 + cell.col * 1.1) * 0.012)
      cell.sand.scale.setScalar(0.6 + (1 - (1 - t) ** 3) * 0.4)
      // Whatever was there before sinks away under the new terrain.
      const sinking = this.reducedMotion ? 1 : (this.time - cell.started) / 0.4
      if (sinking < 1 && cell.previous === null && cell.value !== null) {
        cell.sand.visible = true
        cell.sand.position.y = -sinking * 0.16
        cell.sand.scale.set(1 - sinking * 0.3, 1, 1 - sinking * 0.3)
      } else cell.sand.visible = cell.value === null
      if (sinking < 1 && cell.previous === 1 && cell.value !== 1) {
        cell.land.visible = true
        cell.land.scale.y = Math.max(0.02, 1 - sinking * 1.1)
      } else cell.land.visible = cell.value === 1
      cell.plants.scale.setScalar(Math.max(0.001, clamp((this.time - cell.started - 0.25) / 0.5, 0, 1) ** 0.5 * (1 + Math.sin(t * Math.PI) * 0.15)))
      if (this.reducedMotion) cell.plants.scale.setScalar(1)
      cell.plants.rotation.x = cell.direction.y * reaction * 0.13 + Math.sin(motionTime * 0.9 + cell.col) * 0.006
      cell.plants.rotation.z = -cell.direction.x * reaction * 0.13
    }
    this.particles = this.particles.filter((particle) => this.time - particle.started < 0.85)
    this.particleMesh.count = this.particles.length
    this.particles.forEach((particle, index) => {
      const age = this.time - particle.started
      const scale = Math.max(0, 1 - age / 0.85)
      this.particleDummy.position.set(particle.x + particle.vx * age, Math.max(0.08, particle.height + particle.vy * age - 2.3 * age * age), particle.z + particle.vz * age)
      this.particleDummy.scale.set(scale, scale * (particle.water ? 1.6 : 0.6), scale)
      this.particleDummy.updateMatrix()
      this.particleMesh.setMatrixAt(index, this.particleDummy.matrix)
      this.particleMesh.setColorAt(index, new THREE.Color(particle.water ? COLORS.foam : COLORS.flower))
    })
    this.particleMesh.instanceMatrix.needsUpdate = true
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true
    this.completions.animate(this.time)
    this.crossTiles.forEach((plane, index) => {
      if (plane.visible) plane.position.y = this.cellHeight(this.cells[index]) + (this.cells[index].value === 1 ? this.cells[index].land.position.y : 0) + 0.02
    })
    if (this.activeCell) {
      const cell = this.cells[this.activeCell.row * 10 + this.activeCell.col]
      this.hover.position.y = this.cellHeight(cell) + (cell.value === 1 ? cell.land.position.y : 0) + 0.04
    }
    if (time - this.lastShadowFrame >= this.profile.shadowInterval) {
      this.renderer.shadowMap.needsUpdate = true
      this.lastShadowFrame = time
    }
    this.renderer.render(this.scene, this.camera)
    if (this.aim) this.renderLoupe()
    this.renderedFrames++
    this.container.dataset.rendered = 'true'
  }
}
