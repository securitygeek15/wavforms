/**
 * 09. GLASS DIMENSION
 * Floating translucent geometric glass crystals and cubes in zero gravity,
 * featuring chromatic dispersion, realistic internal refraction, and audio-reactive rotation.
 */

class GlassDimensionVisualizer extends VisualizerBase {
  constructor() {
    super('glass-dimension', 'Glass Dimension', 'Floating translucent glass structures with chromatic dispersion & refraction');
  }

  setup() {
    this.camera.position.set(0, 0, 5.2);

    this.cubes = [];
    const count = this.quality === 'low' ? 8 : (this.quality === 'medium' ? 16 : 24);

    // Custom Glass Shader with Chromatic Dispersion
    this.glassMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPosition);

          // Fresnel reflection
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

          // Refraction with simulated RGB chromatic dispersion
          vec3 R_r = refract(-V, N, 0.65);
          vec3 R_g = refract(-V, N, 0.67);
          vec3 R_b = refract(-V, N, 0.70);

          // Simulated studio environment lights
          vec3 l1 = normalize(vec3(2.0, 3.0, 2.0));
          vec3 l2 = normalize(vec3(-2.5, -2.0, 1.0));

          float spec1 = pow(max(dot(reflect(-l1, N), V), 0.0), 32.0);
          float spec2 = pow(max(dot(reflect(-l2, N), V), 0.0), 16.0);

          // Chromatic dispersion color channels
          vec3 refractionColor = vec3(
            sin(R_r.x * 2.0 + uTime) * 0.5 + 0.5,
            sin(R_g.y * 2.0 + uTime + 2.0) * 0.5 + 0.5,
            sin(R_b.z * 2.0 + uTime + 4.0) * 0.5 + 0.5
          ) * 0.45;

          vec3 glassBase = mix(vec3(0.05, 0.07, 0.1), uAccentColor, 0.25 + uBass * 0.3);
          vec3 finalColor = glassBase + refractionColor;

          // Specular gleam & Fresnel rim
          finalColor += spec1 * vec3(1.0) * (1.0 + uTreble * 1.5);
          finalColor += spec2 * uAccentColor * 0.8;
          finalColor += fresnel * mix(vec3(0.9, 0.95, 1.0), uAccentColor, 0.6) * (1.2 + uBass * 1.2);

          gl_FragColor = vec4(finalColor, 0.65 + fresnel * 0.35);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const octaGeo = new THREE.OctahedronGeometry(0.8);

    for (let i = 0; i < count; i++) {
      const geo = (i % 3 === 0) ? octaGeo : boxGeo;
      const mesh = new THREE.Mesh(geo, this.glassMat);

      const radius = 1.2 + Math.random() * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      mesh.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      const s = 0.35 + Math.random() * 0.55;
      mesh.scale.set(s, s, s);

      mesh.userData = {
        basePos: mesh.position.clone(),
        rotSpeedX: (Math.random() - 0.5) * 1.2,
        rotSpeedY: (Math.random() - 0.5) * 1.2,
        rotSpeedZ: (Math.random() - 0.5) * 1.2,
        floatPhase: Math.random() * Math.PI * 2,
        floatSpeed: 0.8 + Math.random() * 0.8,
        baseScale: s
      };

      this.scene.add(mesh);
      this.cubes.push(mesh);
    }
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    this.glassMat.uniforms.uTime.value = time * 0.4;
    this.glassMat.uniforms.uBass.value = a.bass || 0;
    this.glassMat.uniforms.uMid.value = a.mid || 0;
    this.glassMat.uniforms.uTreble.value = a.treble || 0;
    this.glassMat.uniforms.uAccentColor.value = this.getAccentColor();

    for (let c of this.cubes) {
      const u = c.userData;

      // Zero-g slow meditative prism tumbling
      const speedMult = 0.45 + (a.mid || 0) * 0.35;
      c.rotation.x += u.rotSpeedX * speedMult * delta;
      c.rotation.y += u.rotSpeedY * speedMult * delta;
      c.rotation.z += u.rotSpeedZ * speedMult * delta;

      // Gentle floating undulation
      const floatOffset = Math.sin(time * (u.floatSpeed * 0.5) + u.floatPhase) * 0.12;
      c.position.y = u.basePos.y + floatOffset;

      // Subtle volumetric breathing on bass
      const pulse = 1.0 + (a.bass || 0) * 0.10;
      c.scale.set(u.baseScale * pulse, u.baseScale * pulse, u.baseScale * pulse);
    }

    // Camera slow architectural orbit
    this.camera.position.x = Math.sin(time * 0.05) * 0.4;
    this.camera.position.y = Math.cos(time * 0.06) * 0.3;
    this.camera.lookAt(0, 0, 0);

    super.render(a, delta, time);
  }
}

window.GlassDimensionVisualizer = GlassDimensionVisualizer;

