/**
 * 15. INFINITE TUNNEL Visualizer
 * Futuristic infinite warp-speed geometric tunnel with reactive neon ribs and streak particles.
 */
class InfiniteTunnelVisualizer extends VisualizerBase {
  constructor() {
    super('infinite-tunnel', 'Infinite Tunnel');
  }

  setup() {
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, -100);

    this.tunnelGroup = new THREE.Group();
    this.scene.add(this.tunnelGroup);

    // Number of repeating geometric ring ribs
    this.numRings = this.quality === 'low' ? 36 : 60;
    this.ringSpacing = 4.0;
    this.tunnelLength = this.numRings * this.ringSpacing;
    this.rings = [];

    // Hexagonal ring geometry
    const sides = 6;
    const ringRadius = 7.5;
    const ringGeom = new THREE.BufferGeometry();
    const ringPositions = [];
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      ringPositions.push(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 0);
    }
    ringGeom.setAttribute('position', new THREE.Float32BufferAttribute(ringPositions, 3));

    // Outer wireframe ribs
    for (let i = 0; i < this.numRings; i++) {
      const zPos = -i * this.ringSpacing;
      const hue = (i / this.numRings) * 0.25 + 0.95; // Red-violet cyberpunk gradient
      const color = new THREE.Color().setHSL(hue % 1.0, 0.95, 0.55);

      const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: Math.max(0.08, 1.0 - (i / this.numRings)),
        blending: THREE.AdditiveBlending
      });

      const line = new THREE.Line(ringGeom, mat);
      line.position.set(0, 0, zPos);
      this.tunnelGroup.add(line);

      this.rings.push({
        line,
        mat,
        baseColor: color,
        initialZ: zPos
      });
    }

    // Longitudal connecting rail lines running along vertices
    this.rails = [];
    for (let s = 0; s < sides; s++) {
      const angle = (s / sides) * Math.PI * 2;
      const railGeom = new THREE.BufferGeometry();
      const railPos = [
        Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, 10,
        Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, -this.tunnelLength
      ];
      railGeom.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
      const railMat = new THREE.LineBasicMaterial({
        color: 0x881133,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending
      });
      const rail = new THREE.Line(railGeom, railMat);
      this.tunnelGroup.add(rail);
      this.rails.push(rail);
    }

    // High-speed streak stars rushing past camera
    const starCount = this.quality === 'low' ? 400 : 1200;
    const starGeom = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    this.starSpeed = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1.0 + Math.random() * (ringRadius - 1.2);
      starPos[i * 3] = Math.cos(angle) * dist;
      starPos[i * 3 + 1] = Math.sin(angle) * dist;
      starPos[i * 3 + 2] = -Math.random() * this.tunnelLength;
      this.starSpeed[i] = 1.0 + Math.random() * 2.0;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.28,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    this.stars = new THREE.Points(starGeom, this.starMat);
    this.tunnelGroup.add(this.stars);

    // Glowing core target in deep distance
    const glowGeom = new THREE.SphereGeometry(3.0, 16, 16);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0xff1144,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    this.glowCore = new THREE.Mesh(glowGeom, this.glowMat);
    this.glowCore.position.set(0, 0, -this.tunnelLength + 20);
    this.tunnelGroup.add(this.glowCore);
  }

  render(audio, delta, time) {
    if (!this.tunnelGroup) return;
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + (delta || 0.016);
      time = this.time;
    }
    const a = audio || { bass: 0, subBass: 0, mid: 0, treble: 0 };
    const bass = a.bass || 0;
    const sub = a.subBass || 0;
    const mid = a.mid || 0;
    const treble = a.treble || 0;

    // Gentle forward gliding velocity with deep audio inertia
    const baseSpeed = 4.5;
    const warpSpeed = baseSpeed + (bass * 8.0) + (sub * 5.0);
    const zStep = warpSpeed * delta;

    // Slow hypnotic roll and gentle architectural drift
    this.tunnelGroup.rotation.z += (0.04 + mid * 0.06) * delta;
    this.tunnelGroup.rotation.x = Math.sin(time * 0.18) * 0.04;
    this.tunnelGroup.rotation.y = Math.cos(time * 0.14) * 0.04;

    // Update rings: cycle z position to create infinite forward motion
    this.rings.forEach((r, idx) => {
      r.line.position.z += zStep;
      if (r.line.position.z > 12) {
        r.line.position.z -= this.tunnelLength;
      }

      // Smooth geometric breathing wave
      const distFromCam = Math.abs(r.line.position.z);
      const pulseWave = Math.sin(distFromCam * 0.05 - time * 1.5) * bass * 0.15;
      const currentScale = 1.0 + pulseWave;
      r.line.scale.set(currentScale, currentScale, 1.0);

      // Depth fade & subtle treble sheen
      const normDist = Math.min(1.0, distFromCam / this.tunnelLength);
      const baseOpacity = Math.max(0.04, Math.pow(1.0 - normDist, 1.5));
      const strobe = (idx % 2 === 0) ? (treble * 0.15) : 0;
      r.mat.opacity = Math.min(1.0, baseOpacity + strobe);
    });

    // Update streak stars with slow celestial drift
    const starArr = this.stars.geometry.attributes.position.array;
    const sCount = starArr.length / 3;
    for (let i = 0; i < sCount; i++) {
      starArr[i * 3 + 2] += zStep * this.starSpeed[i] * 0.7;
      if (starArr[i * 3 + 2] > 12) {
        starArr[i * 3 + 2] -= this.tunnelLength;
      }
    }
    this.stars.geometry.attributes.position.needsUpdate = true;
    this.starMat.size = 0.22 + treble * 0.15;

    // Core pulsing in deep distance (ethereal ambient glow)
    const cScale = 1.0 + sub * 0.4;
    this.glowCore.scale.set(cScale, cScale, cScale);
    this.glowCore.rotation.y = time * 0.2;
    this.glowMat.opacity = 0.25 + bass * 0.25;

    super.render(a, delta, time);
  }
}
window.InfiniteTunnelVisualizer = InfiniteTunnelVisualizer;

