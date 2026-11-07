using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Wavforms.Core.Models;
using Wavforms.Core.Visual;

namespace Wavforms.Core.Lyrics;

public class NcmLyricsProvider
{
    private readonly HttpClient _httpClient;

    // Same regex patterns discovered in Verci binary
    private static readonly Regex FeatRegex = new(@"\((feat|ft|with|featuring)[.\s][^)]*\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex FromRegex = new(@"\((from|theme from|music from)[^)]*\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex RemasterRegex = new(@"\((\d{4} )?(re-?master(ed)?|deluxe|bonus|explicit|single|album|radio)[^)]*\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex SuffixRegex = new(@"\s-\s.*(remix|version|edit|mix|remaster|acoustic|live|instrumental).*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // YRC line and word regex
    // e.g. [44190,5040](44190,180,0)You (44370,180,0)can
    private static readonly Regex YrcLineRegex = new(@"^\[(\d+),(\d+)\](.*)$", RegexOptions.Compiled);
    private static readonly Regex YrcWordRegex = new(@"\((\d+),(\d+),\d+\)([^\(]*)", RegexOptions.Compiled);

    public NcmLyricsProvider(HttpClient? httpClient = null)
    {
        _httpClient = httpClient ?? new HttpClient();
        if (!_httpClient.DefaultRequestHeaders.Contains("User-Agent"))
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        }
        if (!_httpClient.DefaultRequestHeaders.Contains("Referer"))
        {
            _httpClient.DefaultRequestHeaders.Add("Referer", "https://music.163.com/");
        }
    }

    public static string CleanTitle(string rawTitle)
    {
        if (string.IsNullOrWhiteSpace(rawTitle)) return string.Empty;
        var s = FeatRegex.Replace(rawTitle, "");
        s = FromRegex.Replace(s, "");
        s = RemasterRegex.Replace(s, "");
        s = SuffixRegex.Replace(s, "");
        return s.Trim();
    }

    public async Task<TimedSongLyrics?> FetchLyricsAsync(string rawTitle, string artist, long expectedDurationMs = 0)
    {
        var cleanTitle = CleanTitle(rawTitle);
        var query = $"{cleanTitle} {artist}".Trim();

        try
        {
            // 1. Search song
            var searchUrl = $"https://music.163.com/api/search/get?s={Uri.EscapeDataString(query)}&type=1&offset=0&limit=5";
            var searchResp = await _httpClient.GetStringAsync(searchUrl);
            using var searchDoc = JsonDocument.Parse(searchResp);

            if (!searchDoc.RootElement.TryGetProperty("result", out var result) ||
                !result.TryGetProperty("songs", out var songs) ||
                songs.GetArrayLength() == 0)
            {
                return null;
            }

            long bestSongId = 0;
            long minDurationDiff = long.MaxValue;

            foreach (var song in songs.EnumerateArray())
            {
                long id = song.GetProperty("id").GetInt64();
                long duration = song.TryGetProperty("duration", out var durProp) ? durProp.GetInt64() : 0;

                if (bestSongId == 0) bestSongId = id;

                if (expectedDurationMs > 0 && duration > 0)
                {
                    long diff = Math.Abs(duration - expectedDurationMs);
                    if (diff < minDurationDiff)
                    {
                        minDurationDiff = diff;
                        bestSongId = id;
                        // If within 3 seconds, that's our match!
                        if (diff <= 3000) break;
                    }
                }
            }

            if (bestSongId == 0) return null;

            // 2. Fetch lyrics with YRC (word-by-word)
            var lyricUrl = $"https://music.163.com/api/song/lyric/v1?id={bestSongId}&lv=-1&kv=-1&tv=-1&yv=1&ytv=1&yrv=1";
            var lyricResp = await _httpClient.GetStringAsync(lyricUrl);
            using var lyricDoc = JsonDocument.Parse(lyricResp);

            // Try YRC first (per-word)
            if (lyricDoc.RootElement.TryGetProperty("yrc", out var yrcObj) &&
                yrcObj.TryGetProperty("lyric", out var yrcTextProp))
            {
                var yrc = yrcTextProp.GetString();
                if (!string.IsNullOrWhiteSpace(yrc))
                {
                    var parsed = ParseYrc(yrc, cleanTitle, artist);
                    if (parsed.Lines.Count > 0)
                    {
                        return parsed;
                    }
                }
            }

            // Fallback to LRC if YRC is missing
            if (lyricDoc.RootElement.TryGetProperty("lrc", out var lrcObj) &&
                lrcObj.TryGetProperty("lyric", out var lrcTextProp))
            {
                var lrc = lrcTextProp.GetString();
                if (!string.IsNullOrWhiteSpace(lrc))
                {
                    return LyricsInterpolator.FromLrc(lrc, cleanTitle, artist);
                }
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public static TimedSongLyrics ParseYrc(string rawYrc, string title, string artist)
    {
        var lyrics = new TimedSongLyrics
        {
            Title = title,
            Artist = artist,
            IsWordLevel = true
        };

        var lines = rawYrc.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var l in lines)
        {
            var match = YrcLineRegex.Match(l.Trim());
            if (!match.Success) continue;

            long lineStart = long.Parse(match.Groups[1].Value);
            long lineDur = long.Parse(match.Groups[2].Value);
            string wordsContent = match.Groups[3].Value;

            var timedLine = new TimedLine
            {
                StartMs = lineStart,
                DurationMs = lineDur
            };

            var wordMatches = YrcWordRegex.Matches(wordsContent);
            foreach (Match wm in wordMatches)
            {
                long wStart = long.Parse(wm.Groups[1].Value);
                long wDur = long.Parse(wm.Groups[2].Value);
                string text = wm.Groups[3].Value;

                if (string.IsNullOrEmpty(text)) continue;

                var icon = WordVisualResolver.Resolve(text);
                timedLine.Words.Add(new TimedWord(wStart, wDur, text, icon));
            }

            if (timedLine.Words.Count > 0)
            {
                timedLine.Text = string.Join("", timedLine.Words.ConvertAll(w => w.Word)).Trim();
                lyrics.Lines.Add(timedLine);
            }
        }

        return lyrics;
    }
}

