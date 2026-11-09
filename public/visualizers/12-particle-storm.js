/**
 * 12. PARTICLE STORM
 * Thousands of GPU-accelerated particles forming audio-reactive waves,
 * dimensional vortexes, and explosive radial shockwaves.
 */

class ParticleStormVisualizer extends VisualizerBase {
  constructor() {
    super('particle-storm', 'Particle Storm', 'Thousands of cosmic particles forming reactive waves & vortex formations');
  }

  setup() {
    this.camera.position.set(0, 0, 5.0);

    const count = this.quality === 'low' ? 3000 : (this.quality === 'medium' ? 7000 : 12000);
    this.count = count;

    this.positions = new Float32Array(count * 3);
    this.initialPos = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 3.8;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;

      this.initialPos[i * 3] = x;
      this.initialPos[i * 3 + 1] = y;
      this.initialPos[i * 3 + 2] = z;

      this.speeds[i] = 0.5 + Math.random() * 1.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('initialPos', new THREE.BufferAttribute(this.initialPos, 3));

    this.stormMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uBeat: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        attribute vec3 initialPos;
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform float uBeat;
        varying float vDist;
        varying float vEnergy;

        void main() {
          vec3 p = position;
          
          // Slow meditative cosmic vortex swirling
          float angle = atan(p.y, p.x);
          float dist = length(p.xy);
          
          // Gentle ambient swirl twist
          float twist = dist * 0.4 - uTime * (0.22 + uMid * 0.15);
          p.x = cos(angle + twist * 0.15) * dist;
          p.y = sin(angle + twist * 0.15) * dist;

          // Sculptural wave undulation along z
          p.z += sin(dist * 1.2 - uTime * 0.35) * (0.2 + uBass * 0.35);

          // Subtle breathing expansion on beat
          p += normalize(initialPos) * (uBeat * 0.18);

          vDist = length(p);
          vEnergy = uBass;

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (16.0 / -mvPosition.z) * (1.0 + uTreble * 1.5);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying float vDist;
        varying float vEnergy;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float d = length(coord) * 2.0;
          if (d > 1.0) discard;

          float alpha = pow(1.0 - d, 2.0);

          // Color gradient from center core outward
          vec3 coreCol = vec3(1.0, 0.95, 0.9);
          vec3 midCol = uAccentColor;
          vec3 edgeCol = vec3(0.0, 0.8, 1.0);

          vec3 col = mix(coreCol, midCol, smoothstep(0.5, 2.2, vDist));
          col = mix(col, edgeCol, smoothstep(2.0, 3.8, vDist));
          col += vec3(0.3, 0.7, 1.0) * (uTreble * 0.8);

          gl_FragColor = vec4(col, alpha * (0.8 + uBass * 0.2));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.stormMat);
    this.scene.add(this.points);
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0, beatDecay: 0 };

    this.stormMat.uniforms.uTime.value = time;
    this.stormMat.uniforms.uBass.value = a.bass || 0;
    this.stormMat.uniforms.uMid.value = a.mid || 0;
    this.stormMat.uniforms.uTreble.value = a.treble || 0;
    this.stormMat.uniforms.uBeat.value = a.beatDecay || 0;
    this.stormMat.uniforms.uAccentColor.value = this.getAccentColor();

    // Meditative slow cosmic drift
    this.points.rotation.y = time * 0.05;
    this.points.rotation.x = Math.sin(time * 0.04) * 0.08;

    this.camera.position.x = Math.sin(time * 0.05) * 0.3;
    this.camera.position.z = 5.0;
    this.camera.lookAt(0, 0, 0);

    super.render(a, delta, time);
  }
}

window.ParticleStormVisualizer = ParticleStormVisualizer;

