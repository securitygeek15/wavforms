/**
 * wavforms — Base Class for Audio-Reactive Visualizers
 * Standardizes lifecycle, Three.js resource management, resizing, and clean disposal.
 */

class VisualizerBase {
  constructor(id, name, description) {
    this.id = id;
    this.name = name;
    this.description = description;

    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.quality = 'high'; // 'high' | 'medium' | 'low'
    this.time = 0;
    this.disposed = false;
  }

  init(container, options = {}) {
    this.container = container;
    this.quality = options.quality || 'high';
    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;
    this.dpr = this.getDprForQuality(this.quality);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality !== 'low',
      alpha: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Apply clean canvas style
    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    this.container.appendChild(canvas);

    this.disposed = false;
    this.time = 0;
    this.clock = new THREE.Clock();
    this.setup();
  }

  getDprForQuality(quality) {
    const sysDpr = window.devicePixelRatio || 1;
    if (quality === 'low') return 1;
    if (quality === 'medium') return Math.min(sysDpr, 1.25);
    return Math.min(sysDpr, 2);
  }

  setQuality(quality) {
    this.quality = quality;
    if (this.renderer) {
      this.dpr = this.getDprForQuality(quality);
      this.renderer.setPixelRatio(this.dpr);
    }
  }

  setup() {
    // Override in subclass
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  update(audioState, delta = 0.016) {
    if (this.disposed) return;
    this.time = (this.time || 0) + delta;
    this.render(audioState, delta, this.time);
  }

  render(audioState, delta = 0.016, time = this.time) {
    if (this.disposed) return;
    if (typeof time !== 'number' || isNaN(time)) {
      this.time = (this.time || 0) + delta;
      time = this.time;
    }
    // Override in subclass, then call super.render()
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getAccentColor() {
    const picker = document.getElementById('palette-color-picker');
    const hex = picker ? picker.value : '#fb6e90';
    return new THREE.Color(hex);
  }

  dispose() {
    this.disposed = true;

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (!obj) return;
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => this.disposeMaterial(m));
          } else {
            this.disposeMaterial(obj.material);
          }
        }
      });
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }
    }

    if (this.renderer) {
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.container = null;
  }

  disposeMaterial(material) {
    if (!material) return;
    material.dispose();
    for (const key of Object.keys(material)) {
      const val = material[key];
      if (val && typeof val === 'object' && val.isTexture) {
        val.dispose();
      }
    }
  }
}

window.VisualizerBase = VisualizerBase;

