/**
 * 03. NEON RIBBON
 * Multiple flowing, undulating neon ribbons moving through a dark 3D environment.
 * Ribbon amplitude, thickness and twists respond dynamically to frequency bands.
 */

class NeonRibbonVisualizer extends VisualizerBase {
  constructor() {
    super('neon-ribbon', 'Neon Ribbon', 'Flowing neon curves undulating through 3D space with harmonic frequency twists');
  }

  setup() {
    this.camera.position.set(0, 0, 5.5);

    this.ribbonCount = this.quality === 'low' ? 3 : (this.quality === 'medium' ? 5 : 7);
    this.segments = this.quality === 'low' ? 64 : 120;
    this.ribbons = [];

    const baseColors = [
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0xff0055), // Hot Crimson
      new THREE.Color(0x8a2be2), // Electric Violet
      new THREE.Color(0xffaa00), // Amber Gold
      new THREE.Color(0x00ff88), // Emerald Neon
      new THREE.Color(0xff00aa), // Magenta
      new THREE.Color(0x4488ff)  // Deep Blue
    ];

    for (let r = 0; r < this.ribbonCount; r++) {
      const geo = new THREE.PlaneGeometry(8.0, 0.45, this.segments, 2);
      
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIndex: { value: r },
          uBass: { value: 0 },
          uMid: { value: 0 },
          uTreble: { value: 0 },
          uColor1: { value: baseColors[r % baseColors.length] },
          uColor2: { value: baseColors[(r + 2) % baseColors.length] },
          uAccentColor: { value: this.getAccentColor() }
        },
        vertexShader: `
          uniform float uTime;
          uniform float uIndex;
          uniform float uBass;
          uniform float uMid;
          uniform float uTreble;
          varying vec2 vUv;
          varying float vHeight;

          void main() {
            vUv = uv;
            vec3 pos = position;

            float xNorm = pos.x / 4.0; // [-1, 1]
            float ribbonOffset = uIndex * 1.047; // phase difference

            // Silky zero-gravity harmonic wave formula (slow-paced ambient glide)
            float wave1 = sin(pos.x * 0.6 - uTime * 0.38 + ribbonOffset) * (0.35 + uBass * 0.45);
            float wave2 = cos(pos.x * 1.2 + uTime * 0.26 + ribbonOffset * 1.3) * (0.16 + uMid * 0.24);
            float ripple = sin(pos.x * 2.8 - uTime * 0.45) * (0.04 + uTreble * 0.12);

            pos.y += wave1 + wave2 + ripple;
            pos.z += cos(pos.x * 0.8 - uTime * 0.32 + ribbonOffset) * (0.45 + uBass * 0.38);

            // Subtle organic thickness breathing
            float widthMod = 1.0 + sin(pos.x * 1.2 + uTime * 0.5) * (0.15 + uMid * 0.3);
            pos.y += (uv.y - 0.5) * (0.35 + uBass * 0.35) * widthMod;

            vHeight = pos.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uIndex;
          uniform float uBass;
          uniform float uTreble;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uAccentColor;
          varying vec2 vUv;
          varying float vHeight;

          void main() {
            // Gradient along ribbon length and across ribbon width
            float edge = abs(vUv.y - 0.5) * 2.0; // 0 in center, 1 at edges
            float glowEdge = pow(1.0 - edge, 2.0); // Intense core, soft falloff

            vec3 col = mix(uColor1, uColor2, sin(vUv.x * 3.14 + uTime) * 0.5 + 0.5);
            col = mix(col, uAccentColor, 0.35 + uBass * 0.4);

            // Bright core beam
            col += vec3(1.0) * pow(glowEdge, 6.0) * (0.8 + uTreble * 1.2);

            float alpha = glowEdge * (0.85 + uBass * 0.5);
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = (r - (this.ribbonCount - 1) / 2) * 0.35;
      mesh.position.z = -r * 0.3;
      this.scene.add(mesh);
      this.ribbons.push(mesh);
    }
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    for (let r = 0; r < this.ribbons.length; r++) {
      const ribbon = this.ribbons[r];
      const u = ribbon.material.uniforms;
      u.uTime.value = time;
      u.uBass.value = a.bass || 0;
      u.uMid.value = a.mid || 0;
      u.uTreble.value = a.treble || 0;
      u.uAccentColor.value = this.getAccentColor();

      // Gentle counter-rotation
      ribbon.rotation.z = Math.sin(time * 0.08 + r * 0.4) * 0.04;
    }

    // Camera slow floating drift
    this.camera.position.x = Math.sin(time * 0.06) * 0.4;
    this.camera.position.y = Math.cos(time * 0.08) * 0.25;
    this.camera.lookAt(0, 0, 0);

    super.render(a, delta, time);
  }
}

window.NeonRibbonVisualizer = NeonRibbonVisualizer;

