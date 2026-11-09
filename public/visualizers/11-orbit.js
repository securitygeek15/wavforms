/**
 * 11. ORBIT
 * A glowing central celestial body surrounded by multiple animated orbital rings,
 * orbiting planetary satellites, and solar flare particle dust.
 */

class OrbitVisualizer extends VisualizerBase {
  constructor() {
    super('orbit', 'Orbit', 'Glowing central celestial body with multi-axis orbital rings & trailing satellites');
  }

  setup() {
    this.camera.position.set(0, 1.8, 5.2);
    this.camera.lookAt(0, 0, 0);

    // 1. Central Pulsing Star Core
    const coreGeo = new THREE.SphereGeometry(0.85, 48, 48);
    this.coreMat = new THREE.ShaderMaterial({
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

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec3 pos = position + normal * (sin(position.x * 6.0 + uTime * 4.0) * (0.05 + uBass * 0.2));
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

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPos);
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.2);

          vec3 coreCol = mix(vec3(1.0, 0.95, 0.8), uAccentColor, 0.4);
          vec3 rimCol = mix(vec3(1.0, 0.4, 0.1), uAccentColor, 0.7);

          vec3 col = mix(coreCol, rimCol, fresnel);
          col += vec3(1.0) * fresnel * (1.2 + uBass * 1.8);
          col += vec3(0.5, 0.8, 1.0) * (uTreble * 0.8);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.core = new THREE.Mesh(coreGeo, this.coreMat);
    this.scene.add(this.core);

    // 2. Multi-axis Orbital Rings
    this.rings = [];
    this.satellites = [];
    const ringCount = 5;

    for (let r = 0; r < ringCount; r++) {
      const radius = 1.45 + r * 0.55;
      const ringGeo = new THREE.RingGeometry(radius, radius + 0.025, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x55eeff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending
      });

      const ring = new THREE.Mesh(ringGeo, ringMat);
      // Give each ring an individual astronomical inclination
      ring.rotation.x = Math.PI * 0.35 + (r * 0.4);
      ring.rotation.y = r * 0.5;
      this.scene.add(ring);
      this.rings.push(ring);

      // Add Satellite to each ring
      const satGeo = new THREE.SphereGeometry(0.08 + (r % 2) * 0.04, 16, 16);
      const satMat = new THREE.MeshBasicMaterial({
        color: (r % 2 === 0) ? 0xffffff : 0x00f0ff
      });
      const sat = new THREE.Mesh(satGeo, satMat);
      this.scene.add(sat);

      this.satellites.push({
        mesh: sat,
        ring,
        radius,
        angle: Math.random() * Math.PI * 2,
        speed: (0.8 + r * 0.3) * (r % 2 === 0 ? 1 : -1)
      });
    }

    // 3. Solar Dust Swarm
    const pCount = this.quality === 'low' ? 300 : 700;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const dist = 1.2 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pPos[i * 3] = dist * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = dist * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = dist * Math.cos(phi);
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    this.dust = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.035,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    }));
    this.scene.add(this.dust);
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    // Core shader & pulse (gentle solar breathing)
    this.coreMat.uniforms.uTime.value = time * 0.35;
    this.coreMat.uniforms.uBass.value = a.bass || 0;
    this.coreMat.uniforms.uTreble.value = a.treble || 0;
    this.coreMat.uniforms.uAccentColor.value = this.getAccentColor();

    const corePulse = 1.0 + (a.bass || 0) * 0.12;
    this.core.scale.set(corePulse, corePulse, corePulse);

    // Orbit rings and satellite positions (slow Keplerian harmony)
    const speedBoost = 0.38 + (a.mid || 0) * 0.22;
    for (let s of this.satellites) {
      s.angle += s.speed * delta * speedBoost;

      // Position along rotated ring plane
      const localX = Math.cos(s.angle) * s.radius;
      const localY = Math.sin(s.angle) * s.radius;
      const v = new THREE.Vector3(localX, localY, 0).applyEuler(s.ring.rotation);
      s.mesh.position.copy(v);

      // Pulse ring opacity with harmonics
      s.ring.material.opacity = 0.25 + (a.treble || 0) * 0.25;
      s.ring.material.color = this.getAccentColor();
    }

    this.dust.rotation.y = time * 0.02;

    // Slow astronomical camera orbit
    this.camera.position.x = Math.sin(time * 0.05) * 0.8;
    this.camera.position.z = 4.8 + Math.cos(time * 0.05) * 0.3;
    this.camera.lookAt(0, 0, 0);

    super.render(a, delta, time);
  }
}

window.OrbitVisualizer = OrbitVisualizer;

