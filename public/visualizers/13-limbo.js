/**
 * 13. LIMBO
 * Minimalist brutalist architectural monoliths rising from calm reflective dark water,
 * surrounded by atmospheric fog, dramatic cinematic spotlights, and sub-bass resonance.
 */

class LimboVisualizer extends VisualizerBase {
  constructor() {
    super('limbo', 'Limbo', 'Minimalist brutalist architectural monoliths in atmospheric fog & reflective water');
  }

  setup() {
    this.camera.position.set(0, 1.6, 6.0);
    this.camera.lookAt(0, 1.2, 0);

    // 1. Reflective Floor Plane
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform vec3 uAccentColor;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          float dist = length(vWorldPos.xz);
          float ripple = sin(dist * 3.0 - uTime * 2.0) * (uBass * 0.15);

          vec3 waterCol = vec3(0.02, 0.02, 0.035);
          float reflection = pow(1.0 - clamp(dist / 14.0, 0.0, 1.0), 2.0);

          vec3 col = waterCol + uAccentColor * reflection * 0.12 * (1.0 + uBass);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.floor = new THREE.Mesh(floorGeo, this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0;
    this.scene.add(this.floor);

    // 2. Brutalist Monolithic Slabs
    this.monoliths = [];
    const count = this.quality === 'low' ? 7 : (this.quality === 'medium' ? 12 : 18);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    this.monoMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uBass;
        uniform float uMid;
        uniform vec3 uAccentColor;
        varying vec3 vNormal;
        varying vec3 vViewPos;

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPos);

          // Brutalist concrete lighting
          vec3 L = normalize(vec3(1.0, 2.5, 1.5));
          float diff = max(dot(N, L), 0.0);
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

          vec3 concrete = mix(vec3(0.08, 0.09, 0.11), vec3(0.24, 0.25, 0.28), diff);
          concrete += uAccentColor * fresnel * (0.4 + uBass * 0.6);

          gl_FragColor = vec4(concrete, 1.0);
        }
      `
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(boxGeo, this.monoMat);

      const w = 0.6 + Math.random() * 0.8;
      const h = 2.0 + Math.random() * 3.5;
      const d = 0.6 + Math.random() * 0.8;
      mesh.scale.set(w, h, d);

      const angle = (i / count) * Math.PI * 2;
      const radius = 2.2 + (i % 3) * 1.4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius - 1.0;

      mesh.position.set(x, h / 2, z);
      mesh.userData = {
        baseY: h / 2,
        baseH: h,
        phase: i * 0.6,
        elevSpeed: 0.8 + Math.random() * 0.6
      };

      this.scene.add(mesh);
      this.monoliths.push(mesh);
    }

    // 3. Atmospheric Monolithic Beam / Light Shaft
    const beamGeo = new THREE.CylinderGeometry(0.8, 2.8, 12, 24, 1, true);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform vec3 uAccentColor;
        varying vec2 vUv;

        void main() {
          float falloff = pow(1.0 - vUv.y, 2.0);
          float beam = sin(vUv.x * 12.0 + uTime * 0.8) * 0.5 + 0.5;
          vec3 col = mix(vec3(0.8, 0.85, 0.95), uAccentColor, 0.4);
          gl_FragColor = vec4(col, beam * falloff * (0.2 + uBass * 0.35));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.lightBeam = new THREE.Mesh(beamGeo, this.beamMat);
    this.lightBeam.position.set(0, 5, -2);
    this.scene.add(this.lightBeam);
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, subBass: 0, mid: 0 };

    this.floorMat.uniforms.uTime.value = time * 0.3;
    this.floorMat.uniforms.uBass.value = a.bass || 0;
    this.floorMat.uniforms.uAccentColor.value = this.getAccentColor();

    this.monoMat.uniforms.uTime.value = time * 0.3;
    this.monoMat.uniforms.uBass.value = a.bass || 0;
    this.monoMat.uniforms.uMid.value = a.mid || 0;
    this.monoMat.uniforms.uAccentColor.value = this.getAccentColor();

    this.beamMat.uniforms.uTime.value = time * 0.3;
    this.beamMat.uniforms.uBass.value = a.bass || 0;
    this.beamMat.uniforms.uAccentColor.value = this.getAccentColor();

    // Slabs elevate gracefully with sub-bass resonance (architectural majesty)
    for (let m of this.monoliths) {
      const u = m.userData;
      const elevation = Math.sin(time * (u.elevSpeed * 0.4) + u.phase) * 0.15 + ((a.subBass || 0) * 0.35);
      m.position.y = u.baseY + elevation;
    }

    // Slow monumental architectural camera pan
    this.camera.position.x = Math.sin(time * 0.04) * 1.0;
    this.camera.position.y = 1.6 + Math.cos(time * 0.05) * 0.15;
    this.camera.position.z = 6.0 + Math.cos(time * 0.04) * 0.3;
    this.camera.lookAt(0, 1.2, 0);

    super.render(a, delta, time);
  }
}

window.LimboVisualizer = LimboVisualizer;

