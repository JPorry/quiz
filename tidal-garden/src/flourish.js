import * as THREE from 'three'

const SPEED = 9
const DURATION = 1.6
const HEIGHT = 0.47

// When a row or column clicks into place, a soft gleam runs out along it from the tile
// that finished it, and the tiles it passes give a little bounce.
export class LineFlourish {
  constructor(garden) {
    this.garden = garden
    this.active = []
    this.geometry = new THREE.PlaneGeometry(10, 0.94).rotateX(-Math.PI / 2)
    this.pool = Array.from({ length: 4 }, () => {
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false,
        // Light is added without touching alpha, like the finale's glows.
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
        uniforms: { uAge: { value: 0 }, uOrigin: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uAge;
          uniform float uOrigin;
          void main() {
            float along = vUv.x * 10.0;
            float distance = abs(along - uOrigin);
            float front = uAge * ${SPEED.toFixed(1)};
            // A bright crest leads, leaving a soft wash behind it that fades away.
            float crest = exp(-pow((distance - front) / 0.45, 2.0));
            float wash = (1.0 - smoothstep(front - 0.4, front + 0.2, distance)) * 0.1;
            float across = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
            float ends = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
            float fade = 1.0 - smoothstep(${(DURATION * 0.45).toFixed(2)}, ${DURATION.toFixed(2)}, uAge);
            float glow = (crest * 0.42 + wash) * across * ends * fade;
            gl_FragColor = vec4(vec3(1.0, 0.92, 0.7) * glow, 0.0);
            #include <colorspace_fragment>
          }
        `,
      })
      const mesh = new THREE.Mesh(this.geometry, material)
      mesh.renderOrder = 22
      mesh.visible = false
      garden.scene.add(mesh)
      return mesh
    })
  }

  start(lines, origin, time) {
    const garden = this.garden
    for (const { axis, index } of lines) {
      const mesh = this.pool.find((candidate) => !candidate.visible) ?? this.active.shift()?.mesh
      if (!mesh) continue
      const row = axis === 'row'
      mesh.position.set(row ? 0 : index - 4.5, HEIGHT, row ? index - 4.5 : 0)
      mesh.rotation.y = row ? 0 : -Math.PI / 2
      // Measured in cells along the strip, which runs west to east or north to south.
      mesh.material.uniforms.uOrigin.value = (row ? origin.col : origin.row) + 0.5
      mesh.visible = true
      this.active.push({ mesh, started: time })
      for (let step = 0; step < 10; step++) {
        const cell = garden.cells[row ? index * 10 + step : step * 10 + index]
        const offset = step - (row ? origin.col : origin.row)
        if (cell.reactionAt > time && cell.reactionAt - time < 0.3) continue
        cell.reactionAt = time + 0.04 + Math.abs(offset) / SPEED
        cell.direction.set(row ? Math.sign(offset) : 0, row ? 0 : Math.sign(offset))
        cell.reactionStrength = 0.6
      }
    }
  }

  update(time) {
    this.active = this.active.filter((flourish) => {
      const age = flourish.hold ?? time - flourish.started
      flourish.mesh.material.uniforms.uAge.value = age
      if (age < DURATION) return true
      flourish.mesh.visible = false
      return false
    })
  }

  get count() { return this.active.length }
}
