using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Wavforms.Installer
{
    public class InstallerForm : Form
    {
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;

        [DllImport("gdi32.dll")]
        private static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int cx, int cy);

        private int progressValue = 5;
        private string statusText = "Initializing setup...";
        private Image logoImage;
        private System.Windows.Forms.Timer uiTimer;
        private bool isCompleted = false;

        public InstallerForm()
        {
            this.Text = "wavforms Setup";
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Size = new Size(480, 350);
            this.BackColor = Color.FromArgb(13, 13, 17);
            this.DoubleBuffered = true;
            this.ShowInTaskbar = true;

            // Load Embedded Logo
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                using (var stream = asm.GetManifestResourceStream("Logo"))
                {
                    if (stream != null)
                    {
                        logoImage = Image.FromStream(stream);
                    }
                }
            }
            catch { }

            // UI Refresh Timer for smooth progress animation
            uiTimer = new System.Windows.Forms.Timer();
            uiTimer.Interval = 25;
            uiTimer.Tick += (s, e) => this.Invalidate();
            uiTimer.Start();

            // Dragging anywhere on form
            this.MouseDown += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(this.Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                }
            };

            this.Shown += (s, e) =>
            {
                // Round corners
                try
                {
                    this.Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 28, 28));
                }
                catch { }

                // Start installer thread
                var thread = new Thread(RunInstallRoutine);
                thread.IsBackground = true;
                thread.Start();
            };
        }

        private void SetProgress(int value, string status)
        {
            if (this.IsDisposed) return;
            this.Invoke((MethodInvoker)delegate
            {
                progressValue = Math.Max(0, Math.Min(100, value));
                statusText = status;
                this.Invalidate();
            });
        }

        private void RunInstallRoutine()
        {
            try
            {
                string targetDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "wavforms");

                Thread.Sleep(300);
                SetProgress(15, "Preparing installation...");

                // Terminate any running instances in target directory
                KillExistingInstances(targetDir);

                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                Thread.Sleep(200);
                SetProgress(30, "Extracting application payload...");

                // Extract embedded ZIP payload
                var asm = Assembly.GetExecutingAssembly();
                using (var zipStream = asm.GetManifestResourceStream("Payload"))
                {
                    if (zipStream == null)
                    {
                        throw new Exception("Application payload not found in installer binary.");
                    }

                    using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
                    {
                        int total = archive.Entries.Count;
                        int current = 0;

                        foreach (var entry in archive.Entries)
                        {
                            current++;
                            int percent = 30 + (int)((current / (float)total) * 35.0f);
                            SetProgress(percent, "Extracting " + entry.Name + "...");

                            string destinationPath = Path.Combine(targetDir, entry.FullName.Replace('/', '\\'));

                            if (string.IsNullOrEmpty(entry.Name))
                            {
                                Directory.CreateDirectory(destinationPath);
                            }
                            else
                            {
                                Directory.CreateDirectory(Path.GetDirectoryName(destinationPath));
                                entry.ExtractToFile(destinationPath, true);
                            }
                        }
                    }
                }

                Thread.Sleep(200);
                SetProgress(75, "Creating Desktop shortcut...");

                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string desktopShortcut = Path.Combine(desktopDir, "wavforms.lnk");
                string appExe = Path.Combine(targetDir, "wavforms.exe");
                string iconPath = Path.Combine(targetDir, "assets", "icon.ico");

                CreateWScriptShortcut(desktopShortcut, appExe, targetDir, iconPath, "wavforms — Real-time word-by-word synchronized lyrics");

                Thread.Sleep(200);
                SetProgress(85, "Creating Start Menu shortcut...");

                string startMenuDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                string startMenuShortcut = Path.Combine(startMenuDir, "wavforms.lnk");
                CreateWScriptShortcut(startMenuShortcut, appExe, targetDir, iconPath, "wavforms — Real-time word-by-word synchronized lyrics");

                Thread.Sleep(200);
                SetProgress(92, "Registering Windows application...");

                string uninstallerExe = Path.Combine(targetDir, "uninstall.exe");
                RegisterInWindowsPrograms(targetDir, appExe, iconPath, uninstallerExe);

                Thread.Sleep(300);
                SetProgress(100, "Installation complete! Launching...");
                isCompleted = true;

                Thread.Sleep(500);

                // Launch wavforms
                if (File.Exists(appExe))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = appExe,
                        WorkingDirectory = targetDir,
                        UseShellExecute = true
                    });
                }

                Thread.Sleep(600);
                this.Invoke((MethodInvoker)delegate { this.Close(); });
            }
            catch (Exception ex)
            {
                this.Invoke((MethodInvoker)delegate
                {
                    MessageBox.Show("Setup error: " + ex.Message, "wavforms Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    this.Close();
                });
            }
        }

        private static void KillExistingInstances(string targetDir)
        {
            try
            {
                foreach (var proc in Process.GetProcessesByName("wavforms"))
                {
                    try
                    {
                        if (proc.MainModule != null && proc.MainModule.FileName.StartsWith(targetDir, StringComparison.OrdinalIgnoreCase))
                        {
                            proc.Kill();
                            proc.WaitForExit(1000);
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }

        private static void CreateWScriptShortcut(string shortcutPath, string targetPath, string workingDir, string iconPath, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = workingDir;
                shortcut.Description = description;
                if (File.Exists(iconPath))
                {
                    shortcut.IconLocation = iconPath + ",0";
                }
                shortcut.Save();
            }
            catch { }
        }

        private static void RegisterInWindowsPrograms(string targetDir, string appExe, string iconPath, string uninstallerExe)
        {
            try
            {
                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\wavforms"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "wavforms");
                        key.SetValue("DisplayVersion", "1.0.0");
                        key.SetValue("Publisher", "wavforms");
                        key.SetValue("DisplayIcon", iconPath);
                        key.SetValue("InstallLocation", targetDir);
                        key.SetValue("UninstallString", "\"" + uninstallerExe + "\"");
                        key.SetValue("URLInfoAbout", "https://github.com/amaan/wavforms");
                        key.SetValue("EstimatedSize", 28000, RegistryValueKind.DWord);
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch { }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;

            // Background Fill
            using (var brush = new SolidBrush(Color.FromArgb(12, 12, 16)))
            {
                g.FillRectangle(brush, this.ClientRectangle);
            }

            // Sleek Outer Border
            using (var pen = new Pen(Color.FromArgb(39, 39, 42), 1.5f))
            {
                g.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
            }

            // Close button (top right)
            using (var closeFont = new Font("Segoe UI", 9, FontStyle.Regular))
            using (var closeBrush = new SolidBrush(Color.FromArgb(113, 113, 122)))
            {
                g.DrawString("✕", closeFont, closeBrush, Width - 28, 14);
            }

            // Draw Logo Emblem
            int logoSize = 64;
            int logoX = (Width - logoSize) / 2;
            int logoY = 40;

            // Squircle emblem frame
            using (var emblemBrush = new SolidBrush(Color.FromArgb(24, 24, 28)))
            using (var emblemBorder = new Pen(Color.FromArgb(50, 50, 56), 1.2f))
            {
                var emblemRect = new Rectangle(logoX, logoY, logoSize, logoSize);
                FillRoundedRectangle(g, emblemBrush, emblemRect, 18);
                DrawRoundedRectangle(g, emblemBorder, emblemRect, 18);

                if (logoImage != null)
                {
                    g.DrawImage(logoImage, new Rectangle(logoX + 8, logoY + 8, logoSize - 16, logoSize - 16));
                }
            }

            // Title: wavforms
            using (var titleFont = new Font("Segoe UI", 20, FontStyle.Bold))
            using (var titleBrush = new SolidBrush(Color.FromArgb(255, 255, 255)))
            {
                var titleFormat = new StringFormat { Alignment = StringAlignment.Center };
                g.DrawString("wavforms", titleFont, titleBrush, new RectangleF(0, logoY + logoSize + 14, Width, 36), titleFormat);
            }

            // Tagline
            using (var tagFont = new Font("Segoe UI", 10.5f, FontStyle.Regular))
            using (var tagBrush = new SolidBrush(Color.FromArgb(161, 161, 170)))
            {
                var tagFormat = new StringFormat { Alignment = StringAlignment.Center };
                g.DrawString("Word-by-word synchronized lyrics for Windows", tagFont, tagBrush, new RectangleF(0, logoY + logoSize + 48, Width, 24), tagFormat);
            }

            // Progress Bar Container
            int barWidth = Width - 96;
            int barHeight = 6;
            int barX = 48;
            int barY = 222;

            using (var barBgBrush = new SolidBrush(Color.FromArgb(30, 30, 36)))
            {
                var barBgRect = new Rectangle(barX, barY, barWidth, barHeight);
                FillRoundedRectangle(g, barBgBrush, barBgRect, 3);
            }

            // Active Progress Fill (Clean Platinum / Silver gradient)
            int fillWidth = Math.Max(6, (int)((barWidth * progressValue) / 100.0f));
            var fillRect = new Rectangle(barX, barY, fillWidth, barHeight);

            using (var fillBrush = new LinearGradientBrush(
                new Point(barX, barY),
                new Point(barX + barWidth, barY),
                Color.FromArgb(240, 240, 245),
                Color.FromArgb(200, 205, 220)))
            {
                FillRoundedRectangle(g, fillBrush, fillRect, 3);
            }

            // Status message
            using (var statusFont = new Font("Segoe UI", 9.5f, FontStyle.Regular))
            using (var statusBrush = new SolidBrush(Color.FromArgb(113, 113, 122)))
            {
                var statusFormat = new StringFormat { Alignment = StringAlignment.Center };
                g.DrawString(statusText, statusFont, statusBrush, new RectangleF(0, barY + 16, Width, 22), statusFormat);
            }

            // Footer
            using (var footFont = new Font("Segoe UI", 8.5f, FontStyle.Regular))
            using (var footBrush = new SolidBrush(Color.FromArgb(70, 70, 80)))
            {
                var footFormat = new StringFormat { Alignment = StringAlignment.Center };
                g.DrawString("v1.0.0 • Licensed under MIT", footFont, footBrush, new RectangleF(0, Height - 30, Width, 20), footFormat);
            }
        }

        protected override void OnMouseClick(MouseEventArgs e)
        {
            base.OnMouseClick(e);
            // Click on '✕' close button
            if (e.X >= Width - 36 && e.X <= Width - 10 && e.Y >= 10 && e.Y <= 30)
            {
                this.Close();
            }
        }

        private static void FillRoundedRectangle(Graphics g, Brush brush, Rectangle bounds, int cornerRadius)
        {
            using (GraphicsPath path = RoundedRect(bounds, cornerRadius))
            {
                g.FillPath(brush, path);
            }
        }

        private static void DrawRoundedRectangle(Graphics g, Pen pen, Rectangle bounds, int cornerRadius)
        {
            using (GraphicsPath path = RoundedRect(bounds, cornerRadius))
            {
                g.DrawPath(pen, path);
            }
        }

        private static GraphicsPath RoundedRect(Rectangle bounds, int radius)
        {
            int diameter = radius * 2;
            Size size = new Size(diameter, diameter);
            Rectangle arc = new Rectangle(bounds.Location, size);
            GraphicsPath path = new GraphicsPath();

            if (radius == 0)
            {
                path.AddRectangle(bounds);
                return path;
            }

            // top left
            path.AddArc(arc, 180, 90);

            // top right
            arc.X = bounds.Right - diameter;
            path.AddArc(arc, 270, 90);

            // bottom right
            arc.Y = bounds.Bottom - diameter;
            path.AddArc(arc, 0, 90);

            // bottom left
            arc.X = bounds.Left;
            path.AddArc(arc, 90, 90);

            path.CloseFigure();
            return path;
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }
}

