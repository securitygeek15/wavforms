/**
 * 01. LIQUID CHROME
 * A reflective metallic sphere continuously deforming with music.
 * Bass creates massive structural swells; treble creates high-frequency surface ripples.
 */

class LiquidChromeVisualizer extends VisualizerBase {
  constructor() {
    super('liquid-chrome', 'Liquid Chrome', 'Reflective metallic sphere with real-time fluid surface deformation');
  }

  setup() {
    this.camera.position.set(0, 0, 4.2);

    const detail = this.quality === 'low' ? 32 : (this.quality === 'medium' ? 64 : 96);
    this.geometry = new THREE.SphereGeometry(1.5, detail, detail);

    // GLSL Vertex & Fragment Shaders for procedural fluid chrome
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uBeat: { value: 0 },
        uAccentColor: { value: this.getAccentColor() }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform float uBeat;
        
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        varying float vDisplacement;

        // Simplex 3D noise
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

        float snoise(vec3 v){
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 = v - i + dot(i, C.xxx) ;

          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );

          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

          i = mod(i, 289.0 );
          vec4 p = permute( permute( permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

          float n_ = 0.142857142857;
          vec3  ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );

          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );

          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);

          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
          vec3 pos = position;
          
          // Audio-reactive fluid displacement layers (low-speed, sculptural aesthetic)
          float slowTime = uTime * 0.18;
          float lowFreq = snoise(pos * 0.85 + vec3(slowTime)) * (0.10 + uBass * 0.32);
          float midFreq = snoise(pos * 1.8 - vec3(uTime * 0.22)) * (0.05 + uMid * 0.16);
          float highFreq = snoise(pos * 3.2 + vec3(uTime * 0.28)) * (0.02 + uTreble * 0.07);

          float totalDisp = lowFreq + midFreq + highFreq;
          vDisplacement = totalDisp;

          pos += normal * totalDisp;

          // Compute perturbed normal
          float eps = 0.02;
          float dx = snoise(pos + vec3(eps, 0.0, 0.0)) - totalDisp;
          float dy = snoise(pos + vec3(0.0, eps, 0.0)) - totalDisp;
          float dz = snoise(pos + vec3(0.0, 0.0, eps)) - totalDisp;
          vec3 displacedNormal = normalize(normal - vec3(dx, dy, dz) * 1.5);

          vNormal = normalize(normalMatrix * displacedNormal);
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vViewPosition = -mvPosition.xyz;
          vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform vec3 uAccentColor;
        
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        varying float vDisplacement;

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPosition);

          // Fresnel reflection calculation
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);

          // Simulated studio HDR environment reflection
          vec3 R = reflect(-V, N);
          
          // Metallic specular highlights
          vec3 lightDir1 = normalize(vec3(1.5, 2.5, 3.0));
          vec3 lightDir2 = normalize(vec3(-2.0, -1.0, 2.0));
          
          float spec1 = pow(max(dot(reflect(-lightDir1, N), V), 0.0), 48.0);
          float spec2 = pow(max(dot(reflect(-lightDir2, N), V), 0.0), 24.0);

          // Base luxury chrome gradient
          vec3 chromeBase = mix(vec3(0.04, 0.04, 0.06), vec3(0.92, 0.94, 0.98), R.y * 0.5 + 0.5);
          
          // Chromatic dispersion (iridescence along curvature & displacement)
          vec3 rainbow = vec3(
            sin(R.x * 3.5 + vDisplacement * 4.0 + 0.0) * 0.5 + 0.5,
            sin(R.y * 3.5 + vDisplacement * 4.0 + 2.094) * 0.5 + 0.5,
            sin(R.z * 3.5 + vDisplacement * 4.0 + 4.188) * 0.5 + 0.5
          );

          vec3 chromeColor = mix(chromeBase, rainbow, 0.35 * (uMid + 0.2));
          chromeColor += spec1 * vec3(1.0, 0.98, 0.95) * (1.2 + uBass * 1.5);
          chromeColor += spec2 * uAccentColor * (0.8 + uTreble * 1.8);

          // Rim glow with accent tint
          chromeColor += fresnel * mix(vec3(0.9, 0.95, 1.0), uAccentColor, 0.5 + uBass * 0.5) * 1.6;

          gl_FragColor = vec4(chromeColor, 1.0);
        }
      `
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    // Subtle ambient particle dust surrounding chrome sphere
    const pCount = this.quality === 'low' ? 80 : 200;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const radius = 2.4 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = radius * Math.cos(phi);
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    this.dust = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.035,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    }));
    this.scene.add(this.dust);
  }

  render(audio, delta, time) {
    if (!this.mesh) return;
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, mid: 0, treble: 0, beatDecay: 0 };

    // Smooth uniform updates
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uBass.value = a.bass || 0;
    this.material.uniforms.uMid.value = a.mid || 0;
    this.material.uniforms.uTreble.value = a.treble || 0;
    this.material.uniforms.uBeat.value = a.beatDecay || 0;
    this.material.uniforms.uAccentColor.value = this.getAccentColor();

    // Cinematic continuous forward rotation (zero jumpiness)
    this.mesh.rotation.y += (0.08 + (a.bass || 0) * 0.12) * delta;
    this.mesh.rotation.x = Math.sin(time * 0.12) * 0.18;

    // Smooth Steadicam orbit drift
    this.camera.position.x = Math.sin(time * 0.08) * 0.35;
    this.camera.position.y = Math.cos(time * 0.06) * 0.20;
    this.camera.position.z = 4.2;
    this.camera.lookAt(0, 0, 0);

    // Drifting micro-dust
    this.dust.rotation.y += 0.02 * delta;

    super.render(a, delta, time);
  }
}

window.LiquidChromeVisualizer = LiquidChromeVisualizer;

