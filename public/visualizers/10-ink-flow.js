/**
 * 10. INK FLOW
 * Beautiful fluid ink dynamics simulation with organic swirling plumes,
 * procedural curl noise, and audio-reactive color diffusion.
 */

class InkFlowVisualizer extends VisualizerBase {
  constructor() {
    super('ink-flow', 'Ink Flow', 'Organic swirling fluid ink dynamics with audio-reactive diffusion plumes');
  }

  setup() {
    this.camera.position.set(0, 0, 4.5);

    const count = this.quality === 'low' ? 900 : (this.quality === 'medium' ? 1800 : 3000);
    this.pCount = count;

    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.lifetimes = new Float32Array(count);

    const inkPalette = [
      new THREE.Color(0x0a0c1a), // Deep obsidian indigo
      new THREE.Color(0x5500aa), // Deep violet
      new THREE.Color(0x00f0ff), // Electric cyan
      new THREE.Color(0xff0066), // Magenta crimson
      new THREE.Color(0xffffff)  // Pure highlight
    ];

    for (let i = 0; i < count; i++) {
      this.resetInkDrop(i, true, inkPalette);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.inkMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uTreble: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uBass;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (75.0 / -mvPosition.z) * (1.0 + uBass * 0.7);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uAccentColor;
        varying vec3 vColor;

        void main() {
          // Soft fluid drop gradient with delicate feathered edge
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord) * 2.0;
          if (dist > 1.0) discard;

          float alpha = pow(1.0 - dist, 1.8) * 0.8;
          vec3 finalColor = mix(vColor, uAccentColor, 0.25);
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.inkMat);
    this.scene.add(this.points);
  }

  resetInkDrop(i, initial = false, palette) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.4;

    this.positions[i * 3] = Math.cos(angle) * r;
    this.positions[i * 3 + 1] = (initial ? (Math.random() - 0.5) * 3.0 : 1.8 + Math.random() * 0.4);
    this.positions[i * 3 + 2] = Math.sin(angle) * r;

    this.sizes[i] = 1.8 + Math.random() * 3.0;
    this.lifetimes[i] = initial ? Math.random() : 0.0;

    const col = palette[Math.floor(Math.random() * palette.length)];
    this.colors[i * 3] = col.r;
    this.colors[i * 3 + 1] = col.g;
    this.colors[i * 3 + 2] = col.b;
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    this.inkMat.uniforms.uTime.value = time * 0.35;
    this.inkMat.uniforms.uBass.value = a.bass || 0;
    this.inkMat.uniforms.uTreble.value = a.treble || 0;
    this.inkMat.uniforms.uAccentColor.value = this.getAccentColor();

    const pos = this.points.geometry.attributes.position.array;
    const trebleTendrils = 1.0 + (a.treble || 0) * 0.3;
    const bassBloom = 0.5 + (a.bass || 0) * 0.4;

    for (let i = 0; i < this.pCount; i++) {
      this.lifetimes[i] += delta * 0.10; // slow-motion phantom camera dissipation

      if (this.lifetimes[i] >= 1.0 || pos[i * 3 + 1] < -2.5) {
        this.positions[i * 3] = (Math.random() - 0.5) * 0.4;
        this.positions[i * 3 + 1] = 2.0;
        this.positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        this.lifetimes[i] = 0.0;

        pos[i * 3] = this.positions[i * 3];
        pos[i * 3 + 1] = this.positions[i * 3 + 1];
        pos[i * 3 + 2] = this.positions[i * 3 + 2];
      } else {
        // Slow viscous laminar curl noise
        const px = pos[i * 3];
        const py = pos[i * 3 + 1];
        const pz = pos[i * 3 + 2];

        const curlX = Math.sin(py * 1.0 + time * 0.3) * Math.cos(pz * 0.8) * 0.22 * trebleTendrils;
        const curlY = -0.25 - Math.sin(px * 0.8 + time * 0.25) * 0.08 * bassBloom;
        const curlZ = Math.cos(py * 1.0 + time * 0.3) * Math.sin(px * 0.8) * 0.22 * trebleTendrils;

        // Dispersal outward expansion
        const distFromCenter = Math.sqrt(px * px + pz * pz);
        const expand = (distFromCenter < 2.5) ? (distFromCenter * 0.08 * bassBloom) : 0;

        pos[i * 3] += (curlX + (px > 0 ? expand : -expand)) * delta;
        pos[i * 3 + 1] += curlY * delta;
        pos[i * 3 + 2] += (curlZ + (pz > 0 ? expand : -expand)) * delta;
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.rotation.y = time * 0.04;

    // Fluid camera float
    this.camera.position.x = Math.sin(time * 0.06) * 0.25;
    this.camera.position.y = Math.cos(time * 0.08) * 0.2;

    super.render(a, delta, time);
  }
}

window.InkFlowVisualizer = InkFlowVisualizer;

