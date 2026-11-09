// ═══════════════════════════════════════════════════════════════
//   wavforms — Fast-Paced Ocean Drops Word-by-Word Engine
// ═══════════════════════════════════════════════════════════════

// Rich vocabulary mapping with custom emotion colors
const VOCABULARY = {
  // Love & Romance (Rose / Coral)
  "love": { color: "#fb7185" },
  "heart": { color: "#fb7185" },
  "broken": { color: "#f43f5e" },
  "kiss": { color: "#f43f5e" },
  "touch": { color: "#f472b6" },
  "baby": { color: "#f472b6" },
  "sweet": { color: "#fb7185" },
  "crying": { color: "#60a5fa" },
  "cry": { color: "#60a5fa" },
  "tears": { color: "#38bdf8" },

  // Light, Starlight & Euphoria (Amber / Gold / Violet)
  "light": { color: "#facc15" },
  "lights": { color: "#facc15" },
  "blinded": { color: "#fbbf24" },
  "shine": { color: "#fbbf24" },
  "sun": { color: "#f59e0b" },
  "star": { color: "#fbbf24" },
  "stars": { color: "#e879f9" },
  "sky": { color: "#c084fc" },
  "night": { color: "#a855f7" },
  "moon": { color: "#e879f9" },
  "dream": { color: "#c084fc" },

  // Water, Ocean & Cold (Aquatic Cyan / Glacier Blue)
  "water": { color: "#00f2fe" },
  "ocean": { color: "#00f2fe" },
  "sea": { color: "#38bdf8" },
  "wave": { color: "#38bdf8" },
  "drowning": { color: "#00f2fe" },
  "rain": { color: "#38bdf8" },
  "storm": { color: "#60a5fa" },
  "cold": { color: "#a5f3fc" },
  "ice": { color: "#a5f3fc" },
  "empty": { color: "#94a3b8" },

  // Fire, Heat & Energy (Flame Crimson / Orange)
  "fire": { color: "#ff453a" },
  "flame": { color: "#ff453a" },
  "burn": { color: "#ff5e3a" },
  "hot": { color: "#ff9f0a" },
  "overdrive": { color: "#fbbf24" },
  "wild": { color: "#ff9f0a" },

  // Movement, Speed & Action (Emerald / Neon)
  "run": { color: "#34d399" },
  "running": { color: "#34d399" },
  "walk": { color: "#10b981" },
  "walking": { color: "#10b981" },
  "car": { color: "#34d399" },
  "drive": { color: "#34d399" },
  "road": { color: "#10b981" },
  "city": { color: "#38bdf8" },
  "sleep": { color: "#c084fc" },
  "wake": { color: "#facc15" },
  "time": { color: "#facc15" },
  "phone": { color: "#38bdf8" },
  "eyes": { color: "#60a5fa" },
  "look": { color: "#60a5fa" },
  "dance": { color: "#fb7185" },
  "music": { color: "#a855f7" },
  "song": { color: "#a855f7" }
};

