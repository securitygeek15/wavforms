/**
 * VisualizerManager
 * Coordinates all 15 audio-reactive visualizers, transitions, lifecycle, quality settings, and UI drawer.
 */
class VisualizerManager {
  constructor() {
    this.container = null;
    this.activeVisualizer = null;
    this.outgoingVisualizer = null;
    this.activeSlot = 'a'; // 'a' or 'b'
    this.slotA = null;
    this.slotB = null;
    this.currentId = '01-liquid-chrome';
    this.quality = localStorage.getItem('wavforms_viz_quality') || 'high';
    this.isRunning = false;
    this.lastFrameTime = performance.now();
    this.rafId = null;

    // Visualizers Catalogue (15 Cinematic Visualizers)
    this.catalogue = [
      { id: '01-liquid-chrome', name: 'Liquid Chrome', num: '01', classRef: 'LiquidChromeVisualizer', desc: 'Reflective metallic sphere with fluid surface displacement' },
      { id: '02-black-hole', name: 'Black Hole', num: '02', classRef: 'BlackHoleVisualizer', desc: 'Accretion disk, Einstein ring & infalling particle trails' },
      { id: '03-neon-ribbon', name: 'Neon Ribbon', num: '03', classRef: 'NeonRibbonVisualizer', desc: 'Flowing neon curves undulating with harmonic frequency bands' },
      { id: '04-dreamscape', name: 'Dreamscape', num: '04', classRef: 'DreamscapeVisualizer', desc: 'Japanese atmospheric fog, glowing lanterns & sakura petals' },
      { id: '05-abyss', name: 'Abyss', num: '05', classRef: 'AbyssVisualizer', desc: 'Deep ocean bioluminescent jellyfish, caustics & marine snow' },
      { id: '06-cyber-torus', name: 'Cyber Torus', num: '06', classRef: 'CyberTorusVisualizer', desc: 'Faceted geometric torus with rotating holographic data rings' },
      { id: '07-synthwave', name: 'Synthwave', num: '07', classRef: 'SynthwaveVisualizer', desc: 'Retro neon perspective grid, mountains & sliced sunset' },
      { id: '08-smoke', name: 'Smoke', num: '08', classRef: 'SmokeVisualizer', desc: 'Volumetric particle cloud with curl turbulence & shockwaves' },
      { id: '09-glass-dimension', name: 'Glass Dimension', num: '09', classRef: 'GlassDimensionVisualizer', desc: 'Floating glass structures with chromatic dispersion & refraction' },
      { id: '10-ink-flow', name: 'Ink Flow', num: '10', classRef: 'InkFlowVisualizer', desc: 'Fluid ink dynamics with audio-reactive blooming plumes' },
      { id: '11-orbit', name: 'Orbit', num: '11', classRef: 'OrbitVisualizer', desc: 'Pulsating stellar core with multi-axis orbital rings & satellites' },
      { id: '12-particle-storm', name: 'Particle Storm', num: '12', classRef: 'ParticleStormVisualizer', desc: 'Cosmic particle wave formations, tunnels & vortex' },
      { id: '13-limbo', name: 'Limbo', num: '13', classRef: 'LimboVisualizer', desc: 'Brutalist monoliths rising from reflective water in dense fog' },
      { id: '14-digital-bloom', name: 'Digital Bloom', num: '14', classRef: 'DigitalBloomVisualizer', desc: 'Cybernetic metallic flower blooming and fluttering to music' },
      { id: '15-infinite-tunnel', name: 'Infinite Tunnel', num: '15', classRef: 'InfiniteTunnelVisualizer', desc: 'High-speed warp tunnel with reactive ribs and streak stars' }
    ];

    // Saved preference
    const savedId = localStorage.getItem('wavforms_active_viz');
    if (savedId && this.catalogue.some(v => v.id === savedId)) {
      this.currentId = savedId;
    }
  }

