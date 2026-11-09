/**
 * 05. ABYSS
 * A deep bioluminescent ocean environment featuring translucent glowing jellyfish,
 * undulating tentacles, floating marine snow particles, and caustic light rays.
 */

class AbyssVisualizer extends VisualizerBase {
  constructor() {
    super('abyss', 'Abyss', 'Deep bioluminescent ocean with pulsing translucent jellyfish & caustic light rays');
  }

  setup() {
    this.camera.position.set(0, 0, 5.0);

    // 1. Create Jellyfish Fleet
    this.jellyfish = [];
    const count = this.quality === 'low' ? 3 : (this.quality === 'medium' ? 5 : 7);

    for (let j = 0; j < count; j++) {
      const jelly = this.createJellyfish(j);
      this.scene.add(jelly);
      this.jellyfish.push(jelly);
    }

    // 2. Bioluminescent Marine Snow / Plankton Swarm
    const pCount = this.quality === 'low' ? 500 : 1200;
    const pGeo = new THREE.BufferGeometry();
    this.plankton = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      this.plankton[i * 3] = (Math.random() - 0.5) * 10;
      this.plankton[i * 3 + 1] = (Math.random() - 0.5) * 8;
      this.plankton[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.plankton, 3));
    this.planktonMat = new THREE.PointsMaterial({
      color: 0x44ffdd,
      size: 0.04,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    this.planktonSystem = new THREE.Points(pGeo, this.planktonMat);
    this.scene.add(this.planktonSystem);

    // 3. Volumetric Downward Caustic Light Shafts
    const rayGeo = new THREE.CylinderGeometry(0.2, 1.8, 8, 16, 1, true);
    this.rayMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uTreble: { value: 0 },
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
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying vec2 vUv;

        void main() {
          float ray = sin(vUv.x * 24.0 + uTime * 1.5) * 0.5 + 0.5;
          float falloff = (1.0 - vUv.y) * 0.45;
          vec3 col = mix(vec3(0.0, 0.4, 0.6), uAccentColor, 0.35 + uBass * 0.3);
          col += vec3(0.2, 0.6, 0.8) * (uTreble * 0.8);
          gl_FragColor = vec4(col, ray * falloff * (0.3 + uBass * 0.4));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.causticRays = new THREE.Mesh(rayGeo, this.rayMat);
    this.causticRays.position.set(0, 1.5, -2);
    this.scene.add(this.causticRays);
  }

  createJellyfish(index) {
    const group = new THREE.Group();

    // Bell (Hemisphere)
    const bellGeo = new THREE.SphereGeometry(0.7, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const bellMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uTreble: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uBass;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Bell pulsing contraction (squash & stretch propulsion)
          float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
          float contract = pulse * (0.2 + uBass * 0.5);
          pos.x *= (1.0 - contract * 0.3);
          pos.z *= (1.0 - contract * 0.3);
          pos.y *= (1.0 + contract * 0.4);

          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          vViewPos = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec2 vUv;

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPos);

          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.2);

          // Translucent bioluminescent blue-cyan with accent rim
          vec3 innerGlow = mix(vec3(0.05, 0.45, 0.7), uAccentColor, 0.4);
          vec3 rimGlow = mix(vec3(0.3, 0.95, 1.0), uAccentColor, 0.7);

          vec3 color = mix(innerGlow, rimGlow, fresnel);
          color += vec3(0.5, 0.9, 1.0) * (uTreble * 0.6);

          float alpha = (fresnel * 0.75 + 0.22) * (0.8 + uBass * 0.4);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const bell = new THREE.Mesh(bellGeo, bellMat);
    group.add(bell);

    // Tentacles (Ribbon strips)
    const tentacleCount = 8;
    const tentacles = [];
    for (let t = 0; t < tentacleCount; t++) {
      const angle = (t / tentacleCount) * Math.PI * 2;
      const tGeo = new THREE.PlaneGeometry(0.06, 1.8, 1, 32);
      const tMat = new THREE.MeshBasicMaterial({
        color: 0x55eeff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const tentacle = new THREE.Mesh(tGeo, tMat);
      tentacle.position.set(Math.cos(angle) * 0.45, -0.9, Math.sin(angle) * 0.45);
      tentacle.userData = { angle, phase: Math.random() * Math.PI * 2 };
      group.add(tentacle);
      tentacles.push(tentacle);
    }

    // Set position in deep waters
    const x = (index === 0) ? 0 : (Math.random() - 0.5) * 6.0;
    const y = (index === 0) ? 0.3 : (Math.random() - 0.5) * 4.0;
    const z = (index === 0) ? 0 : -1.0 - Math.random() * 3.5;
    const scale = (index === 0) ? 1.3 : 0.6 + Math.random() * 0.6;

    group.position.set(x, y, z);
    group.scale.set(scale, scale, scale);

    group.userData = {
      baseY: y,
      baseX: x,
      phase: index * 1.3,
      speed: 0.38 + Math.random() * 0.15, // slow, hypnotic deep-sea breathing
      bell,
      tentacles
    };

    return group;
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    // Update light rays (slow ambient underwater shafts)
    this.rayMat.uniforms.uTime.value = time * 0.35;
    this.rayMat.uniforms.uBass.value = a.bass || 0;
    this.rayMat.uniforms.uTreble.value = a.treble || 0;
    this.rayMat.uniforms.uAccentColor.value = this.getAccentColor();

    // Animate each jellyfish with meditative fluid buoyancy
    for (let j of this.jellyfish) {
      const u = j.userData;
      const pulseTime = time * u.speed + u.phase;
      const pulseCycle = Math.sin(pulseTime);

      // Propulsion: slow graceful expansion & contraction
      const propulsion = Math.max(0, pulseCycle) * (0.25 + (a.bass || 0) * 0.35);
      j.position.y = u.baseY + Math.sin(pulseTime * 0.5) * 0.35 + propulsion * 0.25;
      j.position.x = u.baseX + Math.sin(time * 0.15 + u.phase) * 0.2;

      // Bell shader uniforms
      u.bell.material.uniforms.uTime.value = pulseTime * 0.6;
      u.bell.material.uniforms.uBass.value = a.bass || 0;
      u.bell.material.uniforms.uTreble.value = a.treble || 0;
      u.bell.material.uniforms.uAccentColor.value = this.getAccentColor();

      // Tentacle gentle waving physics
      for (let t of u.tentacles) {
        const tPos = t.geometry.attributes.position;
        for (let i = 0; i < tPos.count; i++) {
          const y = tPos.getY(i);
          const wave = Math.sin(-y * 1.6 + pulseTime * 1.2 + t.userData.phase) * (0.08 + (a.bass || 0) * 0.08);
          tPos.setX(i, wave);
        }
        tPos.needsUpdate = true;
      }

      j.rotation.z = Math.sin(time * 0.18 + u.phase) * 0.06;
    }

    // Marine snow floating particles (subtle slow drift)
    const pArr = this.planktonSystem.geometry.attributes.position.array;
    for (let i = 0; i < this.plankton.length / 3; i++) {
      pArr[i * 3 + 1] += (Math.sin(time * 0.4 + i) * 0.04 - 0.06) * delta;
      if (pArr[i * 3 + 1] < -4) pArr[i * 3 + 1] = 4;
    }
    this.planktonSystem.geometry.attributes.position.needsUpdate = true;

    // Slow deep ocean camera drift
    this.camera.position.x = Math.sin(time * 0.05) * 0.3;
    this.camera.position.y = Math.cos(time * 0.06) * 0.18;

    super.render(a, delta, time);
  }
}

window.AbyssVisualizer = AbyssVisualizer;

