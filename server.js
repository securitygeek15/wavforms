import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Aggressive cleaning to ensure 100% accurate search queries
function cleanTitle(raw) {
  if (!raw) return '';
  let s = raw;
  // Strip file extension
  s = s.replace(/\.(mp3|wav|flac|m4a|ogg|aac)$/i, '');
  // Replace underscores and dots with space
  s = s.replace(/[_\.]+/g, ' ');
  // Strip track numbers at start like "01 - ", "1. ", "01 "
  s = s.replace(/^\d+[\s\.\-]+/g, '');
  // Strip junk video/audio tags
  s = s.replace(/\((official\s*(music\s*)?video|official\s*audio|lyric\s*video|audio|lyrics|visualizer|hq|hd|4k|320kbps)\)/gi, '');
  s = s.replace(/\[(official\s*(music\s*)?video|official\s*audio|lyric\s*video|audio|lyrics|visualizer|hq|hd|4k|320kbps)\]/gi, '');
  // Strip featured artists in title
  s = s.replace(/\((feat|ft|with|featuring)[.\s][^)]*\)/gi, '');
  s = s.replace(/\[(feat|ft|with|featuring)[.\s][^\]]*\]/gi, '');
  s = s.replace(/\((from|theme from|music from)[^)]*\)/gi, '');
  s = s.replace(/\((\d{4} )?(re-?master(ed)?|deluxe|bonus|explicit|single|album|radio)[^)]*\)/gi, '');
  s = s.replace(/\s-\s.*(remix|version|edit|mix|remaster|acoustic|live|instrumental).*$/gi, '');
  return s.trim();
}

function cleanArtist(raw) {
  if (!raw) return '';
  let s = raw;
  s = s.replace(/\.(mp3|wav|flac|m4a|ogg|aac)$/i, '');
  s = s.replace(/[_\.]+/g, ' ');
  return s.trim();
}

