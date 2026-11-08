using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Wavforms.Core.Models;
using Wavforms.Core.Visual;

namespace Wavforms.Core.Lyrics;

public static class LyricsInterpolator
{
    // Flexible LRC timestamp regex: [00:11.08], [0:11.8], [00:11.850], [00:11:08], [00:11]
    private static readonly Regex LrcRegex = new(@"\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\](.*)", RegexOptions.Compiled);

    public static TimedSongLyrics FromLrc(string rawLrc, string title, string artist)
    {
        var lyrics = new TimedSongLyrics
        {
            Title = title,
            Artist = artist,
            IsWordLevel = false // Interpolated with high precision
        };

        var rawLines = rawLrc.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        var parsedList = new List<(long startMs, string text, long explicitEndMs)>();

        foreach (var l in rawLines)
        {
            var trimmed = l.Trim();
            // Skip metadata or NetEase JSON header lines
            if (trimmed.StartsWith("{") || trimmed.StartsWith("[ti:") || trimmed.StartsWith("[ar:") || 
                trimmed.StartsWith("[al:") || trimmed.StartsWith("[by:") || trimmed.StartsWith("[offset:"))
            {
                continue;
            }

            var match = LrcRegex.Match(trimmed);
            if (!match.Success) continue;

            long min = long.Parse(match.Groups[1].Value);
            long sec = long.Parse(match.Groups[2].Value);
            long ms = 0;
            if (match.Groups[3].Success)
            {
                string fracStr = match.Groups[3].Value;
                if (fracStr.Length == 1) ms = long.Parse(fracStr) * 100;
                else if (fracStr.Length == 2) ms = long.Parse(fracStr) * 10;
                else ms = long.Parse(fracStr);
            }

            long totalMs = (min * 60 * 1000) + (sec * 1000) + ms;
            string text = match.Groups[4].Value.Trim();

            if (!string.IsNullOrEmpty(text))
            {
                parsedList.Add((totalMs, text, 0));
            }
            else if (parsedList.Count > 0)
            {
                // Empty timestamp indicates instrumental pause / end of vocal phrase
                var last = parsedList[^1];
                if (last.explicitEndMs == 0 && totalMs > last.startMs)
                {
                    parsedList[^1] = (last.startMs, last.text, totalMs);
                }
            }
        }

        parsedList.Sort((a, b) => a.startMs.CompareTo(b.startMs));

        for (int i = 0; i < parsedList.Count; i++)
        {
            var (startMs, text, explicitEndMs) = parsedList[i];
            long nextStart = (i + 1 < parsedList.Count) ? parsedList[i + 1].startMs : (startMs + 4500);
            long gap = nextStart - startMs;

            var tokens = text.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length == 0) continue;

            long durMs;
            if (explicitEndMs > startMs)
            {
                durMs = explicitEndMs - startMs;
            }
            else if (gap > 4500)
            {
                // Cap instrumental break before the next phrase
                durMs = Math.Min(gap - 600, Math.Max(1200, tokens.Length * 420 + 350));
            }
            else
            {
                durMs = Math.Max(800, gap - 100);
            }

            var timedLine = new TimedLine
            {
                StartMs = startMs,
                DurationMs = durMs,
                Text = text
            };

            // Interpolate words by character weight for natural singing cadence
            int totalChars = 0;
            foreach (var t in tokens) totalChars += Math.Max(1, t.Length);

            long currentWordStart = startMs;
            for (int t = 0; t < tokens.Length; t++)
            {
                string wordStr = tokens[t];
                int charWeight = Math.Max(1, wordStr.Length);
                long wordDur = Math.Max(120, (long)Math.Round((double)charWeight / totalChars * durMs));

                var icon = WordVisualResolver.Resolve(wordStr);
                timedLine.Words.Add(new TimedWord(currentWordStart, wordDur, wordStr, icon));
                currentWordStart += wordDur;
            }

            lyrics.Lines.Add(timedLine);
        }

        return lyrics;
    }

    public static TimedSongLyrics FromPlainLyrics(string rawText, string title, string artist, long totalDurationMs = 0)
    {
        var lyrics = new TimedSongLyrics
        {
            Title = title,
            Artist = artist,
            IsWordLevel = false
        };

        var rawLines = rawText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        var cleanLines = new List<string>();
        foreach (var l in rawLines)
        {
            var trimmed = l.Trim();
            if (trimmed.Length > 0 && !trimmed.StartsWith("[") && !trimmed.StartsWith("{"))
            {
                cleanLines.Add(trimmed);
            }
        }

        if (cleanLines.Count == 0) return lyrics;

        long effectiveDur = totalDurationMs > 30000 ? totalDurationMs : (cleanLines.Count * 4500L);
        long startOffset = Math.Min(10000, effectiveDur / 12);
        long usableDuration = Math.Max(10000, effectiveDur - startOffset - 5000);
        long lineStep = Math.Max(2200, usableDuration / cleanLines.Count);

        for (int i = 0; i < cleanLines.Count; i++)
        {
            string lineText = cleanLines[i];
            long lineStart = startOffset + (i * lineStep);
            long lineDur = Math.Min(lineStep - 300, Math.Max(1200, lineText.Length * 110));

            var timedLine = new TimedLine
            {
                StartMs = lineStart,
                DurationMs = lineDur,
                Text = lineText
            };

            var tokens = lineText.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            int totalChars = 0;
            foreach (var t in tokens) totalChars += Math.Max(1, t.Length);

            long currentWordStart = lineStart;
            for (int t = 0; t < tokens.Length; t++)
            {
                string wordStr = tokens[t];
                int charWeight = Math.Max(1, wordStr.Length);
                long wordDur = Math.Max(100, (long)Math.Round((double)charWeight / Math.Max(1, totalChars) * lineDur));
                timedLine.Words.Add(new TimedWord(currentWordStart, wordDur, wordStr, null));
                currentWordStart += wordDur;
            }

            lyrics.Lines.Add(timedLine);
        }

        return lyrics;
    }
}
