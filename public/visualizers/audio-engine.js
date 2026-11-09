/**
 * wavforms — Shared Web Audio API Analysis Engine
 * Extracts high-fidelity, smoothed frequency bands, waveforms, and beat triggers.
 */

class AudioAnalysisEngine {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.analyser = null;
    this.audioElement = null;
    this.isInitialized = false;

    this.fftSize = 2048;
    this.binCount = this.fftSize / 2;
    this.frequencyData = new Uint8Array(this.binCount);
    this.waveformData = new Uint8Array(this.binCount);
    this.normalizedWaveform = new Float32Array(this.binCount);

    // Multi-band energy (instantaneous & smoothed)
    this.bands = {
      subBass: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      overall: 0
    };

    this.smoothed = {
      subBass: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      overall: 0
    };

    // Beat detection state
    this.beat = false;
    this.beatDecay = 0;
    this.beatThreshold = 0.65;
    this.beatCutoff = 0.4;
    this.beatHoldTime = 0.18; // seconds
    this.lastBeatTime = 0;

    // Audio boost multiplier & low-speed high-aesthetic smoothing
    this.gainBoost = 1.05;
    this.attackSpeed = 0.08; // smooth, gentle rise
    this.decaySpeed = 0.04;  // luxurious, slow ambient release

    // Idle animation oscillator (keeps visualizers gently breathing when paused)
    this.idlePhase = 0;
  }

  attachAudioElement(audioEl) {
    if (this.audioElement === audioEl && this.isInitialized) return;
    this.audioElement = audioEl;

    const initContext = () => {
      if (this.isInitialized) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        this.audioContext = new AudioCtx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.88; // high hardware smoothing

        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        this.isInitialized = true;
      } catch (err) {
        console.warn('[AudioEngine] Web Audio init deferred:', err.message);
      }
    };

    // User gesture unlock for browser autoplay policy
    ['play', 'playing', 'pointerdown', 'keydown'].forEach(evt => {
      window.addEventListener(evt, () => {
        if (!this.isInitialized) initContext();
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
      }, { once: false, passive: true });
    });

    if (!audioEl.paused) {
      initContext();
    }
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  update(delta = 0.016) {
    const isPlaying = this.audioElement && !this.audioElement.paused && this.audioElement.currentTime > 0;

    if (!this.isInitialized || !isPlaying) {
      // Gentle ambient breathing when idle or paused
      this.idlePhase += delta * 1.5;
      const breathe = (Math.sin(this.idlePhase) * 0.5 + 0.5) * 0.08;
      const wave = (Math.sin(this.idlePhase * 1.8) * 0.5 + 0.5) * 0.06;

      this.bands.subBass = breathe * 0.5;
      this.bands.bass = breathe;
      this.bands.mid = wave;
      this.bands.treble = wave * 0.6;
      this.bands.overall = (breathe + wave) * 0.5;

      const alpha = 0.1;
      this.smoothed.subBass += (this.bands.subBass - this.smoothed.subBass) * alpha;
      this.smoothed.bass += (this.bands.bass - this.smoothed.bass) * alpha;
      this.smoothed.mid += (this.bands.mid - this.smoothed.mid) * alpha;
      this.smoothed.treble += (this.bands.treble - this.smoothed.treble) * alpha;
      this.smoothed.overall += (this.bands.overall - this.smoothed.overall) * alpha;

      this.beat = false;
      this.beatDecay = Math.max(0, this.beatDecay - delta * 2.5);

      // Smooth sine idle waveform
      for (let i = 0; i < this.binCount; i++) {
        this.normalizedWaveform[i] = Math.sin((i / this.binCount) * Math.PI * 4 + this.idlePhase) * 0.05;
      }
      return this.getState();
    }

    // Extract actual real-time frequency & time domain data
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.waveformData);

    // Convert waveform to [-1, 1] range
    for (let i = 0; i < this.binCount; i++) {
      this.normalizedWaveform[i] = (this.waveformData[i] - 128) / 128;
    }

    const sampleRate = this.audioContext.sampleRate || 44100;
    const hzPerBin = (sampleRate / 2) / this.binCount;

    // Accurate frequency band ranges
    // Sub-bass: 20-60 Hz
    // Bass: 60-250 Hz
    // Midrange: 250-2000 Hz
    // Treble: 2000-16000 Hz
    const subBassStart = Math.max(1, Math.floor(20 / hzPerBin));
    const subBassEnd = Math.max(subBassStart + 1, Math.floor(60 / hzPerBin));

    const bassStart = subBassEnd;
    const bassEnd = Math.max(bassStart + 1, Math.floor(250 / hzPerBin));

    const midStart = bassEnd;
    const midEnd = Math.max(midStart + 1, Math.floor(2000 / hzPerBin));

    const trebleStart = midEnd;
    const trebleEnd = Math.min(this.binCount - 1, Math.floor(16000 / hzPerBin));

    this.bands.subBass = this.calcAverageRange(subBassStart, subBassEnd) * this.gainBoost;
    this.bands.bass = this.calcAverageRange(bassStart, bassEnd) * this.gainBoost;
    this.bands.mid = this.calcAverageRange(midStart, midEnd) * this.gainBoost;
    this.bands.treble = this.calcAverageRange(trebleStart, trebleEnd) * this.gainBoost * 1.35; // boost treble perception

    // Overall energy (weighted)
    this.bands.overall = (
      this.bands.subBass * 0.3 +
      this.bands.bass * 0.35 +
      this.bands.mid * 0.25 +
      this.bands.treble * 0.1
    );

    // High-Aesthetic Asymmetric Smoothing (smooth attack, slow ambient decay)
    const smoothBand = (current, target) => {
      const rate = target > current ? this.attackSpeed : this.decaySpeed;
      const s = 1.0 - Math.pow(1.0 - rate, delta * 60);
      return current + (target - current) * s;
    };

    this.smoothed.subBass = smoothBand(this.smoothed.subBass, this.bands.subBass);
    this.smoothed.bass = smoothBand(this.smoothed.bass, this.bands.bass);
    this.smoothed.mid = smoothBand(this.smoothed.mid, this.bands.mid);
    this.smoothed.treble = smoothBand(this.smoothed.treble, this.bands.treble);
    this.smoothed.overall = smoothBand(this.smoothed.overall, this.bands.overall);

    // Gentle beat detection with slow dissipation
    const now = performance.now() / 1000;
    const bassInstant = (this.bands.subBass * 0.6 + this.bands.bass * 0.4);
    const bassAvg = (this.smoothed.subBass * 0.6 + this.smoothed.bass * 0.4);

    if (bassInstant > this.beatThreshold && (bassInstant - bassAvg) > 0.16 && (now - this.lastBeatTime) > this.beatHoldTime) {
      this.beat = true;
      this.beatDecay = 1.0;
      this.lastBeatTime = now;
    } else {
      this.beat = false;
      this.beatDecay = Math.max(0, this.beatDecay - delta * 1.8);
    }

    return this.getState();
  }

  calcAverageRange(start, end) {
    if (end <= start) return 0;
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += this.frequencyData[i];
    }
    return (sum / (end - start)) / 255;
  }

  getState() {
    return {
      subBass: this.smoothed.subBass,
      bass: this.smoothed.bass,
      mid: this.smoothed.mid,
      treble: this.smoothed.treble,
      overall: this.smoothed.overall,
      rawSubBass: this.bands.subBass,
      rawBass: this.bands.bass,
      rawMid: this.bands.mid,
      rawTreble: this.bands.treble,
      beat: this.beat,
      beatDecay: this.beatDecay,
      waveform: this.normalizedWaveform,
      frequencies: this.frequencyData
    };
  }
}

// Global singleton instance
window.audioEngine = new AudioAnalysisEngine();

