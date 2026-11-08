using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;

namespace Wavforms.Launcher;

static class Program
{
    [STAThread]
    static async Task Main(string[] args)
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string serverScript = Path.Combine(baseDir, "server.js");

        // 1. Locate Node.js (check bundled in app folder, then system PATH)
        string nodeExe = Path.Combine(baseDir, "node.exe");
        if (!File.Exists(nodeExe))
        {
            string programFilesNode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
            if (File.Exists(programFilesNode))
            {
                nodeExe = programFilesNode;
            }
            else
            {
                nodeExe = "node";
            }
        }

        // 2. Check if server is already running
        bool isServerRunning = await IsServerAliveAsync("http://localhost:3456/api/ping");
        Process? serverProcess = null;

        if (!isServerRunning && File.Exists(serverScript))
        {
            var serverPsi = new ProcessStartInfo
            {
                FileName = nodeExe,
                Arguments = $"\"{serverScript}\"",
                WorkingDirectory = baseDir,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            try
            {
                serverProcess = Process.Start(serverPsi);
                for (int i = 0; i < 20; i++)
                {
                    await Task.Delay(100);
                    if (await IsServerAliveAsync("http://localhost:3456/api/ping")) break;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to start server: {ex.Message}");
            }
        }

        // 3. Locate Edge or Chrome for dedicated App Mode window
        string edgePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe");
        string chromePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe");

        string browserExe = File.Exists(edgePath) ? edgePath : (File.Exists(chromePath) ? chromePath : "");

        if (!string.IsNullOrEmpty(browserExe))
        {
            var appPsi = new ProcessStartInfo
            {
                FileName = browserExe,
                Arguments = "--app=\"http://localhost:3456\" --window-size=1180,780",
                UseShellExecute = true
            };
            var appProcess = Process.Start(appPsi);
            appProcess?.WaitForExit();
        }
        else
        {
            // Default browser fallback
            Process.Start(new ProcessStartInfo
            {
                FileName = "http://localhost:3456",
                UseShellExecute = true
            });
        }
    }

    private static async Task<bool> IsServerAliveAsync(string url)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(400) };
            var resp = await client.GetAsync(url);
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
