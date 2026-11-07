using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;
using Wavforms.Core.Lyrics;
using Wavforms.Core.Media;
using Wavforms.Core.Models;
using Wavforms.Core.Power;

namespace Wavforms.App;

public partial class MainWindow : Window
{
    private readonly WindowsMediaSessionManager _mediaManager;
    private readonly LyricsService _lyricsService;
    private bool _isInitialized;

    public MainWindow()
    {
        InitializeComponent();
        _mediaManager = new WindowsMediaSessionManager();
        _lyricsService = new LyricsService();

        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
        MouseDown += (s, e) =>
        {
            if (e.ChangedButton == MouseButton.Left) DragMove();
        };
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            await WebView.EnsureCoreWebView2Async();
            WebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            WebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            string htmlPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "index.html");
            if (File.Exists(htmlPath))
            {
                WebView.CoreWebView2.Navigate(new Uri(htmlPath).AbsoluteUri);
            }

            _mediaManager.TrackChanged += OnTrackChanged;
            _mediaManager.PlaybackStateChanged += OnPlaybackStateChanged;

            await _mediaManager.StartAsync();
            _isInitialized = true;
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to initialize wavforms: {ex.Message}", "wavforms", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            if (doc.RootElement.TryGetProperty("type", out var typeProp))
            {
                string msgType = typeProp.GetString() ?? "";
                switch (msgType)
                {
                    case "minimize":
                        WindowState = WindowState.Minimized;
                        break;
                    case "hide":
                        Close();
                        break;
                    case "togglePin":
                        if (doc.RootElement.TryGetProperty("pinned", out var pinProp))
                        {
                            Topmost = pinProp.GetBoolean();
                        }
                        break;
                }
            }
        }
        catch { }
    }

    private async void OnTrackChanged(MediaTrackInfo track)
    {
        if (!_isInitialized) return;

        Dispatcher.Invoke(() =>
        {
            string thumbBase64 = track.ThumbnailBytes != null ?
                $"data:image/png;base64,{Convert.ToBase64String(track.ThumbnailBytes)}" : "";

            var trackPayload = new
            {
                type = "trackChange",
                track = new
                {
                    sourceApp = track.SourceApp,
                    title = track.Title,
                    artist = track.Artist,
                    album = track.AlbumTitle,
                    durationMs = track.DurationMs,
                    thumbnail = thumbBase64
                }
            };

            WebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(trackPayload));
        });

        // Keep screen awake if playing
        ScreenAwakeManager.HoldAwake(track.State == PlaybackState.Playing);

        // Fetch Word-by-Word lyrics
        if (!string.IsNullOrWhiteSpace(track.Title))
        {
            var lyrics = await _lyricsService.GetLyricsAsync(track.Title, track.Artist, track.DurationMs);
            if (lyrics != null)
            {
                Dispatcher.Invoke(() =>
                {
                    var lyricsPayload = new
                    {
                        type = "lyricsLoaded",
                        lyrics = new
                        {
                            isWordLevel = lyrics.IsWordLevel,
                            lines = lyrics.Lines.ConvertAll(l => new
                            {
                                startMs = l.StartMs,
                                durationMs = l.DurationMs,
                                text = l.Text,
                                words = l.Words.ConvertAll(w => new
                                {
                                    startMs = w.StartMs,
                                    durationMs = w.DurationMs,
                                    word = w.Word,
                                    icon = w.Icon
                                })
                            })
                        }
                    };

                    WebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(lyricsPayload));
                });
            }
        }
    }

    private void OnPlaybackStateChanged(MediaTrackInfo track)
    {
        if (!_isInitialized) return;

        Dispatcher.Invoke(() =>
        {
            var payload = new
            {
                type = "playbackChange",
                positionMs = track.PositionMs,
                isPlaying = track.State == PlaybackState.Playing
            };

            WebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(payload));
        });

        ScreenAwakeManager.HoldAwake(track.State == PlaybackState.Playing);
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        ScreenAwakeManager.HoldAwake(false);
        _mediaManager.Dispose();
    }
}
