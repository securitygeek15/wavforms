/**
 * 04. DREAMSCAPE
 * A cinematic Japanese-inspired environment featuring atmospheric rolling fog,
 * drifting cherry blossom petals, softly swaying glowing lanterns, and distant mountain silhouettes.
 */

class DreamscapeVisualizer extends VisualizerBase {
  constructor() {
    super('dreamscape', 'Dreamscape', 'Cinematic Japanese landscape with floating glowing lanterns and drifting mist');
  }

  setup() {
    this.camera.position.set(0, 1.2, 5.2);
    this.camera.lookAt(0, 1.2, 0);

    // 1. Distant Glowing Moon / Sun Orb
    const moonGeo = new THREE.CircleGeometry(1.6, 64);
    const moonMat = new THREE.ShaderMaterial({
      uniforms: {
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
        uniform float uBass;
        uniform vec3 uAccentColor;
        varying vec2 vUv;

        void main() {
          float dist = length(vUv - 0.5) * 2.0;
          if (dist > 1.0) discard;
          
          vec3 moonColor = mix(vec3(1.0, 0.95, 0.9), uAccentColor, 0.35 + uBass * 0.4);
          float glow = pow(1.0 - dist, 1.8);
          gl_FragColor = vec4(moonColor, glow * 0.95);
        }
      `,
      transparent: true,
      depthWrite: false
    });
    this.moon = new THREE.Mesh(moonGeo, moonMat);
    this.moon.position.set(0, 2.0, -8.0);
    this.scene.add(this.moon);

    // 2. Mountain Silhouette Layer
    const mtnGeo = new THREE.PlaneGeometry(16, 3.5, 32, 1);
    const pos = mtnGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        const x = pos.getX(i);
        // Procedural mountain peaks
        pos.setY(i, 1.8 + Math.sin(x * 0.7) * 0.8 + Math.cos(x * 1.5) * 0.5);
      }
    }
    mtnGeo.computeVertexNormals();
    const mtnMat = new THREE.MeshBasicMaterial({ color: 0x050508 });
    this.mountains = new THREE.Mesh(mtnGeo, mtnMat);
    this.mountains.position.set(0, 0.2, -6.0);
    this.scene.add(this.mountains);

    // 3. Volumetric Ground Mist
    const fogGeo = new THREE.PlaneGeometry(18, 12, 48, 48);
    this.fogMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uBass;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(p.x * 0.8 + uTime * 0.6) * (0.2 + uBass * 0.4);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform vec3 uAccentColor;
        varying vec2 vUv;

        void main() {
          float mist = sin(vUv.x * 8.0 + uTime * 0.4) * cos(vUv.y * 6.0 - uTime * 0.5) * 0.5 + 0.5;
          float edgeFade = smoothstep(0.0, 0.4, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
          
          vec3 col = mix(vec3(0.04, 0.05, 0.08), uAccentColor, 0.2 + uBass * 0.3);
          gl_FragColor = vec4(col, mist * edgeFade * (0.45 + uBass * 0.4));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.groundFog = new THREE.Mesh(fogGeo, this.fogMat);
    this.groundFog.rotation.x = -Math.PI / 2.2;
    this.groundFog.position.set(0, -0.8, -1.0);
    this.scene.add(this.groundFog);

    // 4. Floating 3D Japanese Lanterns
    this.lanterns = [];
    const lanternCount = this.quality === 'low' ? 6 : 12;
    const lanternBodyGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.55, 16);
    const lanternCapGeo = new THREE.ConeGeometry(0.24, 0.12, 16);

    for (let i = 0; i < lanternCount; i++) {
      const group = new THREE.Group();

      const lanternMat = new THREE.MeshBasicMaterial({
        color: 0xffeedd,
        transparent: true,
        opacity: 0.95
      });
      const body = new THREE.Mesh(lanternBodyGeo, lanternMat);

      const capMat = new THREE.MeshBasicMaterial({ color: 0x181820 });
      const topCap = new THREE.Mesh(lanternCapGeo, capMat);
      topCap.position.y = 0.32;
      const btmCap = new THREE.Mesh(lanternCapGeo, capMat);
      btmCap.position.y = -0.32;
      btmCap.rotation.x = Math.PI;

      // Glow halo
      const glowGeo = new THREE.SphereGeometry(0.35, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff8844,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);

      group.add(body);
      group.add(topCap);
      group.add(btmCap);
      group.add(glow);

      const x = (Math.random() - 0.5) * 7.5;
      const y = 0.4 + Math.random() * 2.8;
      const z = -1.0 - Math.random() * 5.0;
      group.position.set(x, y, z);

      group.userData = {
        baseY: y,
        baseX: x,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        glowMesh: glow,
        bodyMesh: body
      };

      this.scene.add(group);
      this.lanterns.push(group);
    }

    // 5. Drifting Sakura / Firefly Petals
    const pCount = this.quality === 'low' ? 300 : 700;
    const pGeo = new THREE.BufferGeometry();
    this.petals = new Float32Array(pCount * 3);
    this.petalVel = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      this.petals[i * 3] = (Math.random() - 0.5) * 12;
      this.petals[i * 3 + 1] = Math.random() * 6;
      this.petals[i * 3 + 2] = (Math.random() - 0.5) * 8;

      this.petalVel[i * 3] = -0.3 - Math.random() * 0.4; // Drift left
      this.petalVel[i * 3 + 1] = -0.15 - Math.random() * 0.2; // Fall
      this.petalVel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(this.petals, 3));
    this.petalMat = new THREE.PointsMaterial({
      color: 0xffb7c5, // Sakura soft pink
      size: 0.05,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    this.petalSystem = new THREE.Points(pGeo, this.petalMat);
    this.scene.add(this.petalSystem);
  }

  render(audio, delta, time) {
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0 };

    // Update fog (slow meditative ground mist)
    this.fogMat.uniforms.uTime.value = time * 0.4;
    this.fogMat.uniforms.uBass.value = a.bass || 0;
    this.fogMat.uniforms.uAccentColor.value = this.getAccentColor();

    // Gentle moon breathing
    this.moon.material.uniforms.uBass.value = a.bass || 0;
    this.moon.material.uniforms.uAccentColor.value = this.getAccentColor();
    const moonScale = 1.0 + (a.bass || 0) * 0.06;
    this.moon.scale.set(moonScale, moonScale, 1.0);

    // Lantern slow ambient swaying physics
    for (let l of this.lanterns) {
      const u = l.userData;
      l.position.y = u.baseY + Math.sin(time * (u.speed * 0.4) + u.phase) * 0.12;
      l.rotation.z = Math.sin(time * (u.speed * 0.5) + u.phase) * (0.04 + (a.mid || 0) * 0.04);
      l.rotation.x = Math.cos(time * (u.speed * 0.4) + u.phase) * 0.03;

      // Pulse lantern glow softly
      const glowScale = 1.0 + (a.mid || 0) * 0.35 + (a.bass || 0) * 0.15;
      u.glowMesh.scale.set(glowScale, glowScale, glowScale);
      u.glowMesh.material.opacity = 0.35 + (a.mid || 0) * 0.25;
    }

    // Sakura petal slow drifting simulation
    const pos = this.petalSystem.geometry.attributes.position.array;
    const count = this.petals.length / 3;
    const windSpeed = 0.6 + (a.treble || 0) * 0.4;

    for (let i = 0; i < count; i++) {
      pos[i * 3] += this.petalVel[i * 3] * delta * windSpeed;
      pos[i * 3 + 1] += (this.petalVel[i * 3 + 1] + Math.sin(time * 0.6 + i) * 0.03) * delta;
      pos[i * 3 + 2] += this.petalVel[i * 3 + 2] * delta;

      // Wrap around
      if (pos[i * 3] < -6) pos[i * 3] = 6;
      if (pos[i * 3 + 1] < -0.5) pos[i * 3 + 1] = 5.5;
    }
    this.petalSystem.geometry.attributes.position.needsUpdate = true;

    // Slow cinematic Japanese garden camera drift
    this.camera.position.x = Math.sin(time * 0.04) * 0.35;
    this.camera.position.y = 1.2 + Math.cos(time * 0.06) * 0.12;
    this.camera.lookAt(0, 1.2, 0);

    super.render(a, delta, time);
  }
}

window.DreamscapeVisualizer = DreamscapeVisualizer;