function getWordMeta(rawWord) {
  if (!rawWord) return null;
  const clean = rawWord.trim().replace(/[.,!?:;()"'`\-]/g, '').toLowerCase();
  if (VOCABULARY[clean]) return VOCABULARY[clean];
  if (clean.endsWith('ing') && clean.length > 4) {
    const root = clean.slice(0, -3);
    if (VOCABULARY[root]) return VOCABULARY[root];
  }
  return null;
}

// State
let playlist = [];
let currentTrackIndex = -1;
let currentLyrics = null;
let activeLineIndex = -1;
let lyricOffsetMs = parseInt(localStorage.getItem('wavforms_offset') || '0', 10);
if (isNaN(lyricOffsetMs)) lyricOffsetMs = 0;
let isSeeking = false;

// DOM
const body = document.body;
const audio = document.getElementById('audio');
const hudPlay = document.getElementById('hud-play');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const hudCur = document.getElementById('hud-cur');
const hudDur = document.getElementById('hud-dur');
const hudTrack = document.getElementById('hud-track');
const hudFill = document.getElementById('hud-fill');
const hud = document.getElementById('minimal-hud');

const displayTitle = document.getElementById('display-title');
const displayArtist = document.getElementById('display-artist');
const pillSep = document.getElementById('pill-sep');
const statusDot = document.getElementById('playback-status-dot');
const currentLineEl = document.getElementById('current-line');
const prevLineEl = document.getElementById('prev-line-container');
const nextLineEl = document.getElementById('next-line-container');
const offsetDisplay = document.getElementById('offset-display');

const colorPicker = document.getElementById('palette-color-picker');
const colorDot = document.getElementById('color-dot');
const queuePanel = document.getElementById('queue-panel');
const queueItems = document.getElementById('queue-items');
const queueNum = document.getElementById('queue-num');
const dropOverlay = document.getElementById('drop-overlay');

// ──── OFFSET CALIBRATION ────
function updateOffset(deltaMs) {
  lyricOffsetMs += deltaMs;
  localStorage.setItem('wavforms_offset', lyricOffsetMs.toString());
  renderOffsetDisplay();
}

function renderOffsetDisplay() {
  if (!offsetDisplay) return;
  const sec = (lyricOffsetMs / 1000).toFixed(1);
  offsetDisplay.textContent = `${sec >= 0 ? '+' : ''}${sec}s`;
}
renderOffsetDisplay();

document.getElementById('btn-offset-minus').addEventListener('click', () => updateOffset(-100));
document.getElementById('btn-offset-plus').addEventListener('click', () => updateOffset(100));

// ──── PLAYBACK CONTROLS ────
function ensureAudioEngineAttached() {
  if (window.audioEngine) {
    window.audioEngine.attachAudioElement(audio);
  }
}

window.addEventListener('click', ensureAudioEngineAttached, { once: true });
window.addEventListener('keydown', ensureAudioEngineAttached, { once: true });

function togglePlayback() {
  if (playlist.length === 0) return;
  ensureAudioEngineAttached();
  if (audio.paused) {
    audio.play().then(() => updatePlayState(true)).catch(() => updatePlayState(false));
  } else {
    audio.pause();
    updatePlayState(false);
  }
}

function updatePlayState(isPlaying) {
  iconPlay.style.display = isPlaying ? 'none' : 'block';
  iconPause.style.display = isPlaying ? 'block' : 'none';
  statusDot.style.opacity = isPlaying ? '1' : '0.4';
  if (isPlaying) {
    hud.classList.add('active');
    setTimeout(() => hud.classList.remove('active'), 2500);
  }
  updateDiscordRPC(true);
}

hudPlay.addEventListener('click', togglePlayback);

// Scrubber
hudTrack.addEventListener('mousedown', (e) => {
  isSeeking = true;
  seekTrack(e);
});
window.addEventListener('mousemove', (e) => {
  if (isSeeking) seekTrack(e);
});
window.addEventListener('mouseup', () => { isSeeking = false; });

function seekTrack(e) {
  const rect = hudTrack.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (audio.duration) {
    audio.currentTime = ratio * audio.duration;
    if (currentStyle === 'visual' && unifiedWordStream.length > 0) {
      const seekMs = (audio.currentTime * 1000) + lyricOffsetMs;
      let targetIdx = 0;
      for (let i = 0; i < unifiedWordStream.length; i++) {
        if (seekMs >= unifiedWordStream[i].startMs) {
          targetIdx = i;
        } else {
          break;
        }
      }
      currentUnifiedWordIdx = targetIdx;
      alignTrackToWord(targetIdx, false);
    }
  }
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlayback();
  } else if (e.code === 'ArrowRight') {
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  } else if (e.code === 'ArrowLeft') {
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  } else if (e.key === '[' || e.key === '{') {
    if (currentStyle === 'visualizer' && window.milkdropEngine) {
      window.milkdropEngine.prevPreset();
    } else {
      updateOffset(-100);
    }
  } else if (e.key === ']' || e.key === '}') {
    if (currentStyle === 'visualizer' && window.milkdropEngine) {
      window.milkdropEngine.nextPreset();
    } else {
      updateOffset(100);
    }
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  }
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}
document.getElementById('btn-fs').addEventListener('click', toggleFullscreen);

// Color Well
colorPicker.addEventListener('input', (e) => {
  const c = e.target.value;
  document.documentElement.style.setProperty('--color-highlight', c);
  colorDot.style.background = c;
});

// ──── TRACK LOADING & ACCURATE DURATION SYNC ────
async function loadTrack(index) {
  if (index < 0 || index >= playlist.length) return;
  currentTrackIndex = index;
  const track = playlist[index];

  // Remove empty opening state!
  body.classList.remove('state-empty');

  displayTitle.textContent = track.title;
  if (track.artist && track.artist !== "Local Track") {
    displayArtist.textContent = track.artist;
    displayArtist.style.display = "inline";
    pillSep.style.display = "inline";
  } else {
    displayArtist.textContent = "";
    displayArtist.style.display = "none";
    pillSep.style.display = "none";
  }

  document.title = `${track.title} • wavforms`;
  renderQueue();

  currentLineEl.innerHTML = '<span class="idle-message">Synchronizing words...</span>';
  prevLineEl.textContent = '';
  nextLineEl.textContent = '';
  activeLineIndex = -1;

  if (track.file) {
    audio.src = URL.createObjectURL(track.file);
  } else if (track.url) {
    audio.src = track.url;
  }

  // Accurate duration wait
  let exactDurationMs = track.durationMs || 0;
  if (!exactDurationMs && audio) {
    if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      exactDurationMs = Math.round(audio.duration * 1000);
      track.durationMs = exactDurationMs;
    } else {
      await new Promise(resolve => {
        const onReady = () => {
          if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
            exactDurationMs = Math.round(audio.duration * 1000);
            track.durationMs = exactDurationMs;
          }
          cleanup();
          resolve();
        };
        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', onReady);
          audio.removeEventListener('canplay', onReady);
          audio.removeEventListener('durationchange', onReady);
        };
        audio.addEventListener('loadedmetadata', onReady);
        audio.addEventListener('canplay', onReady);
        audio.addEventListener('durationchange', onReady);
        setTimeout(() => { cleanup(); resolve(); }, 1200);
      });
    }
  }

  // Fetch lyrics with exact duration
  if (track.customLyrics) {
    currentLyrics = track.customLyrics;
  } else {
    currentLyrics = await fetchLyrics(track.title, track.artist, exactDurationMs);
  }

  if (currentLyrics && currentLyrics.lines && currentLyrics.lines.length > 0) {
    activeLineIndex = 0;
    compileUnifiedWordStream(currentLyrics);
    if (currentStyle === 'visual') {
      renderFullVerciTrack();
    } else {
      renderLineOceanDrops(0);
    }
  } else {
    currentLineEl.innerHTML = '<span class="idle-message">No synchronized lyrics found for this song</span>';
  }

  ensureAudioEngineAttached();
  audio.play().then(() => updatePlayState(true)).catch(() => updatePlayState(false));
}

// ──── COLOR AUTO-SYNC FROM EMBEDDED ART ────
function extractArtworkColor(imgUrl) {
  if (!imgUrl) return;
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.src = imgUrl;
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = 30;
      c.height = 30;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 30, 30);
      const data = ctx.getImageData(5, 5, 20, 20).data;

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 16) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      if ((r * 299 + g * 587 + b * 114) / 1000 < 60) {
        r = Math.min(255, r + 90);
        g = Math.min(255, g + 80);
        b = Math.min(255, b + 100);
      }

      const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
      document.documentElement.style.setProperty('--color-highlight', hex);
      colorPicker.value = hex;
      colorDot.style.background = hex;
    } catch (e) { }
  };
}

