import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ──── DISCORD RICH PRESENCE (RPC) ENGINE ────
const DISCORD_CLIENT_ID = '1568938073365020702';
let discordSocket = null;
let discordConnected = false;
let discordRetryTimer = null;

function encodeDiscordFrame(op, data) {
  const jsonBuf = Buffer.from(JSON.stringify(data), 'utf8');
  const header = Buffer.alloc(8);
  header.writeUInt32LE(op, 0);
  header.writeUInt32LE(jsonBuf.length, 4);
  return Buffer.concat([header, jsonBuf]);
}

function initDiscordRPC() {
  if (discordSocket || discordConnected) return;

  const pipes = ['\\\\?\\pipe\\discord-ipc-0', '\\\\?\\pipe\\discord-ipc-1', '\\\\.\\pipe\\discord-ipc-0'];
  let pipeIdx = 0;

  function tryNextPipe() {
    if (pipeIdx >= pipes.length) {
      if (!discordRetryTimer) {
        discordRetryTimer = setTimeout(() => {
          discordRetryTimer = null;
          initDiscordRPC();
        }, 8000);
      }
      return;
    }

    const currentPipe = pipes[pipeIdx++];
    const sock = net.connect(currentPipe, () => {
      discordSocket = sock;
      sock.write(encodeDiscordFrame(0, { v: 1, client_id: DISCORD_CLIENT_ID }));
    });

    sock.on('data', (buf) => {
      try {
        const op = buf.readUInt32LE(0);
        const len = buf.readUInt32LE(4);
        const payload = JSON.parse(buf.subarray(8, 8 + len).toString('utf8'));
        if (payload.cmd === 'DISPATCH' && payload.evt === 'READY') {
          discordConnected = true;
          console.log(`[Discord RPC] Connected live as ${payload.data?.user?.username || 'user'}`);
        }
      } catch (e) {}
    });

    sock.on('error', () => {
      sock.destroy();
      discordSocket = null;
      discordConnected = false;
      setTimeout(tryNextPipe, 350);
    });

    sock.on('close', () => {
      discordSocket = null;
      discordConnected = false;
    });
  }

  tryNextPipe();
}

function setDiscordActivity(details, state, startSec, durationSec, isPaused) {
  if (!discordSocket || !discordConnected) return false;
  try {
    const activity = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: isPaused ? null : {
          details: details || 'wavforms',
          state: state || 'Word-by-word synchronized lyrics',
          assets: {
            large_image: 'https://raw.githubusercontent.com/securitygeek15/wavforms/main/assets/logo.png',
            large_text: 'wavforms — word-by-word synchronized lyrics'
          },
          timestamps: startSec ? {
            start: startSec,
            end: durationSec ? startSec + Math.floor(durationSec) : undefined
          } : undefined
        }
      },
      nonce: String(Date.now())
    };
    discordSocket.write(encodeDiscordFrame(1, activity));
    return true;
  } catch (err) {
    console.error('[Discord RPC Send Error]:', err.message);
    return false;
  }
}

