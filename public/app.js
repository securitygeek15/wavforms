// ═══════════════════════════════════════════════════════════════
//   wavforms — "Drops in an Ocean" Word-by-Word Lyric Engine
// ═══════════════════════════════════════════════════════════════

// Rich vocabulary mapping with custom emotion colors and emojis
const VOCABULARY = {
  // Love & Romance (Rose / Coral)
  "love": { icon: "❤️", color: "#fb7185" },
  "heart": { icon: "❤️", color: "#fb7185" },
  "broken": { icon: "💔", color: "#f43f5e" },
  "kiss": { icon: "💋", color: "#f43f5e" },
  "touch": { icon: "✨", color: "#f472b6" },
  "baby": { icon: "👶", color: "#f472b6" },
  "sweet": { icon: "🍭", color: "#fb7185" },
  "crying": { icon: "😢", color: "#60a5fa" },
  "cry": { icon: "😢", color: "#60a5fa" },
  "tears": { icon: "💧", color: "#38bdf8" },

  // Light, Starlight & Euphoria (Amber / Gold / Violet)
  "light": { icon: "💡", color: "#facc15" },
  "lights": { icon: "💡", color: "#facc15" },
  "blinded": { icon: "✨", color: "#fbbf24" },
  "shine": { icon: "✨", color: "#fbbf24" },
  "sun": { icon: "☀️", color: "#f59e0b" },
  "star": { icon: "⭐", color: "#fbbf24" },
  "stars": { icon: "✨", color: "#e879f9" },
  "sky": { icon: "🌌", color: "#c084fc" },
  "night": { icon: "🌃", color: "#a855f7" },
  "moon": { icon: "🌙", color: "#e879f9" },
  "dream": { icon: "💭", color: "#c084fc" },

  // Water, Ocean & Cold (Aquatic Cyan / Glacier Blue)
  "water": { icon: "💧", color: "#00f2fe" },
  "ocean": { icon: "🌊", color: "#00f2fe" },
  "sea": { icon: "🌊", color: "#38bdf8" },
  "wave": { icon: "🌊", color: "#38bdf8" },
  "drowning": { icon: "🌊", color: "#00f2fe" },
  "rain": { icon: "🌧️", color: "#38bdf8" },
  "storm": { icon: "⛈️", color: "#60a5fa" },
  "cold": { icon: "❄️", color: "#a5f3fc" },
  "ice": { icon: "❄️", color: "#a5f3fc" },
  "empty": { icon: "🫙", color: "#94a3b8" },

  // Fire, Heat & Energy (Flame Crimson / Orange)
  "fire": { icon: "🔥", color: "#ff453a" },
  "flame": { icon: "🔥", color: "#ff453a" },
  "burn": { icon: "🔥", color: "#ff5e3a" },
  "hot": { icon: "🔥", color: "#ff9f0a" },
  "overdrive": { icon: "⚡", color: "#fbbf24" },
  "wild": { icon: "⚡", color: "#ff9f0a" },

  // Movement, Speed & Action (Emerald / Neon)
  "run": { icon: "🏃", color: "#34d399" },
  "running": { icon: "🏃", color: "#34d399" },
  "walk": { icon: "🚶", color: "#10b981" },
  "walking": { icon: "🚶", color: "#10b981" },
  "car": { icon: "🏎️", color: "#34d399" },
  "drive": { icon: "🚗", color: "#34d399" },
  "road": { icon: "🛣️", color: "#10b981" },
  "city": { icon: "🏙️", color: "#38bdf8" },
  "sleep": { icon: "🌙", color: "#c084fc" },
  "wake": { icon: "⏰", color: "#facc15" },
  "time": { icon: "⏳", color: "#facc15" },
  "phone": { icon: "📱", color: "#38bdf8" },
  "eyes": { icon: "👁️", color: "#60a5fa" },
  "look": { icon: "👀", color: "#60a5fa" },
  "dance": { icon: "💃", color: "#fb7185" },
  "music": { icon: "🎵", color: "#a855f7" },
  "song": { icon: "🎶", color: "#a855f7" }
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
let lyricOffsetMs = 0; // Millisecond fine-tuning sync offset
let isSeeking = false;

// DOM
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

// ──── OFFSET CALIBRATION (Insane Accuracy) ────
function updateOffset(deltaMs) {
  lyricOffsetMs += deltaMs;
  const sec = (lyricOffsetMs / 1000).toFixed(1);
  offsetDisplay.textContent = `${sec >= 0 ? '+' : ''}${sec}s`;
}

document.getElementById('btn-offset-minus').addEventListener('click', () => updateOffset(-100));
document.getElementById('btn-offset-plus').addEventListener('click', () => updateOffset(100));

// ──── PLAYBACK CONTROLS ────
function togglePlayback() {
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
    updateOffset(-100);
  } else if (e.key === ']' || e.key === '}') {
    updateOffset(100);
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

  // Insane Accuracy: wait for audio metadata so exact duration is known
  let exactDurationMs = track.durationMs || 0;
  if (!exactDurationMs && audio) {
    await new Promise(resolve => {
      if (audio.readyState >= 1) {
        exactDurationMs = Math.round(audio.duration * 1000);
        resolve();
      } else {
        audio.onloadedmetadata = () => {
          exactDurationMs = Math.round(audio.duration * 1000);
          resolve();
        };
        setTimeout(resolve, 800); // safety fallback
      }
    });
  }

  // Fetch lyrics with exact duration
  if (track.customLyrics) {
    currentLyrics = track.customLyrics;
  } else {
    currentLyrics = await fetchLyrics(track.title, track.artist, exactDurationMs);
  }

  if (currentLyrics && currentLyrics.lines && currentLyrics.lines.length > 0) {
    activeLineIndex = 0;
    renderLineOceanDrops(0);
  } else {
    currentLineEl.innerHTML = '<span class="idle-message">No synchronized lyrics found for this song</span>';
  }

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

// ──── LYRICS API ────
async function fetchLyrics(title, artist, durationMs) {
  try {
    const url = `/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}&duration=${durationMs}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.lines && data.lines.length > 0 ? data : null;
  } catch (err) {
    console.error('Lyric fetch error:', err);
    return null;
  }
}

// ──── RENDER SINGLE ACTIVE LINE AS FLUID OCEAN DROPS ────
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

  // Active Line: build words with ocean drop animation
  currentLineEl.innerHTML = '';
  line.words.forEach((w, wIdx) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word-drop just-dropped';
    wordSpan.id = `wd-${wIdx}`;
    wordSpan.textContent = w.word;

    // Attach contextual emotion/aesthetic color
    const meta = getWordMeta(w.word);
    if (meta && meta.color) {
      wordSpan.style.setProperty('--word-active-color', meta.color);
    }

    currentLineEl.appendChild(wordSpan);
  });
}

// ──── REAL-TIME WORD-BY-WORD SYNC TICK (60/120 FPS) ────
function tick() {
  requestAnimationFrame(tick);

  const curSec = audio.currentTime;
  const curMs = (curSec * 1000) + lyricOffsetMs;
  const durSec = audio.duration || 0;

  hudCur.textContent = formatTime(curSec);
  hudDur.textContent = formatTime(durSec);

  if (durSec > 0 && !isSeeking) {
    const pct = (curSec / durSec) * 100;
    hudFill.style.width = `${pct}%`;
  }

  if (!currentLyrics || !currentLyrics.lines) return;

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
    // If line changed, trigger the fluid ocean drop transition
    if (targetLineIdx !== activeLineIndex) {
      activeLineIndex = targetLineIdx;
      renderLineOceanDrops(activeLineIndex);
    }

    // Word lighting in active line
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

          // Pop in emoji bubble if matched
          const meta = getWordMeta(w.word);
          if (meta && meta.icon && !wEl.querySelector('.word-emoji')) {
            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'word-emoji';
            emojiSpan.textContent = meta.icon;
            wEl.appendChild(emojiSpan);
          }
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
      currentLyrics = parsed;
      activeLineIndex = 0;
      renderLineOceanDrops(0);
      displayTitle.textContent = cleanName;
    }
    return;
  }

  for (const file of audioFiles) {
    const clean = file.name.replace(/\.[^/.]+$/, "");
    const track = {
      title: clean,
      artist: "Local Track",
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
  const parsed = [];
  const lrcRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const l of lines) {
    const m = lrcRegex.exec(l.trim());
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const ms = m[3].length === 2 ? parseInt(m[3], 10) * 10 : parseInt(m[3], 10);
    const totalMs = min * 60000 + sec * 1000 + ms;
    const text = m[4].trim();
    if (text) parsed.push({ startMs: totalMs, text });
  }

  if (parsed.length === 0) return null;
  parsed.sort((a, b) => a.startMs - b.startMs);

  const timedLines = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const nextStart = (i + 1 < parsed.length) ? parsed[i + 1].startMs : (item.startMs + 4000);
    const durMs = Math.max(1000, nextStart - item.startMs);
    const tokens = item.text.split(' ');
    const totalChars = tokens.reduce((acc, t) => acc + Math.max(1, t.length), 0);

    let curStart = item.startMs;
    const words = tokens.map(t => {
      const weight = Math.max(1, t.length);
      const wDur = Math.max(100, Math.round((weight / totalChars) * durMs));
      const wObj = { word: t + ' ', startMs: curStart, durationMs: wDur };
      curStart += wDur;
      return wObj;
    });

    timedLines.push({ startMs: item.startMs, durationMs: durMs, text: item.text, words });
  }

  return { title, artist: "Custom Lyrics", isWordLevel: false, lines: timedLines };
}

// Inputs
document.getElementById('file-input').addEventListener('change', (e) => handleFiles(e.target.files));
document.getElementById('folder-input').addEventListener('change', (e) => handleFiles(e.target.files));

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

// Style Switcher
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.body.className = `style-${btn.dataset.style}`;
  });
});

// ──── PRELOADED DEFAULT SONG ────
playlist.push({
  title: "Blinding Lights",
  artist: "The Weeknd",
  durationMs: 200045,
  artwork: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36"
});
loadTrack(0);
