/**
 * wavforms — MilkDrop 3 Audio Visualizer Engine
 * Powered by Butterchurn (WebGL2 MilkDrop Engine) & 367 Classic / Crazy Presets
 * https://github.com/milkdrop2077/MilkDrop3
 */

class MilkdropEngine {
  constructor() {
    this.canvas = null;
    this.container = null;
    this.visualizer = null;
    this.audioConnected = false;
    this.isRunning = false;
    this.rafId = null;

    // Presets catalog & state
    this.allPresets = {};
    this.presetList = [];
    this.filteredList = [];
    this.currentPresetKey = null;
    this.currentPresetName = '';
    this.activeCategory = 'featured';
    this.searchQuery = '';

    // Settings
    this.blendDuration = parseFloat(localStorage.getItem('wavforms_md_blend') || '2.7');
    this.quality = localStorage.getItem('wavforms_md_quality') || 'high';
    this.autoCycle = localStorage.getItem('wavforms_md_autocycle') !== 'false';
    this.cycleInterval = parseInt(localStorage.getItem('wavforms_md_interval') || '25', 10); // seconds
    this.lastCycleTime = performance.now();

    // Handpicked Top 35 Craziest / Most Mind-Bending Presets
    this.featuredKeys = [
      'Flexi, martin + geiss - dedicated to the sherwin maxawow',
      'Rovastar + Geiss - Hurricane Nightmare (Posterize Mix)',
      'Flexi - mindblob [shiny mix]',
      'Martin - acid wiring',
      'Geiss - Spiral Artifact',
      'martin - mandelbox explorer - high speed demo version',
      'Unchained & Rovastar - Wormhole Pillars (Hall of Shadows mix)',
      'Zylot - True Visionary (Final Mix)',
      'Geiss - Reaction Diffusion 2',
      'Flexi - alien fish pond',
      'martin - witchcraft reloaded',
      '$$$ Royal - Mashup (431)',
      'yin - 191 - Temporal singularities',
      'Rovastar + Loadus + Geiss - FractalDrop (Triple Mix)',
      'Flexi - smashing fractals [acid etching mix]',
      'Geiss - Cauldron - painterly 2 (saturation remix)',
      'martin - The Bridge of Khazad-Dum',
      'Flexi + stahlregen - jelly showoff parade',
      '_Aderrasi - Wanderer in Curved Space - mash0000 - faclempt kibitzing meshuggana schmaltz (Geiss color mix)',
      'Fumbling_Foo & Flexi, Martin, Orb, Unchained - Star Nova v7b',
      'Geiss - Thumb Drum',
      'martin - reflections on black tiles',
      'Zylot - Paint Spill (Music Reactive Paint Mix)',
      'Geiss - Desert Rose 2',
      'Flexi - predator-prey-spirals',
      'shifter - dark tides bdrv mix 2',
      'martin - ghost city',
      'flexi - mom, why the sky looks different today',
      'martin + flexi - diamond cutter [prismaticvortex.com] - camille - i wish i wish i wish i was constrained',
      'Goody - The Wild Vort',
      'Idiot - Star Of Annon',
      'Geiss, Flexi + Stahlregen - Thumbdrum Tokamak [crossfiring aftermath jelly mashup]',
      'Phat+fiShbRaiN+Eo.S_Mandala_Chasers_remix',
      'Flexi - truly soft piece of software - this is generic texturing (Jelly) ',
      '_Geiss - Artifact 01'
    ];

    // OSD timer
    this.osdTimeout = null;
  }