  init(containerElement) {
    this.container = containerElement;
    if (!this.container) {
      console.warn('VisualizerManager: container element not found');
      return;
    }

    // Build dual slot containers for smooth cross-fading
    this.container.innerHTML = `
      <div id="viz-slot-a" class="viz-slot viz-slot-active"></div>
      <div id="viz-slot-b" class="viz-slot viz-slot-hidden"></div>
    `;

    this.slotA = document.getElementById('viz-slot-a');
    this.slotB = document.getElementById('viz-slot-b');

    // Mount initial visualizer
    this.mountVisualizer(this.currentId, false);

    // Setup window resize listener
    window.addEventListener('resize', () => {
      if (this.activeVisualizer) this.activeVisualizer.resize();
      if (this.outgoingVisualizer) this.outgoingVisualizer.resize();
    });

    // Setup global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'v' || e.key === 'V') {
        this.toggleDrawer();
      } else if (e.key === ']' || e.key === 'PageDown') {
        this.next();
      } else if (e.key === '[' || e.key === 'PageUp') {
        this.prev();
      }
    });

    // Start render loop
    this.start();
  }

  createVisualizerInstance(id) {
    const item = this.catalogue.find(v => v.id === id);
    if (!item) return null;
    const ClassFunc = window[item.classRef];
    if (typeof ClassFunc !== 'function') {
      console.error(`Visualizer class ${item.classRef} not loaded!`);
      return null;
    }
    const instance = new ClassFunc();
    instance.setQuality(this.quality);
    return instance;
  }

  mountVisualizer(id, animate = true) {
    if (this.activeVisualizer && this.activeVisualizer.id === id) return;

    const nextSlotEl = this.activeSlot === 'a' ? this.slotB : this.slotA;
    const currSlotEl = this.activeSlot === 'a' ? this.slotA : this.slotB;

    const newViz = this.createVisualizerInstance(id);
    if (!newViz) return;

    newViz.init(nextSlotEl);
    this.currentId = id;
    localStorage.setItem('wavforms_active_viz', id);

    if (animate) {
      this.outgoingVisualizer = this.activeVisualizer;
      this.activeVisualizer = newViz;

      // Cross-fade classes
      nextSlotEl.className = 'viz-slot viz-slot-active';
      currSlotEl.className = 'viz-slot viz-slot-hidden';

      // Switch active slot pointer
      this.activeSlot = this.activeSlot === 'a' ? 'b' : 'a';

      // Dispose outgoing visualizer after transition completes (0.75s)
      setTimeout(() => {
        if (this.outgoingVisualizer) {
          this.outgoingVisualizer.dispose();
          this.outgoingVisualizer = null;
        }
      }, 750);
    } else {
      if (this.activeVisualizer) {
        this.activeVisualizer.dispose();
      }
      this.activeVisualizer = newViz;
      nextSlotEl.className = 'viz-slot viz-slot-active';
      currSlotEl.className = 'viz-slot viz-slot-hidden';
      this.activeSlot = this.activeSlot === 'a' ? 'b' : 'a';
    }

    this.updateUI();
  }

  next() {
    const idx = this.catalogue.findIndex(v => v.id === this.currentId);
    const nextIdx = (idx + 1) % this.catalogue.length;
    this.mountVisualizer(this.catalogue[nextIdx].id, true);
  }

  prev() {
    const idx = this.catalogue.findIndex(v => v.id === this.currentId);
    const prevIdx = (idx - 1 + this.catalogue.length) % this.catalogue.length;
    this.mountVisualizer(this.catalogue[prevIdx].id, true);
  }

  setQuality(q) {
    this.quality = q;
    localStorage.setItem('wavforms_viz_quality', q);
    if (this.activeVisualizer) this.activeVisualizer.setQuality(q);
    if (this.outgoingVisualizer) this.outgoingVisualizer.setQuality(q);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();

    const loop = (now) => {
      if (!this.isRunning) return;
      const delta = Math.min((now - this.lastFrameTime) / 1000, 0.1);
      this.lastFrameTime = now;

      // Extract fresh real-time audio metrics
      const audioState = window.audioEngine ? window.audioEngine.update(delta) : {
        subBass: 0, bass: 0, mid: 0, treble: 0, energy: 0, beat: 0, rawWaveform: null
      };

      // Render outgoing visualizer during crossfade
      if (this.outgoingVisualizer) {
        this.outgoingVisualizer.update(audioState, delta);
      }

      // Render active visualizer
      if (this.activeVisualizer) {
        this.activeVisualizer.update(audioState, delta);
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  toggleDrawer() {
    const drawer = document.getElementById('viz-drawer');
    if (!drawer) return;
    drawer.classList.toggle('open');
  }

  closeDrawer() {
    const drawer = document.getElementById('viz-drawer');
    if (drawer) drawer.classList.remove('open');
  }

  updateUI() {
    // Update navbar active button label
    const btnLabel = document.getElementById('viz-btn-label');
    const currentItem = this.catalogue.find(v => v.id === this.currentId);
    if (btnLabel && currentItem) {
      btnLabel.textContent = currentItem.name;
    }

    // Update active highlight in drawer grid
    const cards = document.querySelectorAll('.viz-card');
    cards.forEach(card => {
      if (card.dataset.id === this.currentId) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }
}

window.visualizerManager = new VisualizerManager();

