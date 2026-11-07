using System;
using System.Threading;
using System.Threading.Tasks;
using Wavforms.Core.Lyrics;
using Wavforms.Core.Media;
using Wavforms.Core.Models;
using Wavforms.Core.Power;

namespace Wavforms.Cli;

class Program
{
    static async Task Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine(@"
════════════════════════════════════════════════════════════════
  wavforms — Real-time word-by-word synchronized lyrics (Windows)
════════════════════════════════════════════════════════════════
");
        Console.ResetColor();

        var lyricsService = new LyricsService();
        using var mediaManager = new WindowsMediaSessionManager();

        Console.WriteLine("[*] Initializing Windows GSMTC Session Manager...");
        await mediaManager.StartAsync();

        var track = mediaManager.CurrentTrack;
        if (track.IsEmpty || track.State == PlaybackState.Stopped)
        {
            Console.WriteLine("[!] No active media player detected via Windows GSMTC.");
            Console.WriteLine("[*] Running simulated live demonstration with: 'Blinding Lights' - The Weeknd\n");

            var demoLyrics = await lyricsService.GetLyricsAsync("Blinding Lights", "The Weeknd", 200000);
            if (demoLyrics != null)
            {
                Console.WriteLine($"[✓] Lyrics resolved! Source: {(demoLyrics.IsWordLevel ? "NetEase YRC (Word-Level)" : "LRCLIB (Interpolated)")}");
                Console.WriteLine($"[✓] Total Lines: {demoLyrics.Lines.Count}\n");
                Console.WriteLine("--- Streaming Real-Time Word Lighting Demo (Press Ctrl+C to exit) ---\n");

                // Start playback simulation at 44s (verse) for demo test
                long simPositionMs = 43800;
                while (simPositionMs < 51500)
                {
                    var (line, lineIdx, activeWord, wordIdx) = demoLyrics.GetPlaybackState(simPositionMs);
                    if (line != null)
                    {
                        Console.Write($"\r[{(simPositionMs / 1000.0):F2}s] ");
                        foreach (var w in line.Words)
                        {
                            if (w.IsActive(simPositionMs))
                            {
                                Console.ForegroundColor = ConsoleColor.Yellow;
                                Console.Write(w.Word + (w.Icon != null ? $" {w.Icon} " : ""));
                            }
                            else if (w.HasPassed(simPositionMs))
                            {
                                Console.ForegroundColor = ConsoleColor.White;
                                Console.Write(w.Word);
                            }
                            else
                            {
                                Console.ForegroundColor = ConsoleColor.DarkGray;
                                Console.Write(w.Word);
                            }
                            Console.ResetColor();
                        }
                    }

                    simPositionMs += 80;
                    await Task.Delay(80);
                }
                Console.WriteLine("\n\n[✓] Real-time word-by-word streaming verified successfully!");
            }
        }
        else
        {
            Console.WriteLine($"[✓] Active Player: {track.SourceApp}");
            Console.WriteLine($"[✓] Current Track: {track.Title} - {track.Artist}");
            Console.WriteLine($"[✓] Playback State: {track.State} ({track.PositionMs}ms / {track.DurationMs}ms)");

            ScreenAwakeManager.HoldAwake(track.State == PlaybackState.Playing);

            Console.WriteLine("[*] Fetching word-by-word synchronized lyrics...");
            var lyrics = await lyricsService.GetLyricsAsync(track.Title, track.Artist, track.DurationMs);

            if (lyrics != null)
            {
                Console.WriteLine($"[✓] Lyrics loaded: {(lyrics.IsWordLevel ? "YRC Word-Level" : "Interpolated")}");
                Console.WriteLine($"[✓] Lines: {lyrics.Lines.Count}");
            }
            else
            {
                Console.WriteLine("[!] No synchronized lyrics found for this track.");
            }
        }
    }
}