  init(containerElement) {
    this.container = containerElement;
    if (!this.container) return;

    // Clear existing container and setup MilkDrop Canvas + OSD
    this.container.innerHTML = `
      <canvas id="milkdrop-canvas" class="milkdrop-canvas"></canvas>
      <div id="milkdrop-osd" class="milkdrop-osd">
        <div class="milkdrop-osd-badge">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <span>MILKDROP 3</span>
        </div>
        <div class="milkdrop-osd-title" id="milkdrop-osd-title">Flexi, Martin + Geiss</div>
      </div>
    `;

    this.canvas = document.getElementById('milkdrop-canvas');

    // Compile presets from all loaded libraries
    this.compilePresets();

    // Setup butterchurn visualizer instance
    this.setupButterchurn();

    // Bind window resize
    window.addEventListener('resize', () => this.resize());

    // Setup Drawer UI
    this.setupDrawerUI();

    // Hotkey listener for cycling presets
    this.setupHotkeys();
  }

  compilePresets() {
    this.allPresets = {};

    const p1 = window.butterchurnPresets ? (window.butterchurnPresets.getPresets ? window.butterchurnPresets.getPresets() : window.butterchurnPresets) : {};
    const p2 = window.butterchurnPresetsExtra ? (window.butterchurnPresetsExtra.getPresets ? window.butterchurnPresetsExtra.getPresets() : window.butterchurnPresetsExtra) : {};
    const p3 = window.butterchurnPresetsExtra2 ? (window.butterchurnPresetsExtra2.getPresets ? window.butterchurnPresetsExtra2.getPresets() : window.butterchurnPresetsExtra2) : {};

    Object.assign(this.allPresets, p1, p2, p3);

    const keys = Object.keys(this.allPresets);
    console.log(`[MilkDrop 3] Loaded ${keys.length} total presets.`);

    // Build structured preset list
    this.presetList = keys.map(k => {
      // Extract author if formatted as "Author - Title" or "Author + Other - Title"
      let author = 'Community';
      let title = k;
      if (k.includes(' - ')) {
        const parts = k.split(' - ');
        author = parts[0].replace(/^[_$]+/, '').trim();
        title = parts.slice(1).join(' - ').trim();
      } else if (k.startsWith('_')) {
        author = k.slice(1).split(' ')[0];
      }

      // Assign categories
      const lower = k.toLowerCase();
      const categories = ['all'];

      if (this.featuredKeys.includes(k) || this.featuredKeys.some(fk => fk.toLowerCase() === lower)) {
        categories.push('featured');
      }
      if (lower.includes('fractal') || lower.includes('mandel') || lower.includes('spiral') || lower.includes('space') || lower.includes('dimension') || lower.includes('singularity') || lower.includes('vortex')) {
        categories.push('psychedelic');
      }
      if (lower.includes('acid') || lower.includes('neon') || lower.includes('laser') || lower.includes('matrix') || lower.includes('cyber') || lower.includes('tokamak') || lower.includes('wire')) {
        categories.push('cyberpunk');
      }
      if (lower.includes('liquid') || lower.includes('flow') || lower.includes('jelly') || lower.includes('pond') || lower.includes('sea') || lower.includes('smoke') || lower.includes('fluid') || lower.includes('wave')) {
        categories.push('fluid');
      }
      if (lower.includes('geiss') || author.toLowerCase().includes('geiss')) {
        categories.push('geiss');
      }

      // Fallback: if not in any specific category, assign to psychedelic or fluid
      if (categories.length === 1) {
        categories.push((lower.charCodeAt(0) % 2 === 0) ? 'psychedelic' : 'cyberpunk');
      }

      return {
        key: k,
        name: k,
        cleanTitle: title,
        author: author,
        categories: categories,
        preset: this.allPresets[k]
      };
    });

    // Pick saved or default preset
    const savedKey = localStorage.getItem('wavforms_active_md_preset');
    if (savedKey && this.allPresets[savedKey]) {
      this.currentPresetKey = savedKey;
    } else {
      // Default to iconic Flexi/Martin/Geiss
      this.currentPresetKey = this.featuredKeys[0] in this.allPresets ? this.featuredKeys[0] : keys[0];
    }
    this.currentPresetName = this.currentPresetKey;
  }

