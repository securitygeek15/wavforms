import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Regex patterns discovered from reverse-engineering Verci
const FEAT_REGEX = /\((feat|ft|with|featuring)[.\s][^)]*\)/gi;
const FROM_REGEX = /\((from|theme from|music from)[^)]*\)/gi;
const REMASTER_REGEX = /\((\d{4} )?(re-?master(ed)?|deluxe|bonus|explicit|single|album|radio)[^)]*\)/gi;
const SUFFIX_REGEX = /\s-\s.*(remix|version|edit|mix|remaster|acoustic|live|instrumental).*$/gi;

// YRC line and word regex: [44190,5040](44190,180,0)You (44370,180,0)can
const YRC_LINE_REGEX = /^\[(\d+),(\d+)\](.*)$/;
const YRC_WORD_REGEX = /\((\d+),(\d+),\d+\)([^\(]*)/g;
const LRC_REGEX = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

function cleanTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(FEAT_REGEX, '')
    .replace(FROM_REGEX, '')
    .replace(REMASTER_REGEX, '')
    .replace(SUFFIX_REGEX, '')
    .trim();
}

// In-memory lyric cache
const lyricCache = new Map();

async function fetchLyrics(rawTitle, rawArtist, expectedDurationMs = 0) {
  const title = cleanTitle(rawTitle);
  const artist = (rawArtist || '').trim();
  const cacheKey = `${title.toLowerCase()} - ${artist.toLowerCase()}`;

  if (lyricCache.has(cacheKey)) {
    return lyricCache.get(cacheKey);
  }

  // 1. Primary Source: NetEase Cloud Music (NCM) YRC Word-by-Word
  try {
    const query = `${title} ${artist}`.trim();
    const searchUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&offset=0&limit=5`;
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
        let bestSong = songs[0];
        let minDiff = Infinity;

        if (expectedDurationMs > 0) {
          for (const s of songs) {
            const diff = Math.abs((s.duration || 0) - expectedDurationMs);
            if (diff < minDiff) {
              minDiff = diff;
              bestSong = s;
              if (diff <= 3500) break;
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
              lyricCache.set(cacheKey, parsed);
              return parsed;
            }
          }

          // Check for LRC (interpolated word-by-word)
          if (lyricData?.lrc?.lyric) {
            const parsed = parseLrcWithInterpolation(lyricData.lrc.lyric, title, artist);
            if (parsed && parsed.lines && parsed.lines.length > 0) {
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

// MIME types for static assets
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

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Fetch Lyrics
  if (pathname === '/api/lyrics') {
    const title = reqUrl.searchParams.get('title') || '';
    const artist = reqUrl.searchParams.get('artist') || '';
    const duration = parseInt(reqUrl.searchParams.get('duration') || '0', 10);

    const lyrics = await fetchLyrics(title, artist, duration);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(lyrics || { error: 'No lyrics found', lines: [] }));
    return;
  }

  // Static File Serving
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
