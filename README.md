<div align="center">
  <img src="assets/logo.png" alt="wavforms logo" width="128" height="128" style="border-radius: 28px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);" />
  <h1>wavforms</h1>
  <p><strong>Real-time word-by-word synchronized lyrics on Windows.</strong></p>
  <p>Inspired by the minimalist luxury of Verci. Light lyrics one word at a time over pitch-black glass.</p>

  <p>
    <a href="#features">Features</a> •
    <a href="#display-styles">Styles</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#how-it-works">Architecture</a> •
    <a href="#license">License</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-black?style=flat-square" alt="Platform" />
    <img src="https://img.shields.io/badge/Lyrics-YRC%20Word--Level-fb6e90?style=flat-square" alt="YRC" />
    <img src="https://img.shields.io/badge/Node.js-v20+-black?style=flat-square" alt="Node" />
    <img src="https://img.shields.io/badge/.NET-10.0-512BD4?style=flat-square" alt=".NET 10" />
    <img src="https://img.shields.io/badge/License-MIT-white?style=flat-square" alt="License" />
  </p>
</div>

---

## Overview

**wavforms** brings the acclaimed lock-screen word-by-word lyric experience from macOS (Verci) to Windows. 

Instead of showing walls of static text, **wavforms** features focused single-line **"Drops in an Ocean"** liquid kinetic typography, reading real per-word timestamps (**YRC format**) and lighting each syllable precisely as it is sung by the artist.

---

## ✨ Features

- **Kinetic Word-by-Word Timings**: Reads exact millisecond timestamps (`[start, duration](w_start, w_dur)Word`) powered by the NetEase Cloud Music YRC karaoke engine, with proportional word-length interpolation fallback via LRCLIB.
- **Ocean Drops Liquid Typography**: Only the current active line is spotlighted at center stage. Words drop in like fluid water droplets with snappy, fast-paced velocity (`0.14s - 0.22s`), blooming into vibrant luminescent acoustic ripples.
- **Contextual Lyric Emotion Colors**: Dynamic color themes mapped to lyric sentiment (fire burns crimson, water flows cyan, starlight radiates gold, romance glows rose coral).
- **Import Songs Landing Screen**: Clean, dedicated opening view. Drop any audio files or folders to start. No preloaded clutter.
- **Instant Offset Calibrator**: Fine-tune sync by `±100ms` on the fly using on-screen buttons or hotkeys `[` and `]`.
- **Drag & Drop Local Songs & Folders**: Supports MP3, WAV, FLAC, M4A, OGG, and custom `.lrc` / `.yrc` files.
- **Ambient Fullscreen Mode**: Press **`F`** to turn your monitor or TV into an ambient music centerpiece.

---

## 🎨 The 2 Core Display Styles

Switch styles seamlessly from the top menu bar:

| Style | Description |
| :--- | :--- |
| **Ship** | Words stack into a 3D perspective wall that subtly drifts with camera parallax and ocean depth. |
| **Visual** | High-velocity word-by-word kinetic lighting paired with floating, color-matched emoji bubbles. |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18 or higher)
- Windows 10 or 11

### 2. Launching wavforms
```bash
git clone https://github.com/wavforms/wavforms.git
cd wavforms

# 1-Click Launch (starts server & opens aesthetic desktop app window)
.\run.bat
```

Or via npm:
```bash
npm start
```
Then open `http://localhost:3000`.

---

## ⌨️ Shortcuts & Controls

| Action | Key / Action |
| :--- | :--- |
| **Play / Pause** | `Space` |
| **Seek ±5s** | `←` / `→` |
| **Fine-tune Sync (±100ms)** | `[` / `]` |
| **Toggle Fullscreen** | `F` |
| **Import Songs / Folder** | Drag & drop anywhere, or click **Upload** / **Folder** |

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
