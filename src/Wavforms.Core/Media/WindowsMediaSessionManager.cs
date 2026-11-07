using System;
using System.IO;
using System.Threading.Tasks;
using Windows.Media.Control;
using Windows.Storage.Streams;
using Wavforms.Core.Models;

namespace Wavforms.Core.Media;

public class WindowsMediaSessionManager : IDisposable
{
    private GlobalSystemMediaTransportControlsSessionManager? _sessionManager;
    private GlobalSystemMediaTransportControlsSession? _currentSession;
    
    public event Action<MediaTrackInfo>? TrackChanged;
    public event Action<MediaTrackInfo>? PlaybackStateChanged;

    public MediaTrackInfo CurrentTrack { get; private set; } = new("", "", "", "", 0, 0, PlaybackState.Stopped);

    public async Task StartAsync()
    {
        try
        {
            _sessionManager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            if (_sessionManager == null) return;

            _sessionManager.CurrentSessionChanged += OnCurrentSessionChanged;
            UpdateSession(_sessionManager.GetCurrentSession());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GSMTC] Error initializing media manager: {ex.Message}");
        }
    }

    private void OnCurrentSessionChanged(GlobalSystemMediaTransportControlsSessionManager sender, CurrentSessionChangedEventArgs args)
    {
        UpdateSession(sender.GetCurrentSession());
    }

    private void UpdateSession(GlobalSystemMediaTransportControlsSession? session)
    {
        if (_currentSession != null)
        {
            _currentSession.MediaPropertiesChanged -= OnMediaPropertiesChanged;
            _currentSession.PlaybackInfoChanged -= OnPlaybackInfoChanged;
            _currentSession.TimelinePropertiesChanged -= OnTimelinePropertiesChanged;
        }

        _currentSession = session;

        if (_currentSession != null)
        {
            _currentSession.MediaPropertiesChanged += OnMediaPropertiesChanged;
            _currentSession.PlaybackInfoChanged += OnPlaybackInfoChanged;
            _currentSession.TimelinePropertiesChanged += OnTimelinePropertiesChanged;
            _ = RefreshTrackInfoAsync();
        }
        else
        {
            CurrentTrack = new("", "", "", "", 0, 0, PlaybackState.Stopped);
            TrackChanged?.Invoke(CurrentTrack);
        }
    }

    private void OnMediaPropertiesChanged(GlobalSystemMediaTransportControlsSession sender, MediaPropertiesChangedEventArgs args)
    {
        _ = RefreshTrackInfoAsync();
    }

    private void OnPlaybackInfoChanged(GlobalSystemMediaTransportControlsSession sender, PlaybackInfoChangedEventArgs args)
    {
        _ = RefreshTrackInfoAsync();
    }

    private void OnTimelinePropertiesChanged(GlobalSystemMediaTransportControlsSession sender, TimelinePropertiesChangedEventArgs args)
    {
        _ = RefreshTrackInfoAsync();
    }

    public async Task RefreshTrackInfoAsync()
    {
        if (_currentSession == null) return;

        try
        {
            var mediaProps = await _currentSession.TryGetMediaPropertiesAsync();
            var playbackInfo = _currentSession.GetPlaybackInfo();
            var timeline = _currentSession.GetTimelineProperties();

            string appName = _currentSession.SourceAppUserModelId ?? "Media Player";
            string title = mediaProps?.Title ?? "";
            string artist = mediaProps?.Artist ?? "";
            string album = mediaProps?.AlbumTitle ?? "";

            var state = PlaybackState.Stopped;
            if (playbackInfo != null)
            {
                state = playbackInfo.PlaybackStatus switch
                {
                    GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing => PlaybackState.Playing,
                    GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused => PlaybackState.Paused,
                    _ => PlaybackState.Stopped
                };
            }

            long durationMs = (long)timeline.EndTime.TotalMilliseconds;
            long positionMs = (long)timeline.Position.TotalMilliseconds;

            // Extract thumbnail bytes if present
            byte[]? thumbBytes = null;
            if (mediaProps?.Thumbnail != null)
            {
                try
                {
                    using var streamRef = await mediaProps.Thumbnail.OpenReadAsync();
                    using var netStream = streamRef.AsStreamForRead();
                    using var ms = new MemoryStream();
                    await netStream.CopyToAsync(ms);
                    thumbBytes = ms.ToArray();
                }
                catch
                {
                    // thumbnail read optional
                }
            }

            bool trackTitleChanged = CurrentTrack.Title != title || CurrentTrack.Artist != artist;
            CurrentTrack = new MediaTrackInfo(appName, title, artist, album, durationMs, positionMs, state, thumbBytes ?? CurrentTrack.ThumbnailBytes);

            if (trackTitleChanged)
            {
                TrackChanged?.Invoke(CurrentTrack);
            }
            else
            {
                PlaybackStateChanged?.Invoke(CurrentTrack);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GSMTC] Error refreshing track info: {ex.Message}");
        }
    }

    public void Dispose()
    {
        if (_currentSession != null)
        {
            _currentSession.MediaPropertiesChanged -= OnMediaPropertiesChanged;
            _currentSession.PlaybackInfoChanged -= OnPlaybackInfoChanged;
            _currentSession.TimelinePropertiesChanged -= OnTimelinePropertiesChanged;
            _currentSession = null;
        }

        if (_sessionManager != null)
        {
            _sessionManager.CurrentSessionChanged -= OnCurrentSessionChanged;
            _sessionManager = null;
        }
    }
}