  setupButterchurn() {
    if (!this.canvas) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = (window.audioEngine && window.audioEngine.audioContext) ? window.audioEngine.audioContext : new AudioCtx();

      const butterchurnApi = window.butterchurn?.default || window.butterchurn;
      if (!butterchurnApi || typeof butterchurnApi.createVisualizer !== 'function') {
        console.error('[MilkDrop 3] Butterchurn API not available');
        return;
      }

      const qualityParams = this.getQualityParams();

      this.visualizer = butterchurnApi.createVisualizer(audioCtx, this.canvas, {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: qualityParams.pixelRatio,
        textureRatio: qualityParams.textureRatio,
        meshWidth: qualityParams.meshWidth,
        meshHeight: qualityParams.meshHeight
      });

      // Load extra textures if available
      if (window.butterchurnExtraImages) {
        const extraImg = window.butterchurnExtraImages.default || window.butterchurnExtraImages;
        if (extraImg && typeof extraImg.getImages === 'function') {
          this.visualizer.loadExtraImages(extraImg.getImages());
        }
      }

      // Connect audio
      this.connectAudio();

      // Load initial preset
      if (this.currentPresetKey && this.allPresets[this.currentPresetKey]) {
        this.visualizer.loadPreset(this.allPresets[this.currentPresetKey], 0.0);
        this.updateUI();
      }

      console.log('[MilkDrop 3] Visualizer initialized successfully!');
    } catch (err) {
      console.error('[MilkDrop 3] Error initializing visualizer:', err);
    }
  }

  getQualityParams() {
    const dpr = window.devicePixelRatio || 1;
    switch (this.quality) {
      case 'ultra':
        return { pixelRatio: Math.min(dpr, 2), textureRatio: 1, meshWidth: 64, meshHeight: 48 };
      case 'balanced':
        return { pixelRatio: 1, textureRatio: 1, meshWidth: 36, meshHeight: 28 };
      case 'low':
        return { pixelRatio: 1, textureRatio: 0.8, meshWidth: 24, meshHeight: 18 };
      case 'high':
      default:
        return { pixelRatio: Math.min(dpr, 1.5), textureRatio: 1, meshWidth: 48, meshHeight: 36 };
    }
  }

  connectAudio() {
    if (this.audioConnected || !this.visualizer) return;

    if (window.audioEngine && window.audioEngine.sourceNode) {
      try {
        this.visualizer.connectAudio(window.audioEngine.sourceNode);
        this.audioConnected = true;
        console.log('[MilkDrop 3] Connected to AudioEngine sourceNode');
      } catch (e) {
        console.warn('[MilkDrop 3] Could not connect sourceNode:', e.message);
      }
    } else {
      // Retry once user starts playback
      const audioEl = document.getElementById('audio');
      if (audioEl) {
        const tryConnect = () => {
          if (window.audioEngine && window.audioEngine.sourceNode && !this.audioConnected) {
            try {
              this.visualizer.connectAudio(window.audioEngine.sourceNode);
              this.audioConnected = true;
              console.log('[MilkDrop 3] Connected to AudioEngine sourceNode on playback');
            } catch (e) {}
          }
        };
        audioEl.addEventListener('play', tryConnect, { once: true });
        audioEl.addEventListener('playing', tryConnect, { once: true });
      }
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastCycleTime = performance.now();
    this.connectAudio();
    this.resize();

    const loop = (now) => {
      if (!this.isRunning) return;

      if (this.visualizer) {
        // Auto-cycle check
        if (this.autoCycle && (now - this.lastCycleTime) > (this.cycleInterval * 1000)) {
          this.nextPreset();
          this.lastCycleTime = now;
        }

        try {
          this.visualizer.render();
        } catch (e) {
          // Prevent fatal render crashes on problematic presets
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  pause() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  stop() {
    this.pause();
  }

  resize() {
    if (!this.visualizer || !this.canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const q = this.getQualityParams();
    this.visualizer.setRendererSize(w, h, q);
  }

  loadPreset(presetKey, blendTime = null) {
    if (!this.visualizer || !this.allPresets[presetKey]) return;

    const blend = (blendTime !== null) ? blendTime : this.blendDuration;
    this.currentPresetKey = presetKey;
    this.currentPresetName = presetKey;
    localStorage.setItem('wavforms_active_md_preset', presetKey);

    this.visualizer.loadPreset(this.allPresets[presetKey], blend);
    this.lastCycleTime = performance.now();

    this.showOSD(presetKey);
    this.updateUI();
  }

  nextPreset() {
    const list = this.getCurrentCategoryList();
    if (list.length === 0) return;
    const idx = list.findIndex(p => p.key === this.currentPresetKey);
    const nextIdx = (idx + 1) % list.length;
    this.loadPreset(list[nextIdx].key);
  }

  prevPreset() {
    const list = this.getCurrentCategoryList();
    if (list.length === 0) return;
    const idx = list.findIndex(p => p.key === this.currentPresetKey);
    const prevIdx = (idx - 1 + list.length) % list.length;
    this.loadPreset(list[prevIdx].key);
  }

  randomPreset() {
    const list = this.getCurrentCategoryList();
    if (list.length === 0) return;
    let randIdx = Math.floor(Math.random() * list.length);
    if (list.length > 1 && list[randIdx].key === this.currentPresetKey) {
      randIdx = (randIdx + 1) % list.length;
    }
    this.loadPreset(list[randIdx].key);
  }

  getCurrentCategoryList() {
    if (this.activeCategory === 'all') return this.presetList;
    return this.presetList.filter(p => p.categories.includes(this.activeCategory));
  }

  showOSD(presetKey) {
    const osd = document.getElementById('milkdrop-osd');
    const osdTitle = document.getElementById('milkdrop-osd-title');
    if (!osd || !osdTitle) return;

    osdTitle.textContent = presetKey;
    osd.classList.add('visible');

    if (this.osdTimeout) clearTimeout(this.osdTimeout);
    this.osdTimeout = setTimeout(() => {
      osd.classList.remove('visible');
    }, 2800);
  }

  setQuality(q) {
    this.quality = q;
    localStorage.setItem('wavforms_md_quality', q);
    this.resize();
  }

  setBlendDuration(sec) {
    this.blendDuration = parseFloat(sec);
    localStorage.setItem('wavforms_md_blend', this.blendDuration);
  }

  setAutoCycle(enabled) {
    this.autoCycle = !!enabled;
    localStorage.setItem('wavforms_md_autocycle', this.autoCycle);
    this.lastCycleTime = performance.now();
    this.updateUI();
  }

  setCycleInterval(sec) {
    this.cycleInterval = parseInt(sec, 10);
    localStorage.setItem('wavforms_md_interval', this.cycleInterval);
    this.lastCycleTime = performance.now();
  }

  // ──── DRAWER UI & CONTROLS ────
  setupDrawerUI() {
    const vizDrawer = document.getElementById('viz-drawer');
    if (!vizDrawer) return;

    // Replace drawer content with MilkDrop 3 specific design
    const content = vizDrawer.querySelector('.viz-drawer-content');
    if (!content) return;

    content.innerHTML = `
      <div class="viz-drawer-header">
        <div class="viz-drawer-title-wrap">
          <div class="milkdrop-logo-badge">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>MILKDROP 3</span>
          </div>
          <span class="viz-drawer-title">Audio Visualizer Studio</span>
          <span class="viz-drawer-badge">${this.presetList.length} Presets</span>
        </div>
        <div class="viz-drawer-controls">
          <div class="viz-quality-group">
            <button class="md-header-btn" id="btn-md-random" title="Random Preset (R or Space)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
              <span>Random</span>
            </button>
            <button class="md-header-btn ${this.autoCycle ? 'active' : ''}" id="btn-md-autocycle" title="Toggle Auto-Cycle (Hotkey: L)">
              <span>Cycle: ${this.autoCycle ? 'ON' : 'OFF'}</span>
            </button>
            <div class="viz-quality-pills">
              <span class="viz-control-label">Quality:</span>
              <button class="viz-quality-btn ${this.quality === 'ultra' ? 'active' : ''}" data-quality="ultra">Ultra</button>
              <button class="viz-quality-btn ${this.quality === 'high' ? 'active' : ''}" data-quality="high">High</button>
              <button class="viz-quality-btn ${this.quality === 'balanced' ? 'active' : ''}" data-quality="balanced">Balanced</button>
              <button class="viz-quality-btn ${this.quality === 'low' ? 'active' : ''}" data-quality="low">Low</button>
            </div>
          </div>
          <button class="viz-drawer-close" id="viz-drawer-close" title="Close (V or Esc)">✕</button>
        </div>
      </div>

      <!-- Search & Category Filters -->
      <div class="milkdrop-filter-bar">
        <div class="milkdrop-search-wrap">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" id="milkdrop-search" class="milkdrop-search-input" placeholder="Search 367 presets, artists (Geiss, Flexi, Martin, Rovastar, Zylot)..." autocomplete="off">
          <button id="milkdrop-search-clear" class="milkdrop-search-clear" style="display:none;">✕</button>
        </div>
        <div class="milkdrop-category-tabs">
          <button class="md-cat-btn ${this.activeCategory === 'featured' ? 'active' : ''}" data-cat="featured">🔥 Insane (Top 35)</button>
          <button class="md-cat-btn ${this.activeCategory === 'psychedelic' ? 'active' : ''}" data-cat="psychedelic">🌀 Psychedelic & Fractals</button>
          <button class="md-cat-btn ${this.activeCategory === 'cyberpunk' ? 'active' : ''}" data-cat="cyberpunk">⚡ Cyber & Lasers</button>
          <button class="md-cat-btn ${this.activeCategory === 'fluid' ? 'active' : ''}" data-cat="fluid">🌊 Liquid & Light</button>
          <button class="md-cat-btn ${this.activeCategory === 'geiss' ? 'active' : ''}" data-cat="geiss">🏛️ Ryan Geiss</button>
          <button class="md-cat-btn ${this.activeCategory === 'all' ? 'active' : ''}" data-cat="all">🌐 All (${this.presetList.length})</button>
        </div>
      </div>

      <!-- Presets Grid Container -->
      <div class="viz-grid milkdrop-grid" id="viz-grid"></div>
    `;

    // Bind event handlers
    const btnRandom = document.getElementById('btn-md-random');
    const btnAuto = document.getElementById('btn-md-autocycle');
    const searchInput = document.getElementById('milkdrop-search');
    const searchClear = document.getElementById('milkdrop-search-clear');
    const closeBtn = document.getElementById('viz-drawer-close');
    const backdrop = document.getElementById('viz-drawer-backdrop');

    if (btnRandom) btnRandom.addEventListener('click', () => this.randomPreset());
    if (btnAuto) {
      btnAuto.addEventListener('click', () => {
        this.setAutoCycle(!this.autoCycle);
        btnAuto.classList.toggle('active', this.autoCycle);
        btnAuto.querySelector('span').textContent = `Cycle: ${this.autoCycle ? 'ON' : 'OFF'}`;
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (searchClear) searchClear.style.display = this.searchQuery ? 'block' : 'none';
        this.renderPresetGrid();
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchQuery = '';
        searchClear.style.display = 'none';
        this.renderPresetGrid();
      });
    }

    // Category tab clicks
    content.querySelectorAll('.md-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.md-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.cat;
        this.renderPresetGrid();
      });
    });

    // Quality buttons
    content.querySelectorAll('.viz-quality-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.viz-quality-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setQuality(btn.dataset.quality);
      });
    });

    // Drawer close handlers
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeDrawer());
    if (backdrop) backdrop.addEventListener('click', () => this.closeDrawer());

    // Initial grid render
    this.renderPresetGrid();
  }

  renderPresetGrid() {
    const grid = document.getElementById('viz-grid');
    if (!grid) return;

    let items = this.getCurrentCategoryList();

    if (this.searchQuery) {
      items = this.presetList.filter(p =>
        p.key.toLowerCase().includes(this.searchQuery) ||
        p.author.toLowerCase().includes(this.searchQuery)
      );
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="milkdrop-empty-search">
          <span>No MilkDrop presets matched "${this.searchQuery}"</span>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((p, idx) => {
      const card = document.createElement('div');
      const isActive = p.key === this.currentPresetKey;
      card.className = `viz-card milkdrop-card ${isActive ? 'active' : ''}`;
      card.dataset.key = p.key;

      card.innerHTML = `
        <div class="viz-card-top">
          <span class="milkdrop-author-badge">${this.escapeHtml(p.author)}</span>
          <span class="viz-card-indicator"></span>
        </div>
        <div class="viz-card-name" title="${this.escapeHtml(p.key)}">${this.escapeHtml(p.cleanTitle || p.key)}</div>
        <div class="milkdrop-card-sub">${this.escapeHtml(p.key)}</div>
      `;

      card.addEventListener('click', () => {
        this.loadPreset(p.key);
        this.closeDrawer();
      });

      fragment.appendChild(card);
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);

    // Scroll active card into view
    const activeCard = grid.querySelector('.viz-card.active');
    if (activeCard) {
      activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const isVisualizerStyle = document.body.classList.contains('style-visualizer');

      if (e.key === 'v' || e.key === 'V') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          this.toggleDrawer();
        }
      } else if (e.key === 'Escape') {
        this.closeDrawer();
      } else if (isVisualizerStyle) {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          this.randomPreset();
        } else if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          this.setAutoCycle(!this.autoCycle);
          const btnAuto = document.getElementById('btn-md-autocycle');
          if (btnAuto) {
            btnAuto.classList.toggle('active', this.autoCycle);
            btnAuto.querySelector('span').textContent = `Cycle: ${this.autoCycle ? 'ON' : 'OFF'}`;
          }
          this.showOSD(`Auto-Cycle: ${this.autoCycle ? 'ON' : 'OFF'}`);
        }
      }
    });
  }

  toggleDrawer() {
    const drawer = document.getElementById('viz-drawer');
    if (!drawer) return;
    if (drawer.classList.contains('open')) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer() {
    const drawer = document.getElementById('viz-drawer');
    if (drawer) {
      drawer.classList.add('open');
      this.renderPresetGrid();
      const input = document.getElementById('milkdrop-search');
      if (input) setTimeout(() => input.focus(), 150);
    }
  }

  closeDrawer() {
    const drawer = document.getElementById('viz-drawer');
    if (drawer) drawer.classList.remove('open');
  }

  updateUI() {
    const btnLabel = document.getElementById('viz-btn-label');
    if (btnLabel && this.currentPresetName) {
      // Truncate long title for top navbar button
      let clean = this.currentPresetName.replace(/^[_$]+/, '');
      if (clean.length > 22) {
        clean = clean.substring(0, 20) + '…';
      }
      btnLabel.textContent = `⚡ ${clean}`;
    }

    // Update active highlight in drawer
    const grid = document.getElementById('viz-grid');
    if (grid) {
      grid.querySelectorAll('.viz-card').forEach(card => {
        card.classList.toggle('active', card.dataset.key === this.currentPresetKey);
      });
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Instantiate and expose globally
window.milkdropEngine = new MilkdropEngine();
// Backward compatibility alias for app.js
window.visualizerManager = window.milkdropEngine;

