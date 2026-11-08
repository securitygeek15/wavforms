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
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "wavforms/1.0 (https://github.com/securitygeek15/wavforms)");
        }
    }

    public async Task<TimedSongLyrics?> FetchLyricsAsync(string rawTitle, string artist, long durationMs = 0)
    {
        var cleanTitle = NcmLyricsProvider.CleanTitle(rawTitle);
        var durSec = (int)Math.Round(durationMs / 1000.0);

        // 1. Try exact match with /api/get if artist is provided
        if (!string.IsNullOrWhiteSpace(artist) && !artist.Equals("Local Track", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var getUrl = $"https://lrclib.net/api/get?track_name={Uri.EscapeDataString(cleanTitle)}&artist_name={Uri.EscapeDataString(artist)}";
                if (durSec > 0)
                {
                    getUrl += $"&duration={durSec}";
                }

                var resp = await _httpClient.GetStringAsync(getUrl);
                using var doc = JsonDocument.Parse(resp);

                if (doc.RootElement.TryGetProperty("syncedLyrics", out var syncedProp) &&
                    syncedProp.ValueKind == JsonValueKind.String)
                {
                    var syncedLrc = syncedProp.GetString();
                    if (!string.IsNullOrWhiteSpace(syncedLrc))
                    {
                        return LyricsInterpolator.FromLrc(syncedLrc, cleanTitle, artist);
                    }
                }
            }
            catch { }
        }

        // 2. Search fallback: /api/search?q=... (Crucial for uploaded files)
        try
        {
            string searchQuery = string.IsNullOrWhiteSpace(artist) || artist.Equals("Local Track", StringComparison.OrdinalIgnoreCase)
                ? cleanTitle
                : $"{cleanTitle} {artist}";

            var searchUrl = $"https://lrclib.net/api/search?q={Uri.EscapeDataString(searchQuery)}";
            var searchResp = await _httpClient.GetStringAsync(searchUrl);
            using var searchDoc = JsonDocument.Parse(searchResp);

            if (searchDoc.RootElement.ValueKind == JsonValueKind.Array)
            {
                string? bestSyncedLrc = null;
                string? bestPlainLyrics = null;
                double minDurDiff = double.MaxValue;

                foreach (var item in searchDoc.RootElement.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object) continue;

                    if (item.TryGetProperty("syncedLyrics", out var synProp) && synProp.ValueKind == JsonValueKind.String)
                    {
                        var lrcText = synProp.GetString();
                        if (!string.IsNullOrWhiteSpace(lrcText))
                        {
                            double trackDur = item.TryGetProperty("duration", out var dProp) && dProp.ValueKind == JsonValueKind.Number ? dProp.GetDouble() : 0;
                            if (durSec > 0 && trackDur > 0)
                            {
                                double diff = Math.Abs(trackDur - durSec);
                                if (diff < minDurDiff)
                                {
                                    minDurDiff = diff;
                                    bestSyncedLrc = lrcText;
                                    if (diff <= 3.0) break; // Perfect duration match!
                                }
                            }
                            else if (bestSyncedLrc == null)
                            {
                                bestSyncedLrc = lrcText;
                                if (durSec == 0) break;
                            }
                        }
                    }

                    if (bestPlainLyrics == null && item.TryGetProperty("plainLyrics", out var plainProp) && plainProp.ValueKind == JsonValueKind.String)
                    {
                        bestPlainLyrics = plainProp.GetString();
                    }
                }

                if (!string.IsNullOrWhiteSpace(bestSyncedLrc))
                {
                    return LyricsInterpolator.FromLrc(bestSyncedLrc, cleanTitle, artist);
                }

                // Plain lyrics fallback if synced unavailable
                if (!string.IsNullOrWhiteSpace(bestPlainLyrics))
                {
                    return LyricsInterpolator.FromPlainLyrics(bestPlainLyrics, cleanTitle, artist, durationMs);
                }
            }
        }
        catch { }

        return null;
    }
}
