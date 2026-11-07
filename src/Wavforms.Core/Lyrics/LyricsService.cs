using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using Wavforms.Core.Models;

namespace Wavforms.Core.Lyrics;

public class LyricsService
{
    private readonly NcmLyricsProvider _ncmProvider;
    private readonly LrclibLyricsProvider _lrclibProvider;
    private readonly ConcurrentDictionary<string, TimedSongLyrics> _cache = new(StringComparer.OrdinalIgnoreCase);

    public LyricsService()
    {
        _ncmProvider = new NcmLyricsProvider();
        _lrclibProvider = new LrclibLyricsProvider();
    }

    public async Task<TimedSongLyrics?> GetLyricsAsync(string title, string artist, long durationMs = 0)
    {
        if (string.IsNullOrWhiteSpace(title)) return null;

        var cacheKey = $"{title.Trim()} - {artist?.Trim()}";
        if (_cache.TryGetValue(cacheKey, out var cached))
        {
            return cached;
        }

        // 1. Try NetEase Cloud Music (Word-level YRC)
        var lyrics = await _ncmProvider.FetchLyricsAsync(title, artist ?? "", durationMs);
        if (lyrics != null && lyrics.Lines.Count > 0)
        {
            _cache[cacheKey] = lyrics;
            return lyrics;
        }

        // 2. Try LRCLIB fallback
        lyrics = await _lrclibProvider.FetchLyricsAsync(title, artist ?? "", durationMs);
        if (lyrics != null && lyrics.Lines.Count > 0)
        {
            _cache[cacheKey] = lyrics;
            return lyrics;
        }

        return null;
    }
}

