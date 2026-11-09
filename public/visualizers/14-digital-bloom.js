/**
 * 14. DIGITAL BLOOM Visualizer
 * Abstract cybernetic metallic flower blooming, expanding, and rippling with audio.
 */
class DigitalBloomVisualizer extends VisualizerBase {
  constructor() {
    super('digital-bloom', 'Digital Bloom');
  }

  setup() {
    this.camera.position.set(0, 8, 22);
    this.camera.lookAt(0, 0, 0);

    this.bloomGroup = new THREE.Group();
    this.scene.add(this.bloomGroup);

    // Dynamic point lights for metallic highlights
    this.coreLight = new THREE.PointLight(0xff2a5f, 3, 40);
    this.coreLight.position.set(0, 2, 0);
    this.scene.add(this.coreLight);

    this.accentLight = new THREE.PointLight(0xa855f7, 2, 35);
    this.accentLight.position.set(5, 8, 5);
    this.scene.add(this.accentLight);

    const ambLight = new THREE.AmbientLight(0x110515, 0.8);
    this.scene.add(ambLight);

    // Build Petal Layers (4 concentric tiers with golden ratio spacing)
    this.petals = [];
    const tierConfigs = [
      { count: 6, radius: 2.2, scale: 1.4, tilt: 0.85, yOffset: 0.2 },
      { count: 10, radius: 4.2, scale: 2.0, tilt: 0.65, yOffset: -0.2 },
      { count: 14, radius: 6.8, scale: 2.8, tilt: 0.45, yOffset: -0.8 },
      { count: 18, radius: 9.8, scale: 3.6, tilt: 0.25, yOffset: -1.6 }
    ];

    // Petal geometry (curved leaf shape using custom Lathe or shaped Plane)
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.quadraticCurveTo(0.6, 1.2, 0.4, 3.2);
    petalShape.quadraticCurveTo(0.2, 4.2, 0, 4.8);
    petalShape.quadraticCurveTo(-0.2, 4.2, -0.4, 3.2);
    petalShape.quadraticCurveTo(-0.6, 1.2, 0, 0);

    const petalGeom = new THREE.ShapeGeometry(petalShape, 16);
    petalGeom.center();

    // Metallic material with dynamic reflectivity
    this.petalMaterial = new THREE.MeshStandardMaterial({
      color: 0x221128,
      roughness: 0.22,
      metalness: 0.92,
      side: THREE.DoubleSide
    });

    tierConfigs.forEach((tier, tierIdx) => {
      for (let i = 0; i < tier.count; i++) {
        const angle = (i / tier.count) * Math.PI * 2 + (tierIdx * 0.35);
        const mesh = new THREE.Mesh(petalGeom, this.petalMaterial.clone());
        mesh.scale.set(tier.scale, tier.scale, tier.scale);
        
        // Pivot group to allow natural unfolding from base
        const pivot = new THREE.Group();
        pivot.position.set(
          Math.cos(angle) * tier.radius * 0.4,
          tier.yOffset,
          Math.sin(angle) * tier.radius * 0.4
        );

        mesh.position.set(0, tier.scale * 1.8, 0);
        mesh.rotation.x = Math.PI / 2 - tier.tilt;
        mesh.rotation.z = 0;

        pivot.rotation.y = -angle + Math.PI / 2;
        pivot.add(mesh);

        this.bloomGroup.add(pivot);
        this.petals.push({
          pivot,
          mesh,
          tierIdx,
          baseTilt: tier.tilt,
          angle,
          origScale: tier.scale
        });
      }
    });

    // Central Stamen & Pistil Core
    const coreGeom = new THREE.SphereGeometry(1.4, 32, 32);
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0xff1144,
      emissive: 0xaa0033,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.7
    });
    this.coreMesh = new THREE.Mesh(coreGeom, this.coreMat);
    this.coreMesh.position.set(0, 0.4, 0);
    this.bloomGroup.add(this.coreMesh);

    // Stamen particles (pollen / energy spore cloud floating around core)
    const pCount = this.quality === 'low' ? 300 : 800;
    const pGeom = new THREE.BufferGeometry();
    const pos = new Float32Array(pCount * 3);
    this.pOriginal = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = 1.5 + Math.random() * 4.5;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = Math.abs(r * Math.cos(phi)) + 0.6;
      const z = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      this.pOriginal[i * 3] = x;
      this.pOriginal[i * 3 + 1] = y;
      this.pOriginal[i * 3 + 2] = z;
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pMat = new THREE.PointsMaterial({
      color: 0xff4488,
      size: 0.22,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    this.stamenParticles = new THREE.Points(pGeom, this.pMat);
    this.bloomGroup.add(this.stamenParticles);
  }

  render(audio, delta, time) {
    if (!this.bloomGroup) return;
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, subBass: 0, mid: 0, treble: 0 };
    const bass = a.bass || 0;
    const sub = a.subBass || 0;
    const mid = a.mid || 0;
    const treble = a.treble || 0;

    // Slow cinematic flower yaw and gentle pitch breathing
    this.bloomGroup.rotation.y = time * 0.05;
    this.bloomGroup.rotation.x = Math.sin(time * 0.15) * 0.06;
    this.bloomGroup.rotation.z = Math.cos(time * 0.12) * 0.04;

    // Core expansion & emission
    const coreScale = 1.0 + sub * 0.25 + bass * 0.18;
    this.coreMesh.scale.set(coreScale, coreScale, coreScale);
    this.coreMat.emissiveIntensity = 0.5 + bass * 0.6;
    this.coreLight.intensity = 2.0 + bass * 1.5;

    // Petal unfolding & fluttering (luxurious slow bloom)
    this.petals.forEach((p, idx) => {
      // Bass unfolds the petals outward gracefully
      const unfoldAngle = p.baseTilt + bass * 0.20 * (1 + p.tierIdx * 0.15);
      // Mid frequencies create gentle organic ripple
      const flutter = Math.sin(time * 1.2 + p.angle * 2.0) * mid * 0.06;
      p.mesh.rotation.x = Math.PI / 2 - (unfoldAngle + flutter);

      // Treble subtle sheen on petal materials
      if (p.mesh.material) {
        p.mesh.material.roughness = Math.max(0.12, 0.25 - treble * 0.12);
      }
    });

    // Stamen particles disperse in slow drifting spore cloud
    const positions = this.stamenParticles.geometry.attributes.position.array;
    const count = positions.length / 3;
    for (let i = 0; i < count; i++) {
      const ox = this.pOriginal[i * 3];
      const oy = this.pOriginal[i * 3 + 1];
      const oz = this.pOriginal[i * 3 + 2];
      const burst = 1.0 + bass * 0.22 + Math.sin(time * 0.8 + i) * mid * 0.08;
      positions[i * 3] = ox * burst;
      positions[i * 3 + 1] = oy * burst + Math.sin(time * 0.6 + i) * 0.18;
      positions[i * 3 + 2] = oz * burst;
    }
    this.stamenParticles.geometry.attributes.position.needsUpdate = true;
    this.pMat.size = 0.18 + treble * 0.12;

    // Smooth Steadicam orbit
    this.camera.position.y = 8 + Math.sin(time * 0.12) * 1.0;
    this.camera.position.z = 22 + Math.cos(time * 0.10) * 1.2;
    this.camera.lookAt(0, 0.5, 0);

    super.render(a, delta, time);
  }
}
window.DigitalBloomVisualizer = DigitalBloomVisualizer;

