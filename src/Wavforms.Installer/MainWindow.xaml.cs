using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

namespace Wavforms.Installer;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        MouseDown += (s, e) => { if (e.ChangedButton == MouseButton.Left) DragMove(); };
        Loaded += MainWindow_Loaded;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            // Load Logo
            string currentDir = AppDomain.CurrentDomain.BaseDirectory;
            string logoPath = Path.Combine(currentDir, "assets", "logo.png");
            if (File.Exists(logoPath))
            {
                AppLogo.Source = new BitmapImage(new Uri(logoPath));
            }
        }
        catch { }

        await RunInstallationAsync();
    }

    private async Task RunInstallationAsync()
    {
        string targetDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "wavforms");
        string sourceDir = AppDomain.CurrentDomain.BaseDirectory;

        try
        {
            UpdateProgress(15, "Preparing destination directory...");
            await Task.Delay(250);

            if (!Directory.Exists(targetDir))
            {
                Directory.CreateDirectory(targetDir);
            }

            // 1. Copy Application Files
            UpdateProgress(35, "Installing application files...");
            string[] itemsToCopy = new[] { "public", "assets", "server.js", "package.json", "run.bat", "run.ps1", "wavforms.vbs", "wavforms.exe" };

            foreach (var item in itemsToCopy)
            {
                string src = Path.Combine(sourceDir, item);
                string dst = Path.Combine(targetDir, item);

                if (Directory.Exists(src))
                {
                    CopyDirectory(src, dst);
                }
                else if (File.Exists(src))
                {
                    File.Copy(src, dst, true);
                }
            }

            await Task.Delay(300);

            // 2. Create Desktop Shortcut
            UpdateProgress(60, "Creating Desktop shortcut...");
            string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string desktopShortcut = Path.Combine(desktopDir, "wavforms.lnk");
            string appExe = Path.Combine(targetDir, "wavforms.exe");
            string appIcon = Path.Combine(targetDir, "assets", "icon.ico");

            CreateShortcut(desktopShortcut, appExe, targetDir, appIcon, "wavforms — Real-time word-by-word synchronized lyrics");
            await Task.Delay(200);

            // 3. Create Start Menu Shortcut
            UpdateProgress(80, "Adding to Windows Start Menu...");
            string startMenuDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            string startShortcut = Path.Combine(startMenuDir, "wavforms.lnk");
            CreateShortcut(startShortcut, appExe, targetDir, appIcon, "wavforms — Real-time word-by-word synchronized lyrics");
            await Task.Delay(200);

            // 4. Create Clean Uninstaller
            string uninstallerScript = Path.Combine(targetDir, "Uninstall.bat");
            File.WriteAllText(uninstallerScript, $@"@echo off
taskkill /F /IM node.exe >nul 2>&1
del ""{desktopShortcut}"" >nul 2>&1
del ""{startShortcut}"" >nul 2>&1
reg delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\wavforms"" /f >nul 2>&1
cd %TEMP%
rmdir /S /Q ""{targetDir}"" >nul 2>&1
echo wavforms uninstalled successfully.
");

            // 5. Register in Windows Settings (Apps & Features)
            UpdateProgress(90, "Registering in Windows Settings...");
            RegisterUninstall(targetDir, appExe, appIcon, uninstallerScript);
            await Task.Delay(200);

            // 6. Complete & Launch
            UpdateProgress(100, "Installation complete! Launching...");
            await Task.Delay(400);

            if (File.Exists(appExe))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = appExe,
                    WorkingDirectory = targetDir,
                    UseShellExecute = true
                });
            }

            await Task.Delay(500);
            Close();
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Error: {ex.Message}";
            MessageBox.Show($"Installation failed: {ex.Message}", "wavforms Setup", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void UpdateProgress(int percent, string message)
    {
        Dispatcher.Invoke(() =>
        {
            InstallProgress.Value = percent;
            StatusText.Text = message;
        });
    }

    private static void CopyDirectory(string sourceDir, string destDir)
    {
        Directory.CreateDirectory(destDir);
        foreach (var file in Directory.GetFiles(sourceDir))
        {
            string destFile = Path.Combine(destDir, Path.GetFileName(file));
            File.Copy(file, destFile, true);
        }
        foreach (var sub in Directory.GetDirectories(sourceDir))
        {
            string destSub = Path.Combine(destDir, Path.GetFileName(sub));
            CopyDirectory(sub, destSub);
        }
    }

    private static void CreateShortcut(string shortcutPath, string targetPath, string workingDir, string iconPath, string description)
    {
        try
        {
            Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) return;
            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = targetPath;
            shortcut.WorkingDirectory = workingDir;
            shortcut.Description = description;
            if (File.Exists(iconPath))
            {
                shortcut.IconLocation = $"{iconPath},0";
            }
            shortcut.Save();
        }
        catch { }
    }

    private static void RegisterUninstall(string installDir, string appExe, string appIcon, string uninstallerPath)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\wavforms");
            if (key != null)
            {
                key.SetValue("DisplayName", "wavforms");
                key.SetValue("DisplayVersion", "1.0.0");
                key.SetValue("Publisher", "wavforms");
                key.SetValue("DisplayIcon", appIcon);
                key.SetValue("InstallLocation", installDir);
                key.SetValue("UninstallString", $"\"{uninstallerPath}\"");
                key.SetValue("EstimatedSize", 18500, RegistryValueKind.DWord);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }
        catch { }
    }
}
