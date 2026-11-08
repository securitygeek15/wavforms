using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Wavforms.Core.Lyrics;
using Wavforms.Core.Models;

namespace Wavforms.Launcher;

static class Program
{
    private const string DISCORD_CLIENT_ID = "1568938073365020702";

    [DllImport("shell32.dll", SetLastError = true)]
    private static extern void SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string appId);

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_CAPTION_COLOR = 35;

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
        string publicDir = Path.Combine(baseDir, "public");
        if (!Directory.Exists(publicDir))
        {
            // If running from bin/Release check workspace root
            string candidate = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "..", "public"));
            if (Directory.Exists(candidate))
            {
                baseDir = Path.GetDirectoryName(candidate)!;
                publicDir = candidate;
            }
        }

        // 2. Launch native application window (100% self-contained, zero localhost / node dependencies)
        try
        {
            using var mainForm = new MainWindow(baseDir, publicDir);
            Application.Run(mainForm);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"wavforms encountered an error:\n{ex.Message}",
                "wavforms Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    internal class MainWindow : Form
    {
        private readonly WebView2 _webView;
        private readonly string _baseDir;
        private readonly string _publicDir;
        private readonly LyricsService _lyricsService;
        private readonly DiscordRpcClient _discordClient;

        private bool _isFullscreen;
        private FormWindowState _prevWindowState;
        private FormBorderStyle _prevBorderStyle;
        private Rectangle _prevBounds;

        public MainWindow(string baseDir, string publicDir)
        {
            _baseDir = baseDir;
            _publicDir = publicDir;
            _lyricsService = new LyricsService();
            _discordClient = new DiscordRpcClient(DISCORD_CLIENT_ID);

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
            FormClosing += (s, e) => _discordClient.Dispose();

            // Connect to Discord RPC in background
            Task.Run(() => _discordClient.Connect());
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

                // 1. Map https://wavforms.local/ to the local public folder (Zero localhost!)
                _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "wavforms.local",
                    _publicDir,
                    CoreWebView2HostResourceAccessKind.Allow);

                // 2. Intercept API requests in-process (Zero localhost servers or HTTP sockets!)
                _webView.CoreWebView2.AddWebResourceRequestedFilter(
                    "https://wavforms.local/api/*",
                    CoreWebView2WebResourceContext.All);

                _webView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;

                // 3. Navigate securely to native internal scheme
                _webView.CoreWebView2.Navigate("https://wavforms.local/index.html");
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

        private async void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            var deferral = e.GetDeferral();
            try
            {
                var uri = new Uri(e.Request.Uri);
                string path = uri.AbsolutePath.ToLowerInvariant();

                if (path == "/api/lyrics")
                {
                    await HandleLyricsRequestAsync(e, uri);
                }
                else if (path == "/api/discord/presence")
                {
                    HandleDiscordPresence(e);
                }
                else if (path == "/api/discord/status")
                {
                    var status = new { connected = _discordClient.IsConnected };
                    SendJsonResponse(e, status);
                }
                else if (path == "/api/ping")
                {
                    var ping = new { app = "wavforms", ok = true };
                    SendJsonResponse(e, ping);
                }
                else
                {
                    SendJsonResponse(e, new { error = "Not found" }, 404);
                }
            }
            catch (Exception ex)
            {
                SendJsonResponse(e, new { error = ex.Message }, 500);
            }
            finally
            {
                deferral.Complete();
            }
        }

        private async Task HandleLyricsRequestAsync(CoreWebView2WebResourceRequestedEventArgs e, Uri uri)
        {
            var query = HttpUtility.ParseQueryString(uri.Query);
            string title = query["title"] ?? "";
            string artist = query["artist"] ?? "";
            long.TryParse(query["duration"] ?? "0", out long durationMs);

            var lyrics = await _lyricsService.GetLyricsAsync(title, artist, durationMs);
            if (lyrics != null && lyrics.Lines.Count > 0)
            {
                var responseObj = new
                {
                    title = lyrics.Title,
                    artist = lyrics.Artist,
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
                };
                SendJsonResponse(e, responseObj);
            }
            else
            {
                SendJsonResponse(e, new { error = "No lyrics found", lines = Array.Empty<object>() });
            }
        }

        private void HandleDiscordPresence(CoreWebView2WebResourceRequestedEventArgs e)
        {
            try
            {
                using var stream = e.Request.Content;
                if (stream != null)
                {
                    using var reader = new StreamReader(stream, Encoding.UTF8);
                    string body = reader.ReadToEnd();
                    using var doc = JsonDocument.Parse(body);
                    var root = doc.RootElement;

                    string title = root.TryGetProperty("title", out var tp) ? tp.GetString() ?? "" : "";
                    string artist = root.TryGetProperty("artist", out var ap) ? ap.GetString() ?? "" : "";
                    string currentLyric = root.TryGetProperty("currentLyric", out var lp) ? lp.GetString() ?? "" : "";
                    double durationSec = root.TryGetProperty("durationSec", out var dp) ? dp.GetDouble() : 0;
                    double positionSec = root.TryGetProperty("positionSec", out var pp) ? pp.GetDouble() : 0;
                    bool paused = root.TryGetProperty("paused", out var pauP) && pauP.GetBoolean();

                    long nowEpoch = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                    long startEpoch = positionSec > 0 ? (long)(nowEpoch - positionSec) : nowEpoch;
                    long endEpoch = durationSec > 0 ? (long)(startEpoch + durationSec) : 0;

                    string details = $"{title} • {artist}".Trim(' ', '•');
                    string state = !string.IsNullOrWhiteSpace(currentLyric) ? $"♫ \"{currentLyric}\"" : "";

                    _discordClient.SetActivity(details, state, startEpoch, endEpoch, paused);
                    SendJsonResponse(e, new { ok = true, connected = _discordClient.IsConnected, sent = true });
                    return;
                }
            }
            catch { }

            SendJsonResponse(e, new { ok = false, connected = _discordClient.IsConnected, sent = false });
        }

        private void SendJsonResponse(CoreWebView2WebResourceRequestedEventArgs e, object data, int statusCode = 200)
        {
            string json = JsonSerializer.Serialize(data);
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            var stream = new MemoryStream(bytes);

            string statusText = statusCode == 200 ? "OK" : (statusCode == 404 ? "Not Found" : "Error");
            string headers = "Content-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\n";

            e.Response = _webView.CoreWebView2.Environment.CreateWebResourceResponse(stream, statusCode, statusText, headers);
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

    internal class DiscordRpcClient : IDisposable
    {
        private readonly string _clientId;
        private NamedPipeClientStream? _pipe;
        private readonly object _lock = new();
        private bool _connected;

        public bool IsConnected
        {
            get
            {
                lock (_lock) return _connected && _pipe != null && _pipe.IsConnected;
            }
        }

        public DiscordRpcClient(string clientId)
        {
            _clientId = clientId;
        }

        public bool Connect()
        {
            lock (_lock)
            {
                if (_connected && _pipe != null && _pipe.IsConnected) return true;

                DisposePipe();

                for (int i = 0; i < 10; i++)
                {
                    try
                    {
                        var pipe = new NamedPipeClientStream(".", $"discord-ipc-{i}", PipeDirection.InOut);
                        pipe.Connect(350);

                        // Handshake opcode 0
                        byte[] handshakePayload = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
                        {
                            v = 1,
                            client_id = _clientId
                        }));

                        byte[] header = new byte[8];
                        BitConverter.GetBytes(0).CopyTo(header, 0);
                        BitConverter.GetBytes(handshakePayload.Length).CopyTo(header, 4);

                        pipe.Write(header, 0, 8);
                        pipe.Write(handshakePayload, 0, handshakePayload.Length);
                        pipe.Flush();

                        // Read response header
                        byte[] respHeader = new byte[8];
                        pipe.ReadExactly(respHeader, 0, 8);
                        int len = BitConverter.ToInt32(respHeader, 4);
                        byte[] respPayload = new byte[len];
                        if (len > 0)
                        {
                            pipe.ReadExactly(respPayload, 0, len);
                        }

                        _pipe = pipe;
                        _connected = true;
                        return true;
                    }
                    catch { }
                }

                _connected = false;
                return false;
            }
        }

        public void SetActivity(string details, string state, long startEpochSec, long endEpochSec, bool isPaused)
        {
            lock (_lock)
            {
                if (!IsConnected)
                {
                    if (!Connect()) return;
                }

                try
                {
                    object? activityObj = isPaused ? null : new
                    {
                        details = details,
                        state = state,
                        timestamps = (startEpochSec > 0 && endEpochSec > startEpochSec) ? new
                        {
                            start = startEpochSec,
                            end = endEpochSec
                        } : null,
                        assets = new
                        {
                            large_image = "https://raw.githubusercontent.com/securitygeek15/wavforms/main/assets/logo.png",
                            large_text = "wavforms — synchronized lyrics"
                        },
                        instance = true
                    };

                    var payloadObj = new
                    {
                        cmd = "SET_ACTIVITY",
                        args = new
                        {
                            pid = Process.GetCurrentProcess().Id,
                            activity = activityObj
                        },
                        nonce = Guid.NewGuid().ToString()
                    };

                    byte[] jsonBytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payloadObj));
                    byte[] header = new byte[8];
                    BitConverter.GetBytes(1).CopyTo(header, 0); // opcode 1 = FRAME
                    BitConverter.GetBytes(jsonBytes.Length).CopyTo(header, 4);

                    _pipe!.Write(header, 0, 8);
                    _pipe.Write(jsonBytes, 0, jsonBytes.Length);
                    _pipe.Flush();
                }
                catch
                {
                    _connected = false;
                    DisposePipe();
                }
            }
        }

        private void DisposePipe()
        {
            try
            {
                _pipe?.Dispose();
            }
            catch { }
            _pipe = null;
            _connected = false;
        }

        public void Dispose()
        {
            lock (_lock)
            {
                try
                {
                    if (IsConnected)
                    {
                        SetActivity("", "", 0, 0, true);
                    }
                }
                catch { }
                DisposePipe();
            }
        }
    }
}
