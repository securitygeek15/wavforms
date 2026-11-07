// ═══════════════════════════════════════════════════════════════
//   wavforms — Verci-Aesthetic Word-by-Word Synchronized Engine
// ═══════════════════════════════════════════════════════════════

// Mapped vocabulary tokens to SF Symbols / Glyphs
const ICON_MAP = {
  "love": "❤️", "heart": "❤️", "broken": "💔", "kiss": "💋",
  "light": "💡", "lights": "💡", "blinded": "✨", "shine": "✨",
  "sun": "☀️", "moon": "🌙", "star": "⭐", "stars": "✨", "sky": "🌌",
  "night": "🌃", "city": "🏙️", "cold": "❄️", "empty": "🫙",
  "run": "🏃", "running": "🏃", "walk": "🚶", "walking": "🚶",
  "sleep": "🌙", "wake": "⏰", "eyes": "👁️", "look": "👀",
  "touch": "✨", "baby": "👶", "car": "🏎️", "road": "🛣️",
  "overdrive": "⚡", "time": "⏳", "phone": "📱", "fire": "🔥",
  "rain": "🌧️", "storm": "⛈️", "sea": "🌊", "ocean": "🌊", "drowning": "🌊",
  "dance": "💃", "dancing": "🕺", "music": "🎵", "song": "🎶"
};

function resolveWordIcon(raw) {
  if (!raw) return null;
  const clean = raw.trim().replace(/[.,!?:;()"'`\-]/g, '').toLowerCase();
  if (ICON_MAP[clean]) return ICON_MAP[clean];
  if (clean.endsWith('ing') && clean.length > 4) {
    const root = clean.slice(0, -3);
    if (ICON_MAP[root]) return ICON_MAP[root];
  }
  return null;
}

// State
let playlist = [];
let currentTrackIndex = -1;
let currentLyrics = null;
let lastActiveLineIdx = -1;
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
const lyricsTrack = document.getElementById('lyrics-track');
const colorPicker = document.getElementById('palette-color-picker');
const colorDot = document.getElementById('color-dot');

const queuePanel = document.getElementById('queue-panel');
const queueItems = document.getElementById('queue-items');
const queueNum = document.getElementById('queue-num');
const dropOverlay = document.getElementById('drop-overlay');

// ──── PLAYBACK & HUD ────
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

// Keyboard shortcuts (Verci / Mac feel)
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlayback();
  } else if (e.code === 'ArrowRight') {
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
  } else if (e.code === 'ArrowLeft') {
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  } else if (e.key === 'f' || e.key === 'F') {
    toggleFullscreen();
  }
});

// Fullscreen
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}
document.getElementById('btn-fs').addEventListener('click', toggleFullscreen);

// Palette Picker
colorPicker.addEventListener('input', (e) => {
  const c = e.target.value;
  document.documentElement.style.setProperty('--color-highlight', c);
  colorDot.style.background = c;
});

// ──── TRACK LOADING & METADATA ────
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

  if (track.file) {
    audio.src = URL.createObjectURL(track.file);
  } else if (track.url) {
    audio.src = track.url;
  }

  // Load lyrics
  lyricsTrack.innerHTML = '<div class="line active">Searching synchronized lyrics...</div>';

  if (track.customLyrics) {
    currentLyrics = track.customLyrics;
    renderLyricsTree(currentLyrics);
  } else {
    const lyrics = await fetchLyrics(track.title, track.artist, track.durationMs || 0);
    if (lyrics && lyrics.lines && lyrics.lines.length > 0) {
      currentLyrics = lyrics;
      renderLyricsTree(lyrics);
    } else {
      currentLyrics = null;
      lyricsTrack.innerHTML = '<div class="line active">No synchronized lyrics available for this song.</div>';
    }
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

// ──── LYRIC API & PARSER ────
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

function renderLyricsTree(lyrics) {
  lastActiveLineIdx = -1;
  lyricsTrack.innerHTML = '';

  lyrics.lines.forEach((line, lIdx) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'line';
    lineEl.id = `line-${lIdx}`;

    line.words.forEach((w, wIdx) => {
      const wordEl = document.createElement('span');
      wordEl.className = 'word';
      wordEl.id = `w-${lIdx}-${wIdx}`;
      wordEl.textContent = w.word;
      lineEl.appendChild(wordEl);
    });

    lyricsTrack.appendChild(lineEl);
  });
}

