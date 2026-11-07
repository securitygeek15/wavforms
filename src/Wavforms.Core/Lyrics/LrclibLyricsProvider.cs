using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Wavforms.Core.Models;

namespace Wavforms.Core.Lyrics;

public class LrclibLyricsProvider
{
    private readonly HttpClient _httpClient;

    public LrclibLyricsProvider(HttpClient? httpClient = null)
    {
        _httpClient = httpClient ?? new HttpClient();
        if (!_httpClient.DefaultRequestHeaders.Contains("User-Agent"))
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "wavforms/1.0 (https://github.com/wavforms)");
        }
    }

    public async Task<TimedSongLyrics?> FetchLyricsAsync(string rawTitle, string artist, long durationMs = 0)
    {
        var cleanTitle = NcmLyricsProvider.CleanTitle(rawTitle);
        var durSec = (int)Math.Round(durationMs / 1000.0);

        try
        {
            var url = $"https://lrclib.net/api/get?track_name={Uri.EscapeDataString(cleanTitle)}&artist_name={Uri.EscapeDataString(artist)}";
            if (durSec > 0)
            {
                url += $"&duration={durSec}";
            }

            var resp = await _httpClient.GetStringAsync(url);
            using var doc = JsonDocument.Parse(resp);

            if (doc.RootElement.TryGetProperty("syncedLyrics", out var syncedProp))
            {
                var syncedLrc = syncedProp.GetString();
                if (!string.IsNullOrWhiteSpace(syncedLrc))
                {
                    return LyricsInterpolator.FromLrc(syncedLrc, cleanTitle, artist);
                }
            }

            return null;
        }
        catch
        {
            return null;
        }
    }
}

