/**
 * 08. SMOKE
 * Volumetric fluid smoke simulation with particle clouds.
 * Bass creates explosive expansion bursts; treble generates fine curl turbulence.
 */

class SmokeVisualizer extends VisualizerBase {
  constructor() {
    super('smoke', 'Smoke', 'Volumetric fluid smoke simulation with audio-reactive turbulence & expansion shockwaves');
  }

  setup() {
    this.camera.position.set(0, 0, 5.0);

    const count = this.quality === 'low' ? 600 : (this.quality === 'medium' ? 1400 : 2200);
    this.pCount = count;

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.scales = new Float32Array(count);
    this.lifetimes = new Float32Array(count);
    this.maxLifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.resetParticle(i, true);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('scale', new THREE.BufferAttribute(this.scales, 1));
    geo.setAttribute('life', new THREE.BufferAttribute(this.lifetimes, 1));

    this.smokeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uTreble: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        attribute float scale;
        attribute float life;
        uniform float uTime;
        uniform float uBass;
        varying float vLife;
        varying vec3 vWorldPos;

        void main() {
          vLife = life;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

          // Point size scales with particle life and bass punch
          gl_PointSize = scale * (60.0 / -mvPosition.z) * (1.0 + uBass * 0.8);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying float vLife;
        varying vec3 vWorldPos;

        void main() {
          // Soft radial falloff for volumetric smoke puff
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord) * 2.0;
          if (dist > 1.0) discard;

          float alpha = pow(1.0 - dist, 2.2);

          // Fade in at birth, fade out at death
          float lifeAlpha = sin(vLife * 3.14159);

          // Dual-tone cinematic smoke: deep indigo/violet in core, accent on rim
          vec3 coreSmoke = vec3(0.08, 0.09, 0.14);
          vec3 rimSmoke = mix(vec3(0.2, 0.4, 0.6), uAccentColor, 0.5 + uBass * 0.5);
          vec3 color = mix(coreSmoke, rimSmoke, smoothstep(0.2, 0.8, dist) + uTreble * 0.4);

          gl_FragColor = vec4(color, alpha * lifeAlpha * (0.35 + uBass * 0.35));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.smokeMat);
    this.scene.add(this.points);
  }

  resetParticle(i, initial = false) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.6;
    
    this.positions[i * 3] = Math.cos(angle) * r;
    this.positions[i * 3 + 1] = -1.8 + (initial ? Math.random() * 3.5 : 0);
    this.positions[i * 3 + 2] = Math.sin(angle) * r;

    this.velocities[i * 3] = (Math.random() - 0.5) * 0.4;
    this.velocities[i * 3 + 1] = 0.6 + Math.random() * 1.2;
    this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

    this.scales[i] = 2.0 + Math.random() * 3.5;
    this.lifetimes[i] = initial ? Math.random() : 0.0;
    this.maxLifetimes[i] = 2.5 + Math.random() * 2.5;
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    this.smokeMat.uniforms.uTime.value = time * 0.35;
    this.smokeMat.uniforms.uBass.value = a.bass || 0;
    this.smokeMat.uniforms.uTreble.value = a.treble || 0;
    this.smokeMat.uniforms.uAccentColor.value = this.getAccentColor();

    const pos = this.points.geometry.attributes.position.array;
    const lifeArr = this.points.geometry.attributes.life.array;

    // Gentle slow incense curl dynamics (zero explosive jitter)
    const bassBurst = (a.bass || 0) * 0.35;
    const trebleCurl = 1.0 + (a.treble || 0) * 0.25;

    for (let i = 0; i < this.pCount; i++) {
      this.lifetimes[i] += (delta * 0.5) / this.maxLifetimes[i];

      if (this.lifetimes[i] >= 1.0) {
        this.resetParticle(i);
        pos[i * 3] = this.positions[i * 3];
        pos[i * 3 + 1] = this.positions[i * 3 + 1];
        pos[i * 3 + 2] = this.positions[i * 3 + 2];
      } else {
        // Slow volumetric laminar flow turbulence
        const px = pos[i * 3];
        const py = pos[i * 3 + 1];
        const pz = pos[i * 3 + 2];

        const curlX = Math.sin(py * 1.2 + time * 0.4) * 0.12 * trebleCurl;
        const curlZ = Math.cos(py * 1.2 + time * 0.4) * 0.12 * trebleCurl;

        pos[i * 3] += (this.velocities[i * 3] * 0.45 + curlX + Math.sign(px) * bassBurst * 0.02) * delta;
        pos[i * 3 + 1] += (this.velocities[i * 3 + 1] * 0.45 + bassBurst * 0.12) * delta;
        pos[i * 3 + 2] += (this.velocities[i * 3 + 2] * 0.45 + curlZ + Math.sign(pz) * bassBurst * 0.02) * delta;
      }

      lifeArr[i] = this.lifetimes[i];
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.life.needsUpdate = true;

    // Meditative slow drift rotation
    this.points.rotation.y = time * 0.04;

    super.render(a, delta, time);
  }
}

window.SmokeVisualizer = SmokeVisualizer;