// YRC line and word regex: [44190,5040](44190,180,0)You (44370,180,0)can
const YRC_LINE_REGEX = /^\[(\d+),(\d+)\](.*)$/;
const YRC_WORD_REGEX = /\((\d+),(\d+),\d+\)([^\(]*)/g;
const LRC_REGEX = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

// In-memory lyric cache
const lyricCache = new Map();

async function fetchLyrics(rawTitle, rawArtist, expectedDurationMs = 0) {
  const title = cleanTitle(rawTitle);
  const artist = cleanArtist(rawArtist);
  const cacheKey = `${title.toLowerCase()} - ${artist.toLowerCase()}`;

  if (lyricCache.has(cacheKey)) {
    return lyricCache.get(cacheKey);
  }

  console.log(`[*] Searching lyrics for: "${title}" by "${artist}" (Expected duration: ${expectedDurationMs}ms)`);

  // 1. Primary: NetEase Cloud Music (NCM) YRC Word-by-Word
  try {
    const query = `${title} ${artist}`.trim();
    const searchUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&offset=0&limit=8`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/'
      }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const songs = searchData?.result?.songs || [];

      if (songs.length > 0) {
        // Pick best candidate based on duration match
        let bestSong = songs[0];
        let minDiff = Infinity;

        if (expectedDurationMs > 0) {
          for (const s of songs) {
            const songDur = s.duration || 0;
            const diff = Math.abs(songDur - expectedDurationMs);
            if (diff < minDiff) {
              minDiff = diff;
              bestSong = s;
              // If within 1.5 seconds, exact match found!
              if (diff <= 1500) break;
            }
          }
        }

        const lyricUrl = `https://music.163.com/api/song/lyric/v1?id=${bestSong.id}&lv=-1&kv=-1&tv=-1&yv=1&ytv=1&yrv=1`;
        const lyricRes = await fetch(lyricUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://music.163.com/'
          }
        });

        if (lyricRes.ok) {
          const lyricData = await lyricRes.json();

          // Check for YRC (word-by-word)
          if (lyricData?.yrc?.lyric) {
            const parsed = parseYrc(lyricData.yrc.lyric, title, artist);
            if (parsed && parsed.lines && parsed.lines.length > 0) {
              console.log(`[✓] Found exact YRC word-level lyrics (${parsed.lines.length} lines)`);
              lyricCache.set(cacheKey, parsed);
              return parsed;
            }
          }

          // Check for LRC (interpolated word-by-word)
          if (lyricData?.lrc?.lyric) {
            const parsed = parseLrcWithInterpolation(lyricData.lrc.lyric, title, artist);
            if (parsed && parsed.lines && parsed.lines.length > 0) {
              console.log(`[✓] Found NCM LRC synced lyrics (${parsed.lines.length} lines)`);
              lyricCache.set(cacheKey, parsed);
              return parsed;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[NCM Error]:', err.message);
  }

  // 2. Global Fallback: LRCLIB API with proportional word interpolation
  try {
    const durSec = Math.round(expectedDurationMs / 1000);
    let lrclibUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    if (durSec > 0) lrclibUrl += `&duration=${durSec}`;

    const lrcRes = await fetch(lrclibUrl, {
      headers: { 'User-Agent': 'wavforms/1.0 (https://github.com/wavforms)' }
    });

    if (lrcRes.ok) {
      const lrcData = await lrcRes.json();
      if (lrcData?.syncedLyrics) {
        const parsed = parseLrcWithInterpolation(lrcData.syncedLyrics, title, artist);
        if (parsed && parsed.lines && parsed.lines.length > 0) {
          console.log(`[✓] Found LRCLIB synced lyrics (${parsed.lines.length} lines)`);
          lyricCache.set(cacheKey, parsed);
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error('[LRCLIB Error]:', err.message);
  }

  return null;
}

function parseYrc(rawYrc, title, artist) {
  const result = {
    title,
    artist,
    isWordLevel: true,
    lines: []
  };

  const rawLines = rawYrc.split(/\r?\n/);
  for (const l of rawLines) {
    const match = YRC_LINE_REGEX.exec(l.trim());
    if (!match) continue;

    const lineStart = parseInt(match[1], 10);
    const lineDur = parseInt(match[2], 10);
    const wordsContent = match[3];

    const words = [];
    let wordMatch;
    YRC_WORD_REGEX.lastIndex = 0;

    while ((wordMatch = YRC_WORD_REGEX.exec(wordsContent)) !== null) {
      const wStart = parseInt(wordMatch[1], 10);
      const wDur = parseInt(wordMatch[2], 10);
      const wText = wordMatch[3];
      if (wText) {
        words.push({
          word: wText,
          startMs: wStart,
          durationMs: wDur
        });
      }
    }

    if (words.length > 0) {
      result.lines.push({
        startMs: lineStart,
        durationMs: lineDur,
        text: words.map(w => w.word).join('').trim(),
        words
      });
    }
  }

  return result;
}

function parseLrcWithInterpolation(rawLrc, title, artist) {
  const result = {
    title,
    artist,
    isWordLevel: false,
    lines: []
  };

  const lines = rawLrc.split(/\r?\n/);
  const parsed = [];

  for (const l of lines) {
    const m = LRC_REGEX.exec(l.trim());
    if (!m) continue;

    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const fracStr = m[3];
    const ms = fracStr.length === 2 ? parseInt(fracStr, 10) * 10 : parseInt(fracStr, 10);
    const totalMs = min * 60000 + sec * 1000 + ms;
    const text = m[4].trim();

    if (text) {
      parsed.push({ startMs: totalMs, text });
    }
  }

  parsed.sort((a, b) => a.startMs - b.startMs);

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const nextStart = i + 1 < parsed.length ? parsed[i + 1].startMs : item.startMs + 4000;
    const durationMs = Math.max(1000, Math.min(6500, nextStart - item.startMs));

    const tokens = item.text.split(' ');
    const totalChars = tokens.reduce((acc, t) => acc + Math.max(1, t.length), 0);

    let currentWStart = item.startMs;
    const words = tokens.map(t => {
      const weight = Math.max(1, t.length);
      const wDur = Math.max(100, Math.round((weight / totalChars) * durationMs));
      const wordObj = {
        word: t + ' ',
        startMs: currentWStart,
        durationMs: wDur
      };
      currentWStart += wDur;
      return wordObj;
    });

    result.lines.push({
      startMs: item.startMs,
      durationMs,
      text: item.text,
      words
    });
  }

  return result;
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ app: 'wavforms', version: '1.0.0' }));
    return;
  }

  if (pathname === '/api/lyrics') {
    const title = reqUrl.searchParams.get('title') || '';
    const artist = reqUrl.searchParams.get('artist') || '';
    const duration = parseInt(reqUrl.searchParams.get('duration') || '0', 10);

    const lyrics = await fetchLyrics(title, artist, duration);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lyrics || { error: 'No lyrics found', lines: [] }));
    return;
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (pathname.startsWith('/assets/')) {
    filePath = path.join(__dirname, pathname);
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`  wavforms is live at http://localhost:${PORT}`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
});
