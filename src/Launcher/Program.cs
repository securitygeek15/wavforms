using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace Wavforms.Launcher
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
            string serverScript = Path.Combine(baseDir, "server.js");

            // 1. Locate Node.js executable
            string nodeExe = FindNodeExecutable(baseDir);

            // 2. Check if local server is already running on port 3456
            bool serverRunning = IsServerResponsive("http://localhost:3456/api/ping");

            if (!serverRunning)
            {
                if (string.IsNullOrEmpty(nodeExe))
                {
                    var result = MessageBox.Show(
                        "Node.js is required to run the wavforms lyric engine.\n\nWould you like to open nodejs.org to install Node.js?",
                        "wavforms — Node.js Required",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Information);

                    if (result == DialogResult.Yes)
                    {
                        Process.Start("https://nodejs.org/");
                    }
                    return;
                }

                if (File.Exists(serverScript))
                {
                    try
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = nodeExe,
                            Arguments = "\"" + serverScript + "\"",
                            WorkingDirectory = baseDir,
                            CreateNoWindow = true,
                            UseShellExecute = false,
                            WindowStyle = ProcessWindowStyle.Hidden
                        };
                        Process.Start(psi);

                        // Wait for server to become responsive (up to 3 seconds)
                        for (int i = 0; i < 30; i++)
                        {
                            Thread.Sleep(100);
                            if (IsServerResponsive("http://localhost:3456/api/ping"))
                                break;
                        }
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show(
                            "Failed to start wavforms background service:\n" + ex.Message,
                            "wavforms Error",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning);
                    }
                }
            }

            // 3. Launch UI in dedicated App Mode
            string edgeApp = FindBrowserAppMode();
            string appUrl = "http://localhost:3456";

            if (!string.IsNullOrEmpty(edgeApp))
            {
                try
                {
                    var appPsi = new ProcessStartInfo
                    {
                        FileName = edgeApp,
                        Arguments = "--app=\"" + appUrl + "\" --window-size=1200,800",
                        UseShellExecute = true
                    };
                    Process.Start(appPsi);
                    return;
                }
                catch { }
            }

            // Fallback: Open in default browser
            try
            {
                Process.Start(appUrl);
            }
            catch { }
        }

        private static string FindNodeExecutable(string baseDir)
        {
            // 1. Local bundled node
            string localNode = Path.Combine(baseDir, "node.exe");
            if (File.Exists(localNode)) return localNode;

            // 2. Direct 64-bit Program Files
            string pf64 = Environment.GetEnvironmentVariable("ProgramW6432");
            if (!string.IsNullOrEmpty(pf64))
            {
                string p = Path.Combine(pf64, "nodejs", "node.exe");
                if (File.Exists(p)) return p;
            }

            // 3. Common installation paths
            string[] directPaths = new string[]
            {
                @"C:\Program Files\nodejs\node.exe",
                @"C:\Program Files (x86)\nodejs\node.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "nodejs", "node.exe")
            };

            foreach (var path in directPaths)
            {
                if (File.Exists(path)) return path;
            }

            // 4. Iterate directories in PATH variable
            string pathEnv = Environment.GetEnvironmentVariable("PATH");
            if (!string.IsNullOrEmpty(pathEnv))
            {
                foreach (var dir in pathEnv.Split(';'))
                {
                    try
                    {
                        string trimmed = dir.Trim().Trim('"');
                        if (!string.IsNullOrEmpty(trimmed) && Directory.Exists(trimmed))
                        {
                            string candidate = Path.Combine(trimmed, "node.exe");
                            if (File.Exists(candidate)) return candidate;
                        }
                    }
                    catch { }
                }
            }

            return "node";
        }

        private static string FindBrowserAppMode()
        {
            string pfx86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            string[] candidates = new string[]
            {
                Path.Combine(pfx86, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(pf, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(pfx86, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")
            };

            foreach (var path in candidates)
            {
                if (File.Exists(path)) return path;
            }

            return null;
        }

        private static bool IsServerResponsive(string url)
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 500;
                req.Method = "GET";
                using (var resp = (HttpWebResponse)req.GetResponse())
                {
                    if (resp.StatusCode != HttpStatusCode.OK) return false;
                    using (var reader = new StreamReader(resp.GetResponseStream()))
                    {
                        string body = reader.ReadToEnd();
                        return body.Contains("wavforms");
                    }
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
