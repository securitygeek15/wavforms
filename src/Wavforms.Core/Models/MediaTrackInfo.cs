using System;

namespace Wavforms.Core.Models;

public enum PlaybackState
{
    Stopped,
    Playing,
    Paused
}

public record MediaTrackInfo(
    string SourceApp,
    string Title,
    string Artist,
    string AlbumTitle,
    long DurationMs,
    long PositionMs,
    PlaybackState State,
    byte[]? ThumbnailBytes = null
)
{
    public bool IsEmpty => string.IsNullOrWhiteSpace(Title);

    public override string ToString() =>
        $"{Title} - {Artist} [{State}] ({PositionMs}ms / {DurationMs}ms)";
}

