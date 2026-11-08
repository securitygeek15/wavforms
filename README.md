<div align="center">
  <img src="assets/logo.png" alt="wavforms logo" width="132" height="132" style="border-radius: 28px; box-shadow: 0 12px 40px rgba(0,0,0,0.85);" />
  
  # wavforms
  
  <p><strong>Word-by-word real-time synchronized lyrics on Windows.</strong></p>
  <p>Inspired by the minimalist luxury of Verci. Lighting lyrics one word at a time over pitch-black glass.</p>

  <p>
    <a href="https://github.com/securitygeek15/wavforms/releases/latest">
      <img src="https://img.shields.io/badge/Download-Windows%20Installer%20(.exe)-ffffff?style=for-the-badge&logo=windows&logoColor=black" alt="Download Windows Installer" />
    </a>
    <a href="https://github.com/securitygeek15/wavforms/releases/latest">
      <img src="https://img.shields.io/badge/Download-Portable%20(.zip)-18181b?style=for-the-badge&logo=zip&logoColor=white" alt="Download Portable" />
    </a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Version-v1.0.0-fb6e90?style=flat-square" alt="Version" />
    <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-black?style=flat-square" alt="Platform" />
    <img src="https://img.shields.io/badge/Lyrics-YRC%20Word--Level-ffffff?style=flat-square" alt="YRC" />
    <img src="https://img.shields.io/badge/Installer%20Size-1.09%20MB-black?style=flat-square" alt="Size" />
    <img src="https://img.shields.io/badge/License-MIT-white?style=flat-square" alt="License" />
  </p>
</div>

---

## What is wavforms?

Most lyrics apps scroll an entire line of text at once. **wavforms** changes that.

It synchronizes to the singer at the **millisecond word level** (**YRC karaoke format**). Each word drops in like a water droplet and ignites with luminescent light and acoustic ripples the exact moment it is sung.

No subscription, no account, no Spotify clutter. Just drop your songs in and watch the words arrive.

---

## ⚡ How It Works in 3 Steps

1. **Download & Run**: Grab the **[1-Click Windows Setup](https://github.com/securitygeek15/wavforms/releases/latest)** (or Portable ZIP). It sets up a desktop shortcut with the high-res icon.
2. **Drop Your Music**: Drag and drop any songs or your entire music folder (`.mp3`, `.wav`, `.flac`, `.m4a`, `.ogg`) into the window.
3. **Enjoy Word-by-Word Lyrics**: `wavforms` automatically extracts the song's title, artist, and embedded cover art, matches the exact studio release, and lights the lyrics in real time.

---

## 🎨 The 2 Core Display Styles

Switch styles anytime from the clean top menu bar:

| Style | Preview & Feel |
| :--- | :--- |
| **Ship** | **3D Perspective Drift** — Words stack onto a tilted spatial wall that drifts with gentle oceanic depth and camera parallax. |
| **Visual** | **Kinetic Typography + Emojis** — Words light up with fast-paced velocity, while 200+ matched words trigger floating, bouncy emoji bubbles (`✨`, `💡`, `🌙`, `❤️`, `👀`, `👶`, `🔥`, `🏙️`). |

---

## ✨ Key Highlights

- **Ocean Drops Liquid Animation**: No walls of 50 lines. Only the current singing line is spotlighted at center stage. Words drop in like fluid raindrops and bloom with radiant light.
- **Contextual Emotion Color Themes**: Lyric sentiment determines the lighting mood:
  - 🔥 *Fire, burn, flame, hot* → Flame Crimson
  - 💧 *Water, ocean, sea, rain, cold* → Aquatic Cyan
  - ✨ *Lights, shine, star, blinded* → Radiant Gold
  - 🌙 *Night, sky, moon, dream* → Electric Violet
  - ❤️ *Love, heart, kiss, touch* → Vibrant Rose Coral
- **Insane Lyric Accuracy**: Uses decoded audio buffer durations (`audio.duration * 1000`) to guarantee matching the exact studio release rather than live or cover cuts.
- **On-the-Fly Sync Tuning**: Track intro have silence? Press **`[`** or **`]`** to fine-tune the vocal sync by `±100ms` instantly.
- **Custom Lyrics Support**: Drop your own `.lrc` or `.yrc` file directly on a song to use your personal timings.
- **Ambient Fullscreen**: Press **`F`** to turn your display or TV into an ambient lock-screen centerpiece.

---

## ⌨️ Shortcuts Cheat Sheet

| Key | Action |
| :--- | :--- |
| `Space` | **Play / Pause** |
| `←` / `→` | **Seek backward / forward 5s** |
| `[` / `]` | **Fine-tune Lyric Sync** (±100ms offset) |
| `F` | **Toggle Fullscreen Mode** |
| `Drag & Drop` | **Import songs, music folder, or custom lyric files** |

---

## 📦 Building From Source (Developers)

If you prefer building from source:

```bash
# Clone the repository
git clone https://github.com/securitygeek15/wavforms.git
cd wavforms

# 1-Click Launch
.\run.bat

# Or run via Node
npm start
```

To build the GitHub release installer:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1
```

The resulting `wavforms-Setup-v1.0.0.exe` and `wavforms-v1.0.0-windows-x64.zip` will be generated in `dist/`.

---

## 💬 Frequently Asked Questions

<details>
<summary><strong>Where do the word-by-word lyrics come from?</strong></summary>
<br>
wavforms uses a dual-engine architecture:
1. <strong>NetEase Cloud Music YRC (Primary)</strong>: Reads true word-level karaoke timestamps (<code>[start, dur](w_start, w_dur)Word</code>) covering over 90% of popular music worldwide.
2. <strong>LRCLIB API (Fallback)</strong>: High-coverage synced lyric library paired with intelligent character-weighted proportional word interpolation.
</details>

<details>
<summary><strong>Can I use it offline with my own lyric files?</strong></summary>
<br>
Yes! Drop any <code>.lrc</code> or <code>.yrc</code> file alongside your songs (or onto an active song) and wavforms will immediately parse and synchronize it locally.
</details>

<details>
<summary><strong>What formats are supported?</strong></summary>
<br>
All standard audio formats: <code>.mp3</code>, <code>.flac</code>, <code>.wav</code>, <code>.m4a</code>, <code>.ogg</code>, and <code>.aac</code>.
</details>

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