// ──── LYRICS API (MULTI-PROVIDER: IN-PROCESS NATIVE + DIRECT LRCLIB FALLBACK) ────
async function fetchLyrics(title, artist, durationMs) {
  const cleanArtist = (artist && artist !== 'Local Track' && artist !== 'Unknown Artist') ? artist : '';
  const durSec = durationMs ? Math.round(durationMs / 1000) : 0;

  // 1. Try native backend /api/lyrics (NetEase syllable YRC + in-process LRCLIB)
  try {
    const url = `/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(cleanArtist)}&duration=${durationMs || 0}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.lines && data.lines.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Native lyric fetch failed, falling back to direct web providers:', err);
  }

  // 2. Direct browser fallback: LRCLIB API (CORS enabled, high-accuracy)
  try {
    const query = cleanArtist ? `${title} ${cleanArtist}` : title;
    const lrcUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
    const lrcRes = await fetch(lrcUrl);
    if (lrcRes.ok) {
      const results = await lrcRes.json();
      if (Array.isArray(results) && results.length > 0) {
        let bestSynced = null;
        let bestPlain = null;
        let minDiff = Infinity;

        for (const item of results) {
          if (item.syncedLyrics) {
            const trackDur = item.duration || 0;
            if (durSec > 0 && trackDur > 0) {
              const diff = Math.abs(trackDur - durSec);
              if (diff < minDiff) {
                minDiff = diff;
                bestSynced = item.syncedLyrics;
                if (diff <= 3) break;
              }
            } else if (!bestSynced) {
              bestSynced = item.syncedLyrics;
              if (durSec === 0) break;
            }
          }
          if (!bestPlain && item.plainLyrics) {
            bestPlain = item.plainLyrics;
          }
        }

        if (bestSynced) {
          const parsed = parseLrcText(bestSynced, title);
          if (parsed && parsed.lines && parsed.lines.length > 0) {
            return parsed;
          }
        }

        // Fallback to smoothly paced plain lyrics
        if (bestPlain) {
          const parsed = parsePlainLyricsText(bestPlain, title, durationMs);
          if (parsed && parsed.lines && parsed.lines.length > 0) {
            return parsed;
          }
        }
      }
    }
  } catch (err) {
    console.error('Direct LRCLIB fetch error:', err);
  }

  return null;
}

function parsePlainLyricsText(plainText, title, durationMs) {
  if (!plainText) return null;
  const rawLines = plainText.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('[') && !l.startsWith('{'));
  if (rawLines.length === 0) return null;

  const totalDur = durationMs && durationMs > 30000 ? durationMs : (rawLines.length * 4500);
  const startOffset = Math.min(10000, Math.round(totalDur / 12));
  const usableDuration = Math.max(10000, totalDur - startOffset - 5000);
  const lineStep = Math.max(2200, Math.round(usableDuration / rawLines.length));

  const timedLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i];
    const lineStart = startOffset + (i * lineStep);
    const lineDur = Math.min(lineStep - 300, Math.max(1200, text.length * 110));
    const tokens = text.split(/\s+/).filter(Boolean);
    const totalChars = tokens.reduce((acc, t) => acc + Math.max(1, t.length), 0);

    let curStart = lineStart;
    const words = tokens.map((t) => {
      const weight = Math.max(1, t.length);
      const wDur = Math.max(100, Math.round((weight / Math.max(1, totalChars)) * lineDur));
      const wObj = { word: t, startMs: curStart, durationMs: wDur, endMs: curStart + wDur };
      curStart += wDur;
      return wObj;
    });

    timedLines.push({
      startMs: lineStart,
      durationMs: lineDur,
      endMs: lineStart + lineDur,
      text,
      words
    });
  }

  return {
    title,
    isWordLevel: false,
    lines: timedLines
  };
}

let currentStyle = localStorage.getItem('wavforms_style') || 'visual';

// ──── CANVAS ACOUSTIC WATER SPLASH RIPPLES ────
const rippleCanvas = document.getElementById('ocean-ripple-canvas');
const rippleCtx = rippleCanvas ? rippleCanvas.getContext('2d') : null;
let ripples = [];

function resizeRippleCanvas() {
  if (!rippleCanvas) return;
  rippleCanvas.width = window.innerWidth;
  rippleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeRippleCanvas);
resizeRippleCanvas();

function spawnWordSplash(el, color) {
  if (!rippleCanvas || !el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  ripples.push({
    x,
    y,
    radius: 12,
    maxRadius: Math.min(Math.max(rect.width * 1.6, 60), 160),
    opacity: 0.85,
    color: color || '#ffffff',
    lineWidth: 2.4
  });
}

function renderRipples() {
  if (!rippleCtx) return;
  rippleCtx.clearRect(0, 0, rippleCanvas.width, rippleCanvas.height);
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    rippleCtx.save();
    rippleCtx.beginPath();
    rippleCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    rippleCtx.strokeStyle = r.color;
    rippleCtx.globalAlpha = r.opacity;
    rippleCtx.lineWidth = r.lineWidth;
    rippleCtx.shadowColor = r.color;
    rippleCtx.shadowBlur = 16;
    rippleCtx.stroke();
    rippleCtx.restore();

    r.radius += 3.4;
    r.opacity *= 0.89;
    r.lineWidth *= 0.95;

    if (r.opacity < 0.03 || r.radius > r.maxRadius) {
      ripples.splice(i, 1);
    }
  }
}

// ──── VERCI SIGNATURE KINETIC VISUAL ENGINE ────
const VERCI_ICONS = {
  person: `<svg viewBox="0 0 24 24" class="verci-icon" fill="currentColor"><path d="M12 12c2.4 0 4.4-2 4.4-4.4s-2-4.4-4.4-4.4-4.4 2-4.4 4.4 2 4.4 4.4 4.4zm0 2.4c-2.9 0-8.8 1.5-8.8 4.4v2.4h17.6v-2.4c0-2.9-5.9-4.4-8.8-4.4z"/></svg>`,
  speech: `<svg viewBox="0 0 24 24" class="verci-icon" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" class="verci-icon" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  signature: `<svg viewBox="0 0 48 32" class="verci-icon" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22l6-8m-6 0l6 8"/><path d="M14 26c3-16 6-16 9 0s6 16 9 0 6-16 9 0"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" class="verci-icon" fill="currentColor"><path d="M12 23c-4.42 0-8-3.58-8-8 0-4.08 3.05-7.44 7-7.93V4c0-.55.45-1 1-1s1 .45 1 1v3.07c3.95.49 7 3.85 7 7.93 0 4.42-3.58 8-8 8zm0-12.93c-2.73.46-4.8 2.82-4.8 5.68 0 3.2 2.6 5.8 5.8 5.8s5.8-2.6 5.8-5.8c0-2.86-2.07-5.22-4.8-5.68V10.07z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" class="verci-icon" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.2L12 16.6 5.7 21.2 8 14l-6-4.6h7.6z"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" class="verci-icon" fill="currentColor"><path d="M12.3 2a10 10 0 0 0-.3 20 10 10 0 0 0 9-5.6 10 10 0 0 1-11-11 10 10 0 0 1 2.3-3.4z"/></svg>`,
  droplet: `<svg viewBox="0 0 24 24" class="verci-icon" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  music: `<svg viewBox="0 0 24 24" class="verci-icon" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`
};

function getVerciIcon(word) {
  if (!word) return null;
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (['you', 'me', 'i', 'we', 'he', 'she', 'baby', 'girl', 'boy', 'man', 'woman', 'us'].includes(w)) return VERCI_ICONS.person;
  if (['tell', 'say', 'speak', 'talk', 'call', 'voice', 'words', 'hear', 'shout', 'sing'].includes(w)) return VERCI_ICONS.speech;
  if (['love', 'heart', 'need', 'touch', 'feel', 'forever', 'hold', 'dear', 'kiss'].includes(w)) return VERCI_ICONS.heart;
  if (['name', 'sign', 'write', 'fame', 'remember', 'read', 'draw', 'track', 'mark'].includes(w)) return VERCI_ICONS.signature;
  if (['fire', 'burn', 'flame', 'hot', 'blaze', 'smoke', 'wild'].includes(w)) return VERCI_ICONS.flame;
  if (['shine', 'star', 'stars', 'light', 'lights', 'glow', 'blinded', 'bright'].includes(w)) return VERCI_ICONS.star;
  if (['night', 'moon', 'midnight', 'dark', 'dream', 'sleep'].includes(w)) return VERCI_ICONS.moon;
  if (['ocean', 'sea', 'water', 'rain', 'tear', 'tears', 'cry', 'drown'].includes(w)) return VERCI_ICONS.droplet;
  if (['music', 'song', 'sound', 'dance', 'beat', 'rhythm'].includes(w)) return VERCI_ICONS.music;
  return null;
}

function getVerciWordType(word, index) {
  if (!word) return 'giant';
  const w = word.toLowerCase().replace(/[^a-z']/g, '');

  const BADGE_WORDS = new Set([
    'you', 'could', 'on', "i'm", 'im', 'it', 'in', 'me', 'we', 'so', 'can', 'to', 'for', 
    'and', 'is', 'am', 'be', 'up', 'down', 'out', 'all', 'now', 'if', 'at', 'by', 'with', 
    'no', 'go', 'do', 'too', 'as', 'my', 'he', 'she', 'us', 'the', 'of', 'off', 'but', 'not'
  ]);
  if (BADGE_WORDS.has(w)) return 'badge';

  const BOX_WORDS = new Set([
    'name', 'touch', 'night', 'dream', 'eyes', 'face', 'voice', 'kiss', 'heart', 'cold', 
    'lights', 'sky', 'time', 'world', 'rain', 'tears', 'alone', 'hold'
  ]);
  if (BOX_WORDS.has(w)) return 'box';

  if (w.length <= 3 && (index % 2 === 1)) return 'badge';
  if (w.length >= 4 && w.length <= 6 && (index % 5 === 2)) return 'box';

  return 'giant';
}

function buildVerciRowHtml(w, tierClass, index) {
  if (!w) return '';
  const type = w.type || getVerciWordType(w.word, index);
  const wordLen = (w.word || '').length || 5;

  let content = '';
  if (type === 'badge') {
    content = `
      <div class="verci-badge" style="--word-len: ${wordLen};">
        <span class="verci-badge-text" style="--word-len: ${wordLen};">${w.word}</span>
      </div>
    `;
  } else if (type === 'box') {
    content = `
      <div class="verci-box-highlight" style="--word-len: ${wordLen};">
        <span class="verci-box-text" style="--word-len: ${wordLen};">${w.word}</span>
      </div>
    `;
  } else {
    content = `
      <span class="verci-word-giant" style="--word-len: ${wordLen};">${w.word}</span>
    `;
  }

  return `<div class="verci-row ${tierClass}" id="vrow-${index}" data-widx="${index}" style="--word-len: ${wordLen};">${content}</div>`;
}

// Global Unified Word Stream across entire song for seamless kinetic flow
let unifiedWordStream = [];
let currentUnifiedWordIdx = -1;

function compileUnifiedWordStream(lyrics) {
  unifiedWordStream = [];
  currentUnifiedWordIdx = -1;

  if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) return;

  let globalIdx = 0;
  lyrics.lines.forEach((line, lineIdx) => {
    if (!line.words || line.words.length === 0) return;

    line.words.forEach((w) => {
      const clean = (w.word || '').trim();
      if (!clean) return;

      const type = getVerciWordType(clean, globalIdx);
      const icon = getVerciIcon(clean);

      unifiedWordStream.push({
        gIdx: globalIdx,
        lineIdx,
        word: clean,
        startMs: w.startMs,
        durationMs: w.durationMs,
        endMs: w.endMs || (w.startMs + w.durationMs),
        type,
        icon
      });
      globalIdx++;
    });
  });
}

function renderFullVerciTrack() {
  currentUnifiedWordIdx = -1;

  if (unifiedWordStream.length === 0) {
    currentLineEl.innerHTML = '<span class="idle-message">No synchronized lyrics for this song</span>';
    return;
  }

  let rowsHtml = '';
  unifiedWordStream.forEach((w, idx) => {
    // Only first word starts as row-next, all others as row-future
    const tier = idx === 0 ? 'row-next' : 'row-future';
    rowsHtml += buildVerciRowHtml(w, tier, idx);
  });

  currentLineEl.innerHTML = `
    <div class="verci-kinetic-viewport" id="verci-viewport">
      <div class="verci-kinetic-track" id="verci-track">
        ${rowsHtml}
      </div>
    </div>
  `;

  // Align immediately to word 0 without animation
  requestAnimationFrame(() => {
    alignTrackToWord(0, false);
  });
}

function alignTrackToWord(wIdx, animate = true) {
  const track = document.getElementById('verci-track');
  const row = document.getElementById(`vrow-${wIdx}`);
  if (!track || !row) return;

  if (!animate) {
    track.style.transition = 'none';
  } else {
    track.style.transition = 'transform 0.40s cubic-bezier(0.16, 1, 0.3, 1)';
  }

  const targetY = row.offsetTop + (row.offsetHeight / 2);
  track.style.transform = `translate3d(0, ${-targetY}px, 0)`;

  if (!animate) {
    requestAnimationFrame(() => {
      track.style.transition = 'transform 0.40s cubic-bezier(0.16, 1, 0.3, 1)';
    });
  }
}

function updateVerciUnifiedStream(curMs) {
  const stream = unifiedWordStream;
  if (!stream || stream.length === 0) return;

  // Case 1: Intro before singing starts
  if (curMs < stream[0].startMs) {
    if (currentUnifiedWordIdx !== -1) {
      currentUnifiedWordIdx = -1;
      alignTrackToWord(0, false);
      const r0 = document.getElementById('vrow-0');
      if (r0) r0.className = 'verci-row row-next';
    }
    return;
  }

  // Case 2: Find active word based on song progress
  let activeIdx = 0;
  for (let i = 0; i < stream.length; i++) {
    if (curMs >= stream[i].startMs) {
      activeIdx = i;
    } else {
      break;
    }
  }

  const activeW = stream[activeIdx];
  const nextW = (activeIdx + 1 < stream.length) ? stream[activeIdx + 1] : null;

  // Instrumental gap check (e.g. musical solo > 1.6s between words)
  let isInInterlude = false;
  if (curMs >= activeW.endMs && nextW) {
    const gap = nextW.startMs - activeW.endMs;
    if (gap > 1600 && curMs > (activeW.endMs + 350) && curMs < (nextW.startMs - 350)) {
      isInInterlude = true;
    }
  }

  if (isInInterlude) {
    const activeEl = document.getElementById(`vrow-${activeIdx}`);
    if (activeEl && activeEl.classList.contains('row-active')) {
      activeEl.className = 'verci-row row-past';
    }
    return;
  }

  if (activeIdx === currentUnifiedWordIdx) return;
  currentUnifiedWordIdx = activeIdx;

  // Smooth continuous GPU kinetic glide
  alignTrackToWord(activeIdx, true);

  // Update styling in local window around active word
  const winStart = Math.max(0, activeIdx - 5);
  const winEnd = Math.min(stream.length - 1, activeIdx + 6);

  for (let j = winStart; j <= winEnd; j++) {
    const rowEl = document.getElementById(`vrow-${j}`);
    if (!rowEl) continue;

    if (j < activeIdx - 1) {
      rowEl.className = 'verci-row row-past-far';
    } else if (j < activeIdx) {
      rowEl.className = 'verci-row row-past';
    } else if (j === activeIdx) {
      rowEl.className = 'verci-row row-active';
    } else if (j === activeIdx + 1) {
      rowEl.className = 'verci-row row-next';
    } else {
      rowEl.className = 'verci-row row-future';
    }
  }

  // Fluid acoustic ripple splash on active word
  const activeRowEl = document.getElementById(`vrow-${activeIdx}`);
  if (activeRowEl) {
    const splashColor = activeW.type === 'badge' ? '#ff2a5f' : (activeW.type === 'box' ? '#fda4af' : '#ff3344');
    spawnWordSplash(activeRowEl, splashColor);
  }

  // Update line index tracking for lyrics and Discord RPC
  if (activeW.lineIdx !== undefined && activeW.lineIdx !== activeLineIndex) {
    activeLineIndex = activeW.lineIdx;
    updateDiscordRPC(true);
  }
}

// ──── RENDER SINGLE ACTIVE LINE AS FAST-PACED OCEAN DROPS (FOR SHIP MODE) ────
function renderLineOceanDrops(lineIdx) {
  if (!currentLyrics || !currentLyrics.lines[lineIdx]) return;
  const line = currentLyrics.lines[lineIdx];

  // Previous line
  if (lineIdx > 0) {
    prevLineEl.textContent = currentLyrics.lines[lineIdx - 1].text;
  } else {
    prevLineEl.textContent = '';
  }

  // Next line (reflection)
  if (lineIdx + 1 < currentLyrics.lines.length) {
    nextLineEl.textContent = currentLyrics.lines[lineIdx + 1].text;
  } else {
    nextLineEl.textContent = '';
  }

  if (currentStyle === 'visual') {
    renderFullVerciTrack();
  } else {
    currentLineEl.innerHTML = '';
    currentLineEl.classList.toggle('line-dense', line.words.length > 8);
    currentLineEl.classList.toggle('line-ultra-dense', line.words.length > 13);
    line.words.forEach((w, wIdx) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word-drop just-dropped';
      wordSpan.id = `wd-${wIdx}`;
      wordSpan.textContent = w.word;

      const meta = getWordMeta(w.word);
      if (meta && meta.color) {
        wordSpan.style.setProperty('--word-active-color', meta.color);
      }
      currentLineEl.appendChild(wordSpan);
    });
  }
}

// ──── FAST-PACED 60/120 FPS REAL-TIME WORD-BY-WORD SYNC ────
function tick() {
  requestAnimationFrame(tick);
  renderRipples();

  const curSec = audio.currentTime;
  const curMs = (curSec * 1000) + lyricOffsetMs;
  const durSec = audio.duration || 0;

  hudCur.textContent = formatTime(curSec);
  hudDur.textContent = formatTime(durSec);

  if (durSec > 0 && !isSeeking) {
    const pct = (curSec / durSec) * 100;
    hudFill.style.width = `${pct}%`;
  }

  // Update Discord Rich Presence
  updateDiscordRPC();

  if (!currentLyrics || !currentLyrics.lines) return;

  // 1: VERCI SIGNATURE KINETIC VISUAL MODE (Continuous unified word flow)
  if (currentStyle === 'visual') {
    updateVerciUnifiedStream(curMs);
    return;
  }

  // 2: SHIP MODE: 3D PERSPECTIVE WALL HIGHLIGHT
  const lines = currentLyrics.lines;
  let targetLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const nextStart = (i + 1 < lines.length) ? lines[i + 1].startMs : Infinity;
    if (curMs >= l.startMs && curMs < nextStart) {
      targetLineIdx = i;
      break;
    }
  }

  if (targetLineIdx !== -1) {
    if (targetLineIdx !== activeLineIndex) {
      activeLineIndex = targetLineIdx;
      renderLineOceanDrops(activeLineIndex);
      updateDiscordRPC(true);
    }

    const activeLine = lines[activeLineIndex];
    activeLine.words.forEach((w, wIdx) => {
      const wEl = document.getElementById(`wd-${wIdx}`);
      if (!wEl) return;

      const isWordActive = curMs >= w.startMs && curMs < (w.startMs + w.durationMs);
      const hasPassed = curMs >= (w.startMs + w.durationMs);

      if (isWordActive) {
        if (!wEl.classList.contains('active')) {
          wEl.classList.add('active');
          wEl.classList.remove('passed');
        }
      } else if (hasPassed) {
        wEl.classList.remove('active');
        wEl.classList.add('passed');
      } else {
        wEl.classList.remove('active', 'passed');
      }
    });
  }
}
requestAnimationFrame(tick);

// ──── LOCAL AUDIO & FOLDER PROCESSING ────
async function handleFiles(fileList) {
  const files = Array.from(fileList);
  const audioFiles = files.filter(f => /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(f.name));
  const lyricFiles = files.filter(f => /\.(lrc|yrc)$/i.test(f.name));

  if (audioFiles.length === 0 && lyricFiles.length === 0) return;

  // Custom lyric dropped
  if (lyricFiles.length > 0 && audioFiles.length === 0) {
    const lFile = lyricFiles[0];
    const text = await lFile.text();
    const cleanName = lFile.name.replace(/\.[^/.]+$/, "");
    const parsed = parseLrcText(text, cleanName);
    if (parsed) {
      body.classList.remove('state-empty');
      currentLyrics = parsed;
      activeLineIndex = 0;
      compileUnifiedWordStream(currentLyrics);
      if (currentStyle === 'visual') {
        renderFullVerciTrack();
      } else {
        renderLineOceanDrops(0);
      }
      displayTitle.textContent = cleanName;
    }
    return;
  }

  for (const file of audioFiles) {
    let clean = file.name.replace(/\.[^/.]+$/, "");
    clean = clean.replace(/^\[?\d+\]?[\s.-]+/, '').trim();

    let parsedTitle = clean;
    let parsedArtist = "";

    if (clean.includes(" - ")) {
      const parts = clean.split(" - ");
      parsedArtist = parts[0].trim();
      parsedTitle = parts.slice(1).join(" - ").trim();
    } else if (clean.includes(" – ")) {
      const parts = clean.split(" – ");
      parsedArtist = parts[0].trim();
      parsedTitle = parts.slice(1).join(" – ").trim();
    } else if (clean.includes(" — ")) {
      const parts = clean.split(" — ");
      parsedArtist = parts[0].trim();
      parsedTitle = parts.slice(1).join(" — ").trim();
    }

    const track = {
      title: parsedTitle || clean,
      artist: parsedArtist,
      file: file,
      durationMs: 0
    };

    const matchingLyric = lyricFiles.find(lf => lf.name.replace(/\.[^/.]+$/, "").toLowerCase() === clean.toLowerCase());
    if (matchingLyric) {
      const lText = await matchingLyric.text();
      track.customLyrics = parseLrcText(lText, clean);
    }

    if (window.jsmediatags) {
      await new Promise(resolve => {
        window.jsmediatags.read(file, {
          onSuccess: (tag) => {
            const tags = tag.tags;
            if (tags.title) track.title = tags.title;
            if (tags.artist) track.artist = tags.artist;
            if (tags.picture) {
              const { data, format } = tags.picture;
              let base64 = "";
              for (let i = 0; i < data.length; i++) base64 += String.fromCharCode(data[i]);
              track.artwork = `data:${format};base64,${window.btoa(base64)}`;
              extractArtworkColor(track.artwork);
            }
            resolve();
          },
          onError: () => resolve()
        });
      });
    }

    playlist.push(track);
  }

  if (currentTrackIndex === -1 || audio.paused) {
    loadTrack(playlist.length - audioFiles.length);
  } else {
    renderQueue();
  }
}

function parseLrcText(lrcText, title) {
  const lines = lrcText.split(/\r?\n/);
  const rawParsed = [];
  const lrcRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\](.*)/;

  for (const l of lines) {
    const trimmed = l.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[ti:') || trimmed.startsWith('[ar:') || 
        trimmed.startsWith('[al:') || trimmed.startsWith('[by:') || trimmed.startsWith('[offset:')) {
      continue;
    }

    const m = lrcRegex.exec(trimmed);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    let ms = 0;
    if (m[3]) {
      if (m[3].length === 1) ms = parseInt(m[3], 10) * 100;
      else if (m[3].length === 2) ms = parseInt(m[3], 10) * 10;
      else ms = parseInt(m[3], 10);
    }
    const totalMs = min * 60000 + sec * 1000 + ms;
    const text = m[4].trim();
    if (text) {
      rawParsed.push({ startMs: totalMs, text, explicitEndMs: 0 });
    } else if (rawParsed.length > 0) {
      const last = rawParsed[rawParsed.length - 1];
      if (!last.explicitEndMs && totalMs > last.startMs) {
        last.explicitEndMs = totalMs;
      }
    }
  }

  if (rawParsed.length === 0) return null;
  rawParsed.sort((a, b) => a.startMs - b.startMs);

  const timedLines = [];
  for (let i = 0; i < rawParsed.length; i++) {
    const item = rawParsed[i];
    const nextStart = (i + 1 < rawParsed.length) ? rawParsed[i + 1].startMs : (item.startMs + 4500);
    const gap = nextStart - item.startMs;
    const tokens = item.text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    let durMs;
    if (item.explicitEndMs && item.explicitEndMs > item.startMs) {
      durMs = item.explicitEndMs - item.startMs;
    } else if (gap > 4500) {
      durMs = Math.min(gap - 600, Math.max(1200, tokens.length * 420 + 350));
    } else {
      durMs = Math.max(900, Math.min(6500, gap - 120));
    }

    const totalChars = tokens.reduce((acc, t) => acc + Math.max(1, t.length), 0);
    let curStart = item.startMs;
    const words = tokens.map((t) => {
      const weight = Math.max(1, t.length);
      const wDur = Math.max(120, Math.round((weight / totalChars) * durMs));
      const wObj = { word: t, startMs: curStart, durationMs: wDur, endMs: curStart + wDur };
      curStart += wDur;
      return wObj;
    });

    timedLines.push({
      startMs: item.startMs,
      durationMs: durMs,
      endMs: item.startMs + durMs,
      text: item.text,
      words
    });
  }

  return { title, artist: "Custom Lyrics", isWordLevel: false, lines: timedLines };
}

// File Inputs (both top-bar and landing-card)
document.getElementById('file-input').addEventListener('change', (e) => handleFiles(e.target.files));
document.getElementById('folder-input').addEventListener('change', (e) => handleFiles(e.target.files));
document.getElementById('landing-file-input').addEventListener('change', (e) => handleFiles(e.target.files));
document.getElementById('landing-folder-input').addEventListener('change', (e) => handleFiles(e.target.files));

// Drag & Drop
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('active');
});
dropOverlay.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) dropOverlay.classList.remove('active');
});
dropOverlay.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.classList.remove('active');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFiles(e.dataTransfer.files);
  }
});

// Queue Drawer
function renderQueue() {
  queueNum.textContent = playlist.length;
  queueItems.innerHTML = '';

  if (playlist.length === 0) {
    queueItems.innerHTML = '<div class="queue-empty">Drop music files or a folder to build your playlist.</div>';
    return;
  }

  playlist.forEach((track, idx) => {
    const el = document.createElement('div');
    el.className = `queue-card ${idx === currentTrackIndex ? 'active' : ''}`;
    el.innerHTML = `
      <div class="queue-title">${track.title}</div>
      <div class="queue-artist">${track.artist || 'Local Track'}</div>
    `;
    el.addEventListener('click', () => loadTrack(idx));
    queueItems.appendChild(el);
  });
}

document.getElementById('btn-queue').addEventListener('click', () => {
  queuePanel.classList.toggle('open');
});
document.getElementById('queue-close').addEventListener('click', () => {
  queuePanel.classList.remove('open');
});

// Style Switcher: VISUAL, SHIP & AUDIO VISUALS
function switchStyle(styleName) {
  currentStyle = styleName;
  localStorage.setItem('wavforms_style', currentStyle);

  document.querySelectorAll('.nav-item').forEach(b => {
    if (b.dataset.style === currentStyle) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  document.body.className = `style-${currentStyle} font-${currentFontId} ${playlist.length === 0 ? 'state-empty' : ''}`;

  if (currentStyle === 'visualizer') {
    if (window.milkdropEngine) {
      window.milkdropEngine.start();
      window.milkdropEngine.resize();
    } else if (window.visualizerManager) {
      window.visualizerManager.start();
      if (window.visualizerManager.activeVisualizer) {
        window.visualizerManager.activeVisualizer.resize(window.innerWidth, window.innerHeight);
      }
    }
    if (currentLyrics && activeLineIndex >= 0) {
      renderLineOceanDrops(activeLineIndex);
    }
  } else {
    if (window.milkdropEngine) {
      window.milkdropEngine.pause();
    } else if (window.visualizerManager && window.visualizerManager.pause) {
      window.visualizerManager.pause();
    }
    if (currentStyle === 'visual') {
      if (currentLyrics) {
        renderFullVerciTrack();
      }
    } else if (currentStyle === 'ship') {
      if (currentLyrics && activeLineIndex >= 0) {
        renderLineOceanDrops(activeLineIndex);
      }
    }
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    switchStyle(btn.dataset.style);
  });
});

// Set initial style state
switchStyle(currentStyle);

// ──── DISCORD RICH PRESENCE (RPC) CLIENT ────
let lastDiscordUpdateMs = 0;
let lastDiscordLine = '';

function updateDiscordRPC(force = false) {
  const now = Date.now();
  if (!force && (now - lastDiscordUpdateMs < 3000)) return;

  const track = playlist[currentTrackIndex];
  if (!track) return;

  let lineText = '';
  if (currentLyrics && currentLyrics.lines && activeLineIndex >= 0 && currentLyrics.lines[activeLineIndex]) {
    lineText = currentLyrics.lines[activeLineIndex].text;
  }

  if (!force && lineText === lastDiscordLine && (now - lastDiscordUpdateMs < 6000)) return;
  lastDiscordUpdateMs = now;
  lastDiscordLine = lineText;

  fetch('/api/discord/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: track.title,
      artist: track.artist,
      lineText,
      currentSec: audio.currentTime,
      durationSec: audio.duration,
      paused: audio.paused
    })
  }).then(r => r.json()).then(data => {
    const pill = document.getElementById('discord-rpc-pill');
    if (pill) {
      if (data.connected) {
        pill.classList.add('connected');
      } else {
        pill.classList.remove('connected');
      }
    }
  }).catch(() => {});
}

// ──── TYPOGRAPHY STUDIO (15 CURATED FONTS) ────
const FONTS = [
  { id: 'anton', name: 'Anton', tag: 'Bold Poster Impact', family: "'Anton', sans-serif" },
  { id: 'syne', name: 'Syne', tag: 'Avant-Garde Luxury', family: "'Syne', sans-serif" },
  { id: 'cinzel', name: 'Cinzel', tag: 'Imperial Roman', family: "'Cinzel', serif" },
  { id: 'plus-jakarta', name: 'Plus Jakarta Sans', tag: 'Modern Neo-Grotesque', family: "'Plus Jakarta Sans', sans-serif" },
  { id: 'space-grotesk', name: 'Space Grotesk', tag: 'Cyber Tech Brutalism', family: "'Space Grotesk', sans-serif" },
  { id: 'bebas-neue', name: 'Bebas Neue', tag: 'Cinematic Billboard', family: "'Bebas Neue', sans-serif" },
  { id: 'playfair', name: 'Playfair Display', tag: 'Vogue Editorial Serif', family: "'Playfair Display', serif" },
  { id: 'outfit', name: 'Outfit', tag: 'Clean Geometric Sans', family: "'Outfit', sans-serif" },
  { id: 'righteous', name: 'Righteous', tag: 'Retro 80s Synthwave', family: "'Righteous', cursive" },
  { id: 'unbounded', name: 'Unbounded', tag: 'Futuristic Ultra-Wide', family: "'Unbounded', sans-serif" },
  { id: 'oswald', name: 'Oswald', tag: 'Modern Gothic Caps', family: "'Oswald', sans-serif" },
  { id: 'italiana', name: 'Italiana', tag: 'Milan Haute Couture', family: "'Italiana', serif" },
  { id: 'orbitron', name: 'Orbitron', tag: 'Sci-Fi Cyberpunk', family: "'Orbitron', sans-serif" },
  { id: 'major-mono', name: 'Major Mono Display', tag: 'Abstract Experimental', family: "'Major Mono Display', monospace" },
  { id: 'jetbrains', name: 'JetBrains Mono', tag: 'Developer Terminal', family: "'JetBrains Mono', monospace" }
];

let currentFontId = localStorage.getItem('wavforms_font') || 'anton';

function initTypographyStudio() {
  const fontPickerWrap = document.getElementById('font-picker-wrap');
  const btnFontPicker = document.getElementById('btn-font-picker');
  const fontBtnLabel = document.getElementById('font-btn-label');
  const fontGrid = document.getElementById('font-grid');

  if (!fontPickerWrap || !fontGrid || !btnFontPicker) return;

  function renderFontGrid() {
    fontGrid.innerHTML = '';
    FONTS.forEach(font => {
      const item = document.createElement('div');
      item.className = `font-item ${font.id === currentFontId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="font-item-info">
          <span class="font-item-preview" style="font-family: ${font.family}">${font.name}</span>
          <span class="font-item-tag">${font.tag}</span>
        </div>
        <span class="font-item-check">✓</span>
      `;
      item.addEventListener('click', () => {
        applyFont(font.id);
        fontPickerWrap.classList.remove('open');
      });
      fontGrid.appendChild(item);
    });
  }

  function applyFont(fontId) {
    const font = FONTS.find(f => f.id === fontId) || FONTS[0];
    currentFontId = font.id;
    localStorage.setItem('wavforms_font', currentFontId);

    FONTS.forEach(f => document.body.classList.remove(`font-${f.id}`));
    document.body.classList.add(`font-${currentFontId}`);
    document.documentElement.style.setProperty('--font-lyrics', font.family);

    if (fontBtnLabel) {
      fontBtnLabel.textContent = font.name;
    }

    renderFontGrid();
  }

  btnFontPicker.addEventListener('click', (e) => {
    e.stopPropagation();
    fontPickerWrap.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!fontPickerWrap.contains(e.target)) {
      fontPickerWrap.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fontPickerWrap.classList.remove('open');
    }
  });

  applyFont(currentFontId);
}

// Initialize typography studio
initTypographyStudio();

// ──── MILKDROP 3 AUDIO VISUALIZER INITIALIZATION ────
function initVisualizers() {
  const container = document.getElementById('visualizer-container');
  if (!container) return;

  if (window.milkdropEngine) {
    window.milkdropEngine.init(container);

    const btnVizPicker = document.getElementById('btn-viz-picker');
    if (btnVizPicker) {
      btnVizPicker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentStyle !== 'visualizer') {
          switchStyle('visualizer');
        }
        window.milkdropEngine.toggleDrawer();
      });
    }
    window.milkdropEngine.updateUI();
    return;
  }

  if (!window.visualizerManager) return;
  window.visualizerManager.init(container);

  // Setup UI Drawer elements
  const btnVizPicker = document.getElementById('btn-viz-picker');
  const vizDrawer = document.getElementById('viz-drawer');
  const vizDrawerClose = document.getElementById('viz-drawer-close');
  const vizDrawerBackdrop = document.getElementById('viz-drawer-backdrop');
  const vizGrid = document.getElementById('viz-grid');
  const qualityBtns = document.querySelectorAll('.viz-quality-btn');

  // Populate 15 cards in drawer grid
  if (vizGrid) {
    vizGrid.innerHTML = '';
    window.visualizerManager.catalogue.forEach(v => {
      const card = document.createElement('div');
      card.className = `viz-card ${v.id === window.visualizerManager.currentId ? 'active' : ''}`;
      card.dataset.id = v.id;
      card.innerHTML = `
        <div class="viz-card-top">
          <span class="viz-card-num">${v.num}</span>
          <span class="viz-card-indicator"></span>
        </div>
        <div class="viz-card-name">${v.name}</div>
        <p class="viz-card-desc">${v.desc}</p>
      `;
      card.addEventListener('click', () => {
        window.visualizerManager.mountVisualizer(v.id, true);
        window.visualizerManager.closeDrawer();
      });
      vizGrid.appendChild(card);
    });
  }

  // Quality selector buttons
  qualityBtns.forEach(btn => {
    if (btn.dataset.quality === window.visualizerManager.quality) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', () => {
      qualityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.visualizerManager.setQuality(btn.dataset.quality);
    });
  });

  // Open/close drawer triggers
  if (btnVizPicker) {
    btnVizPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentStyle !== 'visualizer') {
        switchStyle('visualizer');
      }
      window.visualizerManager.toggleDrawer();
    });
  }
  if (vizDrawerClose) {
    vizDrawerClose.addEventListener('click', () => window.visualizerManager.closeDrawer());
  }
  if (vizDrawerBackdrop) {
    vizDrawerBackdrop.addEventListener('click', () => window.visualizerManager.closeDrawer());
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && vizDrawer && vizDrawer.classList.contains('open')) {
      window.visualizerManager.closeDrawer();
    }
  });

  // Update initial UI button label
  window.visualizerManager.updateUI();
}

// Initialize Visualizers
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVisualizers);
} else {
  initVisualizers();
}
