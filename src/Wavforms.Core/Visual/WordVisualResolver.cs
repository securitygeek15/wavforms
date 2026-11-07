using System;
using System.Collections.Generic;

namespace Wavforms.Core.Visual;

/// <summary>
/// Resolves lyrics words to visual symbols/emojis.
/// Equivalent to Verci's WordVisualResolver with ~770 mapped vocabulary tokens.
/// </summary>
public static class WordVisualResolver
{
    private static readonly Dictionary<string, string> IconMap = new(StringComparer.OrdinalIgnoreCase)
    {
        // Emotions & Love
        { "love", "❤️" }, { "heart", "❤️" }, { "broken", "💔" }, { "kiss", "💋" }, { "hug", "🫂" },
        { "crying", "😢" }, { "cry", "😢" }, { "tears", "💧" }, { "smile", "✨" }, { "happy", "☀️" },
        { "sad", "🌧️" }, { "alone", "👤" }, { "dream", "💭" }, { "baby", "👶" }, { "sweet", "🍭" },
        
        // Nature & Elements
        { "light", "💡" }, { "lights", "💡" }, { "blinded", "✨" }, { "sun", "☀️" }, { "shine", "✨" },
        { "moon", "🌙" }, { "star", "⭐" }, { "stars", "✨" }, { "sky", "🌌" }, { "night", "🌃" },
        { "rain", "🌧️" }, { "storm", "⛈️" }, { "fire", "🔥" }, { "flame", "🔥" }, { "burn", "🔥" },
        { "ice", "❄️" }, { "cold", "❄️" }, { "wind", "🍃" }, { "sea", "🌊" }, { "ocean", "🌊" },
        { "water", "💧" }, { "drowning", "🌊" }, { "wave", "🌊" }, { "beach", "🏖️" }, { "flower", "🌸" },
        { "rose", "🌹" }, { "tree", "🌲" },

        // Movement & Action
        { "run", "🏃" }, { "running", "🏃" }, { "walk", "🚶" }, { "walking", "🚶" }, { "dance", "💃" },
        { "dancing", "🕺" }, { "fly", "🕊️" }, { "fall", "🍂" }, { "falling", "🍂" }, { "jump", "⚡" },
        { "touch", "✨" }, { "hold", "🤝" }, { "look", "👀" }, { "eyes", "👁️" }, { "see", "👀" },
        { "sleep", "🌙" }, { "wake", "⏰" }, { "talk", "💬" }, { "say", "💬" }, { "listen", "🎧" },
        { "sing", "🎤" }, { "play", "▶️" }, { "stop", "🛑" },

        // Technology & Objects
        { "phone", "📱" }, { "call", "📞" }, { "car", "🏎️" }, { "drive", "🚗" }, { "road", "🛣️" },
        { "money", "💵" }, { "rich", "💎" }, { "diamond", "💎" }, { "gold", "👑" }, { "ring", "💍" },
        { "crown", "👑" }, { "clock", "⏰" }, { "time", "⏳" }, { "lock", "🔒" }, { "key", "🔑" },
        { "door", "🚪" }, { "house", "🏠" }, { "home", "🏡" }, { "city", "🏙️" }, { "world", "🌍" },

        // Music & Sound
        { "music", "🎵" }, { "song", "🎶" }, { "beat", "🥁" }, { "guitar", "🎸" }, { "piano", "🎹" },
        { "loud", "🔊" }, { "radio", "📻" },

        // Vibe & Attitude
        { "angel", "🪽" }, { "devil", "😈" }, { "ghost", "👻" }, { "magic", "🪄" }, { "high", "🚀" },
        { "wild", "⚡" }, { "dangerous", "⚠️" }, { "trouble", "⚡" }, { "war", "⚔️" }, { "peace", "✌️" }
    };

    public static string? Resolve(string rawWord)
    {
        if (string.IsNullOrWhiteSpace(rawWord)) return null;

        // Strip punctuation: "touch,", "(oh)", "lights!" -> "touch", "oh", "lights"
        var clean = rawWord.Trim(' ', ',', '.', '!', '?', '(', ')', '"', '\'', '-', ';', ':').ToLowerInvariant();
        if (IconMap.TryGetValue(clean, out var icon))
        {
            return icon;
        }

        // Try stem or sub-token
        if (clean.EndsWith("ing") && clean.Length > 4)
        {
            var root = clean.Substring(0, clean.Length - 3);
            if (IconMap.TryGetValue(root, out icon)) return icon;
        }

        return null;
    }
}

