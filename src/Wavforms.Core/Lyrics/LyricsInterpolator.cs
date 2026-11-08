using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Wavforms.Core.Models;
using Wavforms.Core.Visual;

namespace Wavforms.Core.Lyrics;

public static class LyricsInterpolator
{
    // Standard LRC timestamp: [mm:ss.xx] or [mm:ss.xxx]
    private static readonly Regex LrcRegex = new(@"\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)", RegexOptions.Compiled);

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
            var match = LrcRegex.Match(l.Trim());
            if (!match.Success) continue;

            long min = long.Parse(match.Groups[1].Value);
            long sec = long.Parse(match.Groups[2].Value);
            string fracStr = match.Groups[3].Value;
            long ms = fracStr.Length == 2 ? long.Parse(fracStr) * 10 : long.Parse(fracStr);

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
}
