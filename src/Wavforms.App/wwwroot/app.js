let currentLyrics = null;
let currentPositionMs = 0;
let playbackDurationMs = 0;
let isPlaying = false;
let currentStyle = 'fisheye-visual';
let lastActiveLineIndex = -1;

// Elements
const body = document.body;
const trackArt = document.getElementById('track-art');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const timeCur = document.getElementById('time-cur');
const timeTotal = document.getElementById('time-total');
const lyricsTrack = document.getElementById('lyrics-track');
const playerBadge = document.getElementById('player-badge');

// Style Switcher
document.querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStyle = btn.dataset.style;
    body.className = `style-${currentStyle}`;
  });
});

// Window Controls (C# bridge)
document.getElementById('btn-min').addEventListener('click', () => {
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage({ type: 'minimize' });
  }
});

document.getElementById('btn-close').addEventListener('click', () => {
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage({ type: 'hide' });
  }
});

const pinBtn = document.getElementById('btn-pin');
let isPinned = true;
pinBtn.addEventListener('click', () => {
  isPinned = !isPinned;
  pinBtn.classList.toggle('active', isPinned);
  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.postMessage({ type: 'togglePin', pinned: isPinned });
  }
});

// Format ms to mm:ss
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Receive messages from C# backend
if (window.chrome && window.chrome.webview) {
  window.chrome.webview.addEventListener('message', event => {
    const data = event.data;
    if (data.type === 'trackChange') {
      updateTrack(data.track);
    } else if (data.type === 'playbackChange') {
      currentPositionMs = data.positionMs;
      isPlaying = data.isPlaying;
    } else if (data.type === 'lyricsLoaded') {
      setLyrics(data.lyrics);
    } else if (data.type === 'palette') {
      applyPalette(data.highlight, data.secondary);
    }
  });
}

function applyPalette(highlight, secondary) {
  if (highlight) document.documentElement.style.setProperty('--color-highlight', highlight);
  if (secondary) document.documentElement.style.setProperty('--color-secondary', secondary);
}

function updateTrack(track) {
  trackTitle.textContent = track.title || 'No Media Playing';
  trackArtist.textContent = track.artist || 'Waiting for Spotify / Windows Media...';
  playbackDurationMs = track.durationMs || 0;
  timeTotal.textContent = formatTime(playbackDurationMs);
  if (track.sourceApp) playerBadge.textContent = track.sourceApp;
  if (track.thumbnail) {
    trackArt.src = track.thumbnail;
  }
}

function setLyrics(lyrics) {
  currentLyrics = lyrics;
  lastActiveLineIndex = -1;
  lyricsTrack.innerHTML = '';

  if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) {
    lyricsTrack.innerHTML = '<div class="line active">Waiting for music...</div>';
    return;
  }

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

// Micro-interpolation render loop (60 FPS)
let lastFrameTime = performance.now();
function renderTick(now) {
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  if (isPlaying) {
    currentPositionMs += delta;
  }

  timeCur.textContent = formatTime(currentPositionMs);

  if (currentLyrics && currentLyrics.lines) {
    let activeLineIdx = -1;
    const lines = currentLyrics.lines;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextStart = (i + 1 < lines.length) ? lines[i + 1].startMs : Infinity;
      if (currentPositionMs >= line.startMs && currentPositionMs < nextStart) {
        activeLineIdx = i;
        break;
      }
    }

    if (activeLineIdx !== -1) {
      if (activeLineIdx !== lastActiveLineIndex) {
        lastActiveLineIndex = activeLineIdx;

        // Scroll active line to center
        const activeLineEl = document.getElementById(`line-${activeLineIdx}`);
        if (activeLineEl) {
          const offset = activeLineEl.offsetTop - (lyricsTrack.clientHeight / 2) + 20;
          lyricsTrack.style.transform = `translateY(-${Math.max(0, offset)}px)`;
        }

        // Update line classes
        lines.forEach((_, idx) => {
          const el = document.getElementById(`line-${idx}`);
          if (!el) return;
          if (idx === activeLineIdx) {
            el.className = 'line active';
          } else if (idx < activeLineIdx) {
            el.className = 'line passed';
          } else {
            el.className = 'line';
          }
        });
      }

      // Update words in active line
      const activeLine = lines[activeLineIdx];
      activeLine.words.forEach((w, wIdx) => {
        const wEl = document.getElementById(`w-${activeLineIdx}-${wIdx}`);
        if (!wEl) return;

        const isWordActive = currentPositionMs >= w.startMs && currentPositionMs < (w.startMs + w.durationMs);
        const hasPassed = currentPositionMs >= (w.startMs + w.durationMs);

        if (isWordActive) {
          wEl.className = 'word active';
          // Visual glyph pop-in if matched
          if (w.icon && !wEl.querySelector('.icon-glyph')) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'icon-glyph';
            iconSpan.textContent = w.icon;
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

  requestAnimationFrame(renderTick);
}

requestAnimationFrame(renderTick);

// Fallback Demo initialization if standalone
if (!window.chrome || !window.chrome.webview) {
  // Built-in standalone fallback for direct preview
  isPlaying = true;
  currentPositionMs = 43800;
  playbackDurationMs = 200000;
  timeTotal.textContent = formatTime(playbackDurationMs);

  setLyrics({
    isWordLevel: true,
    lines: [
      {
        startMs: 44190,
        durationMs: 5040,
        words: [
          { word: "You ", startMs: 44190, durationMs: 180 },
          { word: "can ", startMs: 44370, durationMs: 180 },
          { word: "turn ", startMs: 44550, durationMs: 210 },
          { word: "me ", startMs: 44760, durationMs: 210 },
          { word: "on ", startMs: 44970, durationMs: 360 },
          { word: "with ", startMs: 45330, durationMs: 90 },
          { word: "just ", startMs: 45420, durationMs: 450 },
          { word: "a ", startMs: 45870, durationMs: 90 },
          { word: "touch, ", startMs: 45960, durationMs: 810, icon: "✨" },
          { word: "baby", startMs: 46950, durationMs: 2280, icon: "👶" }
        ]
      },
      {
        startMs: 49590,
        durationMs: 1140,
        words: [
          { word: "I ", startMs: 49590, durationMs: 240 },
          { word: "look, ", startMs: 49830, durationMs: 270, icon: "👀" },
          { word: "around ", startMs: 50100, durationMs: 360 },
          { word: "and", startMs: 50460, durationMs: 270 }
        ]
      },
      {
        startMs: 50760,
        durationMs: 2880,
        words: [
          { word: "Sin ", startMs: 50760, durationMs: 420 },
          { word: "city's ", startMs: 51180, durationMs: 540, icon: "🏙️" },
          { word: "cold ", startMs: 51720, durationMs: 480, icon: "❄️" },
          { word: "and ", startMs: 52200, durationMs: 330 },
          { word: "empty ", startMs: 52530, durationMs: 870 }
        ]
      },
      {
        startMs: 60960,
        durationMs: 5760,
        words: [
          { word: "I ", startMs: 60960, durationMs: 150 },
          { word: "said, ", startMs: 61110, durationMs: 660 },
          { word: "ooh, ", startMs: 61800, durationMs: 2250 },
          { word: "I'm ", startMs: 64080, durationMs: 450 },
          { word: "blinded ", startMs: 64530, durationMs: 570, icon: "✨" },
          { word: "by ", startMs: 65100, durationMs: 360 },
          { word: "the ", startMs: 65460, durationMs: 150 },
          { word: "lights", startMs: 65610, durationMs: 1110, icon: "💡" }
        ]
      }
    ]
  });
}