initDiscordRPC();

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
  const cacheKey = `${title.toLowerCase()} - ${artist.toLowerCase()} - ${Math.round(expectedDurationMs / 2000)}`;

  if (lyricCache.has(cacheKey)) {
    return lyricCache.get(cacheKey);
  }

  console.log(`[*] Searching lyrics for: "${title}" by "${artist}" (Expected duration: ${expectedDurationMs}ms)`);

  // 1. Primary: NetEase Cloud Music (NCM) YRC Word-by-Word
  try {
    const query = `${title} ${artist}`.trim();
    const searchUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&offset=0&limit=12`;
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
        // Sort songs by duration difference to audio file
        const sortedSongs = [...songs].sort((a, b) => {
          if (!expectedDurationMs) return 0;
          const diffA = Math.abs((a.duration || 0) - expectedDurationMs);
          const diffB = Math.abs((b.duration || 0) - expectedDurationMs);
          return diffA - diffB;
        });

        // Filter candidates within 4.5s duration difference if duration is known
        const candidates = (expectedDurationMs > 0)
          ? sortedSongs.filter(s => Math.abs((s.duration || 0) - expectedDurationMs) <= 4500)
          : sortedSongs.slice(0, 3);

        // If no candidate is within 4.5s, only inspect the closest if within 7s
        const validCandidates = candidates.length > 0
          ? candidates
          : (expectedDurationMs > 0 && Math.abs((sortedSongs[0].duration || 0) - expectedDurationMs) <= 7000 ? [sortedSongs[0]] : []);

        // Pass 1: Try to find exact YRC (syllable-level word-by-word)
        for (const cand of validCandidates) {
          const lyricUrl = `https://music.163.com/api/song/lyric/v1?id=${cand.id}&lv=-1&kv=-1&tv=-1&yv=1&ytv=1&yrv=1`;
          const lyricRes = await fetch(lyricUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://music.163.com/'
            }
          });

          if (lyricRes.ok) {
            const lyricData = await lyricRes.json();
            if (lyricData?.yrc?.lyric) {
              const parsed = parseYrc(lyricData.yrc.lyric, title, artist);
              if (parsed && parsed.lines && parsed.lines.length > 0) {
                console.log(`[OK] Found exact NetEase YRC word-level lyrics for "${title}" (${parsed.lines.length} lines, duration diff: ${Math.abs((cand.duration || 0) - expectedDurationMs)}ms)`);
                lyricCache.set(cacheKey, parsed);
                return parsed;
              }
            }
          }
        }

        // Pass 2: If no YRC, check for LRC from the duration-matched candidates
        for (const cand of validCandidates) {
          const lyricUrl = `https://music.163.com/api/song/lyric/v1?id=${cand.id}&lv=-1&kv=-1&tv=-1&yv=1&ytv=1&yrv=1`;
          const lyricRes = await fetch(lyricUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://music.163.com/'
            }
          });

          if (lyricRes.ok) {
            const lyricData = await lyricRes.json();
            if (lyricData?.lrc?.lyric) {
              const parsed = parseLrcWithInterpolation(lyricData.lrc.lyric, title, artist);
              if (parsed && parsed.lines && parsed.lines.length > 0) {
                console.log(`[OK] Found NetEase LRC synced lyrics for "${title}" (${parsed.lines.length} lines)`);
                lyricCache.set(cacheKey, parsed);
                return parsed;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[NCM Error]:', err.message);
  }

  // 2. Global Fallback: LRCLIB API with duration matching
  try {
    const durSec = Math.round(expectedDurationMs / 1000);
    const query = `${title} ${artist}`.trim();

    // Try search endpoint which returns multiple duration candidates
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
    const lrcRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'wavforms/1.0 (https://github.com/securitygeek15/wavforms)' }
    });

    if (lrcRes.ok) {
      const results = await lrcRes.json();
      if (Array.isArray(results) && results.length > 0) {
        // Filter those with syncedLyrics
        const syncedResults = results.filter(r => r.syncedLyrics);
        if (syncedResults.length > 0) {
          // Sort by duration match
          syncedResults.sort((a, b) => {
            if (!durSec) return 0;
            return Math.abs((a.duration || 0) - durSec) - Math.abs((b.duration || 0) - durSec);
          });

          const bestLrc = syncedResults[0];
          const diffSec = durSec > 0 ? Math.abs((bestLrc.duration || 0) - durSec) : 0;
          if (durSec === 0 || diffSec <= 4) {
            const parsed = parseLrcWithInterpolation(bestLrc.syncedLyrics, title, artist);
            if (parsed && parsed.lines && parsed.lines.length > 0) {
              console.log(`[OK] Found LRCLIB synced lyrics for "${title}" (${parsed.lines.length} lines, duration diff: ${diffSec}s)`);
              lyricCache.set(cacheKey, parsed);
              return parsed;
            }
          }
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
      const rawText = wordMatch[3];
      const wText = rawText.trim();
      if (wText && wText !== ',' && wText !== '.') {
        words.push({
          word: wText,
          startMs: wStart,
          durationMs: Math.max(120, wDur),
          endMs: wStart + Math.max(120, wDur)
        });
      }
    }

    if (words.length > 0) {
      const actualLineEnd = words[words.length - 1].endMs;
      result.lines.push({
        startMs: lineStart,
        durationMs: Math.max(lineDur, actualLineEnd - lineStart),
        endMs: Math.max(lineStart + lineDur, actualLineEnd),
        text: words.map(w => w.word).join(' ').trim(),
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
  const rawParsed = [];

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
      rawParsed.push({ startMs: totalMs, text, explicitEndMs: 0 });
    } else if (rawParsed.length > 0) {
      // Empty line marks silence/end of previous phrase!
      const last = rawParsed[rawParsed.length - 1];
      if (!last.explicitEndMs && totalMs > last.startMs) {
        last.explicitEndMs = totalMs;
      }
    }
  }

  rawParsed.sort((a, b) => a.startMs - b.startMs);

  for (let i = 0; i < rawParsed.length; i++) {
    const item = rawParsed[i];
    const nextStart = i + 1 < rawParsed.length ? rawParsed[i + 1].startMs : item.startMs + 4500;
    const gap = nextStart - item.startMs;

    const tokens = item.text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    // Natural vocal singing duration
    let durationMs;
    if (item.explicitEndMs && item.explicitEndMs > item.startMs) {
      durationMs = item.explicitEndMs - item.startMs;
    } else if (gap > 4500) {
      // Long gap: line is followed by instrumental solo/silence
      durationMs = Math.min(gap - 600, Math.max(1200, tokens.length * 420 + 350));
    } else {
      // Continuous line sequence
      durationMs = Math.max(900, Math.min(6500, gap - 120));
    }

    const totalChars = tokens.reduce((acc, t) => acc + Math.max(1, t.length), 0);

    let currentWStart = item.startMs;
    const words = tokens.map((t, tIdx) => {
      const weight = Math.max(1, t.length);
      const isLast = (tIdx === tokens.length - 1);
      const wDur = Math.max(120, Math.round((weight / totalChars) * durationMs));
      const wordObj = {
        word: t,
        startMs: currentWStart,
        durationMs: wDur,
        endMs: currentWStart + wDur
      };
      currentWStart += wDur;
      return wordObj;
    });

    result.lines.push({
      startMs: item.startMs,
      durationMs,
      endMs: item.startMs + durationMs,
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

  if (pathname === '/api/discord/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ connected: discordConnected }));
    return;
  }

  if (pathname === '/api/discord/presence' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const startSec = payload.currentSec ? Math.floor(Date.now() / 1000) - Math.floor(payload.currentSec) : Math.floor(Date.now() / 1000);
        const details = payload.title ? `${payload.title}${payload.artist && payload.artist !== 'Local Track' ? ' • ' + payload.artist : ''}` : 'wavforms';
        const state = payload.lineText ? `♫ "${payload.lineText}"` : 'Word-by-word synchronized lyrics';

        const sent = setDiscordActivity(details, state, startSec, payload.durationSec, !!payload.paused);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, connected: discordConnected, sent }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
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
