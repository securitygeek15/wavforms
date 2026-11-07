using System;
using System.Collections.Generic;
using System.Linq;

namespace Wavforms.Core.Models;

public record TimedWord(
    long StartMs,
    long DurationMs,
    string Word,
    string? Icon = null
)
{
    public long EndMs => StartMs + DurationMs;
    public bool IsActive(long currentMs) => currentMs >= StartMs && currentMs < EndMs;
    public bool HasPassed(long currentMs) => currentMs >= EndMs;
}

public class TimedLine
{
    public long StartMs { get; set; }
    public long DurationMs { get; set; }
    public string Text { get; set; } = string.Empty;
    public List<TimedWord> Words { get; set; } = new();

    public long EndMs => StartMs + DurationMs;
    public bool IsActive(long currentMs) => currentMs >= StartMs && currentMs < EndMs;
    public bool HasPassed(long currentMs) => currentMs >= EndMs;
}

public class TimedSongLyrics
{
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public bool IsWordLevel { get; set; }
    public List<TimedLine> Lines { get; set; } = new();

    public TimedLine? GetCurrentLine(long currentMs)
    {
        for (int i = 0; i < Lines.Count; i++)
        {
            var line = Lines[i];
            long nextStart = (i + 1 < Lines.Count) ? Lines[i + 1].StartMs : long.MaxValue;
            if (currentMs >= line.StartMs && currentMs < nextStart)
            {
                return line;
            }
        }
        return Lines.LastOrDefault(l => l.StartMs <= currentMs);
    }

    public (TimedLine? line, int lineIndex, TimedWord? word, int wordIndex) GetPlaybackState(long currentMs)
    {
        for (int i = 0; i < Lines.Count; i++)
        {
            var line = Lines[i];
            long nextStart = (i + 1 < Lines.Count) ? Lines[i + 1].StartMs : long.MaxValue;
            if (currentMs >= line.StartMs && currentMs < nextStart)
            {
                for (int w = 0; w < line.Words.Count; w++)
                {
                    if (line.Words[w].IsActive(currentMs))
                    {
                        return (line, i, line.Words[w], w);
                    }
                }
                return (line, i, null, -1);
            }
        }
        return (null, -1, null, -1);
    }
}

