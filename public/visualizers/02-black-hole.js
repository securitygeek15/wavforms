/**
 * 02. BLACK HOLE
 * A cinematic black hole with glowing relativistic accretion disk,
 * gravitational lensing Einstein ring, and particle event horizon trails.
 */

class BlackHoleVisualizer extends VisualizerBase {
  constructor() {
    super('black-hole', 'Black Hole', 'Relativistic singularity with glowing accretion disk & gravitational lensing');
  }

  setup() {
    this.camera.position.set(0, 1.8, 4.8);
    this.camera.lookAt(0, 0, 0);

    // 1. Central Event Horizon (pure black sphere absorbing all light)
    const horizonGeo = new THREE.SphereGeometry(1.0, 48, 48);
    const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.horizon = new THREE.Mesh(horizonGeo, horizonMat);
    this.scene.add(this.horizon);

    // 2. Gravitational Lensing Einstein Ring (Glowing halo warped around horizon)
    const haloGeo = new THREE.RingGeometry(1.02, 1.35, 64);
    this.haloMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uTreble: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying vec2 vUv;
        varying vec3 vPos;

        void main() {
          float dist = length(vPos.xy);
          // Sharp inner boundary at event horizon, soft glowing outer falloff
          float ring = smoothstep(1.02, 1.08, dist) * (1.0 - smoothstep(1.08, 1.35, dist));
          
          vec3 photonGlow = mix(vec3(1.0, 0.9, 0.7), uAccentColor, 0.4);
          photonGlow += vec3(0.3, 0.7, 1.0) * (uTreble * 1.5);
          
          float alpha = ring * (1.4 + uBass * 1.8);
          gl_FragColor = vec4(photonGlow, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.halo = new THREE.Mesh(haloGeo, this.haloMat);
    this.scene.add(this.halo);

    // 3. Relativistic Accretion Disk (Tilted swirling disk with Doppler beaming)
    const diskGeo = new THREE.RingGeometry(1.15, 3.8, 96, 32);
    this.diskMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uBass;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec3 pos = position;
          
          // Subtle vertical disk warp from frame dragging (slow cosmic pacing)
          float angle = atan(pos.y, pos.x);
          float dist = length(pos.xy);
          pos.z += sin(angle * 2.0 + uTime * 0.4) * (0.04 + uBass * 0.08) * (dist * 0.3);

          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          float dist = length(vWorldPos.xz);
          float normDist = clamp((dist - 1.15) / 2.65, 0.0, 1.0);

          // Swirling plasma streaks (smooth meditative fluid accretion)
          float angle = atan(vWorldPos.z, vWorldPos.x);
          float spiral = sin(angle * 6.0 - normDist * 16.0 + uTime * 0.7);
          float turbulence = sin(angle * 10.0 + uTime * 0.9) * 0.5 + 0.5;

          // Relativistic Doppler beaming (approaching side is brighter and hotter)
          float doppler = smoothstep(-1.0, 1.0, -vWorldPos.x * 0.5) * 0.6 + 0.4;

          // Thermal plasma color gradient (White hot core -> gold -> violet/crimson edge)
          vec3 hotCore = vec3(1.0, 0.98, 0.92);
          vec3 midPlasma = mix(vec3(1.0, 0.55, 0.15), uAccentColor, 0.65);
          vec3 coolEdge = vec3(0.2, 0.05, 0.4);

          vec3 color = mix(hotCore, midPlasma, normDist * 0.7);
          color = mix(color, coolEdge, pow(normDist, 2.0));
          color += spiral * 0.25 * (1.0 + uTreble * 1.5);
          color *= doppler * (1.2 + uBass * 1.8);

          // Disk opacity curve
          float alpha = (1.0 - normDist) * (0.7 + turbulence * 0.3) * (0.8 + uMid * 1.2);
          alpha = clamp(alpha, 0.0, 1.0);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.disk = new THREE.Mesh(diskGeo, this.diskMat);
    this.disk.rotation.x = Math.PI / 2.6; // Cinematic tilt
    this.scene.add(this.disk);

    // 4. Infalling Particle Spiral Swarm
    const pCount = this.quality === 'low' ? 600 : (this.quality === 'medium' ? 1200 : 2000);
    this.particles = new Float32Array(pCount * 3);
    this.pSpeeds = new Float32Array(pCount);
    this.pAngles = new Float32Array(pCount);
    this.pRadii = new Float32Array(pCount);

    for (let i = 0; i < pCount; i++) {
      this.pRadii[i] = 1.2 + Math.random() * 3.5;
      this.pAngles[i] = Math.random() * Math.PI * 2;
      this.pSpeeds[i] = 0.5 + Math.random() * 1.5;

      this.particles[i * 3] = Math.cos(this.pAngles[i]) * this.pRadii[i];
      this.particles[i * 3 + 1] = (Math.random() - 0.5) * 0.35 * this.pRadii[i];
      this.particles[i * 3 + 2] = Math.sin(this.pAngles[i]) * this.pRadii[i];
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particles, 3));
    this.pMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    this.pSystem = new THREE.Points(pGeo, this.pMat);
    this.pSystem.rotation.x = this.disk.rotation.x;
    this.scene.add(this.pSystem);
  }

  render(audio, delta, time) {
    if (!this.disk) return;

    // Majestic slow rotation with gentle bass swell
    const rotSpeed = (0.12 + (audio ? audio.bass || 0 : 0) * 0.16) * delta;
    this.disk.rotation.z += rotSpeed;
    this.halo.lookAt(this.camera.position);

    const a = audio || { bass: 0, mid: 0, treble: 0 };

    // Shader uniforms
    this.diskMat.uniforms.uTime.value = time;
    this.diskMat.uniforms.uBass.value = a.bass || 0;
    this.diskMat.uniforms.uMid.value = a.mid || 0;
    this.diskMat.uniforms.uTreble.value = a.treble || 0;
    this.diskMat.uniforms.uAccentColor.value = this.getAccentColor();

    this.haloMat.uniforms.uTime.value = time;
    this.haloMat.uniforms.uBass.value = a.bass || 0;
    this.haloMat.uniforms.uTreble.value = a.treble || 0;
    this.haloMat.uniforms.uAccentColor.value = this.getAccentColor();

    // Infalling spiral physics for particles (gentle Keplerian drift)
    const positions = this.pSystem.geometry.attributes.position.array;
    const count = this.pRadii.length;
    const accel = 1.0 + (a.bass || 0) * 0.4;

    for (let i = 0; i < count; i++) {
      this.pRadii[i] -= delta * 0.10 * accel * (2.0 / this.pRadii[i]);
      this.pAngles[i] += delta * this.pSpeeds[i] * (1.2 / this.pRadii[i]) * accel;

      // Reset when swallowed by event horizon
      if (this.pRadii[i] < 1.02) {
        this.pRadii[i] = 3.6 + Math.random() * 1.2;
        this.pAngles[i] = Math.random() * Math.PI * 2;
      }

      positions[i * 3] = Math.cos(this.pAngles[i]) * this.pRadii[i];
      positions[i * 3 + 1] = Math.sin(time * 0.6 + i) * 0.05 * (this.pRadii[i] - 1.0);
      positions[i * 3 + 2] = Math.sin(this.pAngles[i]) * this.pRadii[i];
    }
    this.pSystem.geometry.attributes.position.needsUpdate = true;

    // Cinematic Steadicam orbit drift (zero camera shake)
    this.camera.position.x = Math.sin(time * 0.06) * 0.5;
    this.camera.position.y = 1.6 + Math.cos(time * 0.08) * 0.2;
    this.camera.lookAt(0, 0, 0);

    super.render(a, delta, time);
  }
}

window.BlackHoleVisualizer = BlackHoleVisualizer;