// ──── 60/120 FPS REAL-TIME WORD-BY-WORD SYNC ────
function tick() {
  requestAnimationFrame(tick);

  const curSec = audio.currentTime;
  const curMs = curSec * 1000;
  const durSec = audio.duration || 0;

  hudCur.textContent = formatTime(curSec);
  hudDur.textContent = formatTime(durSec);

  if (durSec > 0 && !isSeeking) {
    const pct = (curSec / durSec) * 100;
    hudFill.style.width = `${pct}%`;
  }

  if (!currentLyrics || !currentLyrics.lines) return;

  const lines = currentLyrics.lines;
  let activeLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const nextStart = (i + 1 < lines.length) ? lines[i + 1].startMs : Infinity;
    if (curMs >= l.startMs && curMs < nextStart) {
      activeLineIdx = i;
      break;
    }
  }

  if (activeLineIdx !== -1) {
    if (activeLineIdx !== lastActiveLineIdx) {
      lastActiveLineIdx = activeLineIdx;

      const activeEl = document.getElementById(`line-${activeLineIdx}`);
      if (activeEl) {
        const stageH = lyricsTrack.parentElement.clientHeight;
        const offset = activeEl.offsetTop - (stageH / 2) + 30;
        lyricsTrack.style.transform = `translateY(-${Math.max(0, offset)}px)`;
      }

      lines.forEach((_, idx) => {
        const el = document.getElementById(`line-${idx}`);
        if (!el) return;
        if (idx === activeLineIdx) el.className = 'line active';
        else if (idx < activeLineIdx) el.className = 'line passed';
        else el.className = 'line';
      });
    }

    // Word lighting in active line
    const activeLine = lines[activeLineIdx];
    activeLine.words.forEach((w, wIdx) => {
      const wEl = document.getElementById(`w-${activeLineIdx}-${wIdx}`);
      if (!wEl) return;

      const isWordActive = curMs >= w.startMs && curMs < (w.startMs + w.durationMs);
      const hasPassed = curMs >= (w.startMs + w.durationMs);

      if (isWordActive) {
        wEl.className = 'word active';
        const glyph = resolveWordIcon(w.word);
        if (glyph && !wEl.querySelector('.icon-glyph')) {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'icon-glyph';
          iconSpan.textContent = glyph;
          wEl.appendChild(iconSpan);
        }
      } else if (hasPassed) {
        wEl.className = 'word passed';
      } else {
        wEl.className = 'word';
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

  // If a lyric file is dropped, attach it to the current or matching track
  if (lyricFiles.length > 0 && audioFiles.length === 0) {
    const lFile = lyricFiles[0];
    const text = await lFile.text();
    const cleanName = lFile.name.replace(/\.[^/.]+$/, "");
    const parsed = parseLrcText(text, cleanName);
    if (parsed) {
      currentLyrics = parsed;
      renderLyricsTree(currentLyrics);
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

    // Check if matching .lrc or .yrc exists in the dropped batch
    const matchingLyric = lyricFiles.find(lf => lf.name.replace(/\.[^/.]+$/, "").toLowerCase() === clean.toLowerCase());
    if (matchingLyric) {
      const lText = await matchingLyric.text();
      track.customLyrics = parseLrcText(lText, clean);
    }

    // Parse ID3 Tags
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

// File Inputs
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

// ──── PLAYLIST QUEUE DRAWER ────
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

// ──── STYLE SWITCHER (Verci) ────
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
