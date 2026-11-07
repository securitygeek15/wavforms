using System;
using System.Runtime.InteropServices;

namespace Wavforms.Core.Power;

public static class ScreenAwakeManager
{
    [Flags]
    private enum ExecutionState : uint
    {
        ES_SYSTEM_REQUIRED = 0x00000001,
        ES_DISPLAY_REQUIRED = 0x00000002,
        ES_CONTINUOUS = 0x80000000
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern ExecutionState SetThreadExecutionState(ExecutionState esFlags);

    private static bool _isAwake;

    /// <summary>
    /// Keeps display on while music is playing.
    /// </summary>
    public static void HoldAwake(bool keepAwake)
    {
        if (keepAwake && !_isAwake)
        {
            SetThreadExecutionState(ExecutionState.ES_DISPLAY_REQUIRED | ExecutionState.ES_CONTINUOUS);
            _isAwake = true;
        }
        else if (!keepAwake && _isAwake)
        {
            SetThreadExecutionState(ExecutionState.ES_CONTINUOUS);
            _isAwake = false;
        }
    }
}

