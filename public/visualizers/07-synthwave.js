/**
 * 07. SYNTHWAVE
 * Retro-futuristic infinite perspective neon grid landscape,
 * audio-reactive wireframe mountain ranges, and glowing sliced sunset orb.
 */

class SynthwaveVisualizer extends VisualizerBase {
  constructor() {
    super('synthwave', 'Synthwave', 'Retro-futuristic perspective neon grid, reactive wireframe mountains & sliced sunset');
  }

  setup() {
    this.camera.position.set(0, 1.4, 4.5);
    this.camera.lookAt(0, 1.0, -10.0);

    // 1. Sliced Retro Synthwave Sun
    const sunGeo = new THREE.CircleGeometry(2.5, 64);
    this.sunMat = new THREE.ShaderMaterial({
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
          vec2 p = vUv * 2.0 - 1.0;
          float dist = length(p);
          if (dist > 1.0) discard;

          // Horizontal sliced bars in bottom half of sun
          if (p.y < 0.1) {
            float slice = sin(p.y * 36.0 - uTime * 2.0);
            float barThickness = smoothstep(0.1, -0.9, p.y) * 0.45 + 0.1;
            if (slice < -0.1 + barThickness) discard;
          }

          // Sunset vertical gradient (Yellow -> Orange -> Hot Pink/Violet)
          vec3 topCol = vec3(1.0, 0.95, 0.3);
          vec3 midCol = vec3(1.0, 0.3, 0.2);
          vec3 btmCol = mix(vec3(0.9, 0.0, 0.6), uAccentColor, 0.65);

          vec3 col = mix(btmCol, midCol, smoothstep(-0.8, 0.1, p.y));
          col = mix(col, topCol, smoothstep(0.0, 0.8, p.y));
          col *= (1.1 + uBass * 0.8);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false
    });
    this.sun = new THREE.Mesh(sunGeo, this.sunMat);
    this.sun.position.set(0, 2.2, -18.0);
    this.scene.add(this.sun);

    // 2. Infinite Neon Grid & Mountains Terrain
    const gridW = 32;
    const gridD = 40;
    const segsW = this.quality === 'low' ? 36 : (this.quality === 'medium' ? 56 : 72);
    const segsD = this.quality === 'low' ? 40 : (this.quality === 'medium' ? 60 : 80);

    this.gridGeo = new THREE.PlaneGeometry(gridW, gridD, segsW, segsD);
    this.gridGeo.rotateX(-Math.PI / 2);

    this.gridMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uSpeed: { value: 1.4 }, // meditative slow aesthetic cruise
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uSpeed;
        varying vec3 vWorldPos;
        varying float vElevation;

        void main() {
          vec3 pos = position;

          // Gentle forward glide
          float zOffset = mod(uTime * uSpeed, 2.0);
          
          // Mountain peaks on left and right borders, flat canyon valley in middle
          float xDist = abs(pos.x);
          float valley = smoothstep(2.5, 12.0, xDist);

          // Sculptural mountain waves reacting gently to audio
          float mountain = sin(pos.x * 0.4 + pos.z * 0.2 + uTime * 0.22) * 
                           cos(pos.x * 0.6 - pos.z * 0.3) * (1.2 + uBass * 1.2);
          float detail = sin(pos.x * 1.2 + pos.z * 0.8) * (0.2 + uMid * 0.4);

          pos.y = (mountain + detail) * valley;
          vElevation = pos.y;

          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying vec3 vWorldPos;
        varying float vElevation;

        void main() {
          // Perspective grid lines
          vec2 coord = vWorldPos.xz * 0.5;
          vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
          float line = 1.0 - min(min(grid.x, grid.y), 1.0);

          // Neon pink / cyan edge color scheme
          vec3 gridColor = mix(vec3(0.0, 0.95, 1.0), uAccentColor, smoothstep(0.0, 3.5, vElevation));
          gridColor += vec3(0.8, 0.1, 0.9) * (uBass * 0.8);

          // Depth fog fading to black horizon
          float depth = smoothstep(30.0, 2.0, -vWorldPos.z);
          vec3 finalColor = gridColor * line * (1.2 + uTreble * 1.0);

          gl_FragColor = vec4(finalColor * depth, line * depth);
        }
      `,
      transparent: true,
      wireframe: true,
      depthWrite: false
    });

    this.terrain = new THREE.Mesh(this.gridGeo, this.gridMat);
    this.terrain.position.set(0, -0.6, -12);
    this.scene.add(this.terrain);

    // 3. Horizon Glow Light
    const horizonGeo = new THREE.PlaneGeometry(36, 4);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0xff0077,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending
    });
    this.horizonGlow = new THREE.Mesh(horizonGeo, horizonMat);
    this.horizonGlow.position.set(0, 0.8, -17.5);
    this.scene.add(this.horizonGlow);
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    // Uniform updates
    this.sunMat.uniforms.uTime.value = time * 0.4;
    this.sunMat.uniforms.uBass.value = a.bass || 0;
    this.sunMat.uniforms.uAccentColor.value = this.getAccentColor();

    this.gridMat.uniforms.uTime.value = time;
    this.gridMat.uniforms.uBass.value = a.bass || 0;
    this.gridMat.uniforms.uMid.value = a.mid || 0;
    this.gridMat.uniforms.uTreble.value = a.treble || 0;
    this.gridMat.uniforms.uAccentColor.value = this.getAccentColor();

    // Gentle breathing sunset scale on beat
    const sunScale = 1.0 + (a.bass || 0) * 0.08;
    this.sun.scale.set(sunScale, sunScale, 1.0);

    // Smooth Steadicam sway (zero bass camera jitter)
    this.camera.position.x = Math.sin(time * 0.06) * 0.25;
    this.camera.position.y = 1.4 + Math.sin(time * 0.08) * 0.06;
    this.camera.lookAt(0, 0.9, -10.0);

    super.render(a, delta, time);
  }
}

window.SynthwaveVisualizer = SynthwaveVisualizer;

