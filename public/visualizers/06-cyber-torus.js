/**
 * 06. CYBER TORUS
 * A futuristic geometric torus with rotating wireframes, neon faceted edges,
 * concentric orbital data rings, and audio-reactive geometric morphing.
 */

class CyberTorusVisualizer extends VisualizerBase {
  constructor() {
    super('cyber-torus', 'Cyber Torus', 'Futuristic geometric torus with reactive faceted wireframes & holographic rings');
  }

  setup() {
    this.camera.position.set(0, 0, 4.6);

    const segs = this.quality === 'low' ? 32 : (this.quality === 'medium' ? 48 : 64);
    const tubeSegs = this.quality === 'low' ? 16 : 24;

    // 1. Core Solid Torus
    this.torusGeo = new THREE.TorusGeometry(1.6, 0.55, tubeSegs, segs);
    this.torusMat = new THREE.ShaderMaterial({
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
        uniform float uMid;
        uniform float uTreble;
        varying vec3 vNormal;
        varying vec3 vPos;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec3 p = position;

          // Audio-reactive geometric spike extrusion
          float angle = atan(p.y, p.x);
          float spike = sin(angle * 12.0 + uTime * 3.0) * cos(p.z * 8.0) * (uBass * 0.45);
          float ripple = sin(p.x * 6.0 + p.y * 6.0 - uTime * 4.0) * (uTreble * 0.25);
          
          p += normal * (spike + ripple);

          vNormal = normalize(normalMatrix * normal);
          vPos = p;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        varying vec3 vNormal;
        varying vec3 vPos;
        varying vec2 vUv;

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(-vPos);
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);

          vec3 baseDark = vec3(0.04, 0.04, 0.07);
          vec3 neonGlow = mix(vec3(0.0, 0.9, 1.0), uAccentColor, 0.5 + uBass * 0.5);

          // Grid wire lines rendered on surface
          float grid = step(0.92, fract(vUv.x * 32.0)) + step(0.92, fract(vUv.y * 16.0));
          
          vec3 color = mix(baseDark, neonGlow, grid * (0.6 + uTreble * 0.8));
          color += neonGlow * fresnel * (1.2 + uBass * 1.5);

          gl_FragColor = vec4(color, 0.95);
        }
      `,
      transparent: true
    });

    this.torus = new THREE.Mesh(this.torusGeo, this.torusMat);
    this.scene.add(this.torus);

    // 2. Outer Faceted Wireframe Shell
    const wireGeo = new THREE.TorusGeometry(1.68, 0.62, 12, 32);
    this.wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    this.wireframe = new THREE.Mesh(wireGeo, this.wireMat);
    this.scene.add(this.wireframe);

    // 3. Concentric Holographic Data Rings
    this.rings = [];
    const ringCount = 3;
    for (let r = 0; r < ringCount; r++) {
      const radius = 2.6 + r * 0.45;
      const rGeo = new THREE.RingGeometry(radius, radius + 0.03, 64);
      const rMat = new THREE.MeshBasicMaterial({
        color: r === 1 ? 0xff0055 : 0x00f0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.rotation.x = Math.PI / 2 + (r - 1) * 0.3;
      ring.userData = { speed: (r % 2 === 0 ? 1 : -1) * (0.4 + r * 0.2) };
      this.scene.add(ring);
      this.rings.push(ring);
    }
  }

  render(audio, delta, time) {
    if (!this.torus) return;
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    // Uniform updates
    this.torusMat.uniforms.uTime.value = time * 0.4;
    this.torusMat.uniforms.uBass.value = a.bass || 0;
    this.torusMat.uniforms.uMid.value = a.mid || 0;
    this.torusMat.uniforms.uTreble.value = a.treble || 0;
    this.torusMat.uniforms.uAccentColor.value = this.getAccentColor();

    // Meditative slow torus rotation driven by continuous inertia
    const rotSpeed = (0.10 + (a.mid || 0) * 0.12) * delta;
    this.torus.rotation.x += rotSpeed;
    this.torus.rotation.y += rotSpeed * 0.7;

    this.wireframe.rotation.x = -this.torus.rotation.x * 0.8;
    this.wireframe.rotation.y = -this.torus.rotation.y * 0.8;
    this.wireMat.color = this.getAccentColor();
    this.wireMat.opacity = 0.25 + (a.treble || 0) * 0.25;

    // Gentle breathing scale on bass
    const scale = 1.0 + (a.bass || 0) * 0.12;
    this.torus.scale.set(scale, scale, scale);

    // Rotate holographic rings at calm, hypnotic speeds
    for (let r of this.rings) {
      r.rotation.z += (r.userData.speed * 0.35 + (a.bass || 0) * 0.15) * delta;
      r.scale.set(scale, scale, scale);
    }

    // Camera perspective float (slow cinematic drift)
    this.camera.position.x = Math.sin(time * 0.06) * 0.3;
    this.camera.position.y = Math.cos(time * 0.08) * 0.2;
    this.camera.lookAt(0, 0, 0);

    super.render(a, delta, time);
  }
}

window.CyberTorusVisualizer = CyberTorusVisualizer;

