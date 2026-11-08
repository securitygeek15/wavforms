using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Wavforms.Launcher;

static class Program
{
    [DllImport("shell32.dll", SetLastError = true)]
    private static extern void SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string appId);

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_CAPTION_COLOR = 35;

    private static Process? _spawnedServerProcess;

    [STAThread]
    static void Main(string[] args)
    {
        // 1. Establish unique Windows AppUserModelId so Taskbar pins wavforms as a native app
        try
        {
            SetCurrentProcessExplicitAppUserModelID("securitygeek.wavforms");
        }
        catch { }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        string serverScript = Path.Combine(baseDir, "server.js");
        if (!File.Exists(serverScript))
        {
            string candidate = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "..", "server.js"));
            if (File.Exists(candidate))
            {
                baseDir = Path.GetDirectoryName(candidate)!;
                serverScript = candidate;
            }
        }

        // 2. Ensure local server is running
        bool serverAlive = CheckServerAlive("http://localhost:3456/api/ping");
        if (!serverAlive && File.Exists(serverScript))
        {
            string nodeExe = FindNodeExecutable(baseDir);
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = $"\"{serverScript}\"",
                    WorkingDirectory = baseDir,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                _spawnedServerProcess = Process.Start(psi);

                // Wait up to 4 seconds for server to respond
                for (int i = 0; i < 40; i++)
                {
                    Thread.Sleep(100);
                    if (CheckServerAlive("http://localhost:3456/api/ping"))
                    {
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Unable to start wavforms server with Node.js:\n{ex.Message}\n\nPlease ensure Node.js is installed from nodejs.org.",
                    "wavforms",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
        }

        // 3. Launch native application window
        try
        {
            using var mainForm = new MainWindow(baseDir);
            Application.Run(mainForm);
        }
        catch (Exception ex)
        {
            File.WriteAllText(Path.Combine(baseDir, "wavforms-crash.log"), ex.ToString());
            MessageBox.Show($"wavforms encountered an error:\n{ex.Message}", "wavforms Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            // 4. Clean shutdown
            if (_spawnedServerProcess != null && !_spawnedServerProcess.HasExited)
            {
                try
                {
                    _spawnedServerProcess.Kill();
                }
                catch { }
            }
        }
    }

    private static bool CheckServerAlive(string url)
    {
        try
        {
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Timeout = 400;
            req.Method = "GET";
            using var resp = (HttpWebResponse)req.GetResponse();
            return resp.StatusCode == HttpStatusCode.OK;
        }
        catch
        {
            return false;
        }
    }

    private static string FindNodeExecutable(string baseDir)
    {
        string localNode = Path.Combine(baseDir, "node.exe");
        if (File.Exists(localNode)) return localNode;

        string[] searchPaths =
        {
            @"C:\Program Files\nodejs\node.exe",
            @"C:\Program Files (x86)\nodejs\node.exe",
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "nodejs", "node.exe")
        };

        foreach (var p in searchPaths)
        {
            if (File.Exists(p)) return p;
        }

        return "node";
    }

    internal class MainWindow : Form
    {
        private readonly WebView2 _webView;
        private readonly string _baseDir;
        private bool _isFullscreen;
        private FormWindowState _prevWindowState;
        private FormBorderStyle _prevBorderStyle;
        private Rectangle _prevBounds;

        public MainWindow(string baseDir)
        {
            _baseDir = baseDir;

            Text = "wavforms";
            Size = new Size(1240, 820);
            MinimumSize = new Size(960, 640);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(7, 7, 9);
            DoubleBuffered = true;

            // Load app icon
            string iconPath = Path.Combine(baseDir, "assets", "icon.ico");
            if (File.Exists(iconPath))
            {
                try { Icon = new Icon(iconPath); } catch { }
            }
            else
            {
                try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            }

            _webView = new WebView2
            {
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = Color.FromArgb(7, 7, 9)
            };
            Controls.Add(_webView);

            KeyPreview = true;
            KeyDown += OnKeyDown;
            Load += OnLoad;
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            ApplyImmersiveDarkMode(Handle);
        }

        private static void ApplyImmersiveDarkMode(IntPtr handle)
        {
            int darkMode = 1;
            if (DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int)) != 0)
            {
                DwmSetWindowAttribute(handle, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1, ref darkMode, sizeof(int));
            }

            // Dark caption bar color (#070709 -> BGR 0x090707)
            int captionColor = 0x090707;
            DwmSetWindowAttribute(handle, DWMWA_CAPTION_COLOR, ref captionColor, sizeof(int));
        }

        private async void OnLoad(object? sender, EventArgs e)
        {
            try
            {
                string userData = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "wavforms",
                    "WebViewData");
                Directory.CreateDirectory(userData);

                var env = await CoreWebView2Environment.CreateAsync(null, userData);
                await _webView.EnsureCoreWebView2Async(env);

                var s = _webView.CoreWebView2.Settings;
                s.AreDefaultContextMenusEnabled = false;
                s.IsStatusBarEnabled = false;
                s.AreDevToolsEnabled = false;
                s.AreBrowserAcceleratorKeysEnabled = false;
                s.IsSwipeNavigationEnabled = false;

                _webView.CoreWebView2.Navigate("http://localhost:3456");
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Failed to initialize native engine:\n{ex.Message}",
                    "wavforms",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        private void OnKeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.F11)
            {
                ToggleFullscreen();
                e.Handled = true;
            }
        }

        private void ToggleFullscreen()
        {
            if (!_isFullscreen)
            {
                _prevWindowState = WindowState;
                _prevBorderStyle = FormBorderStyle;
                _prevBounds = Bounds;

                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Normal;
                Bounds = Screen.FromControl(this).Bounds;
                TopMost = true;
                _isFullscreen = true;
            }
            else
            {
                FormBorderStyle = _prevBorderStyle;
                WindowState = _prevWindowState;
                Bounds = _prevBounds;
                TopMost = false;
                _isFullscreen = false;
            }
        }
    }
}
