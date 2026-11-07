using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Wavforms.Uninstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            var confirm = MessageBox.Show(
                "Are you sure you want to completely uninstall wavforms?",
                "wavforms Uninstall",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);

            if (confirm != DialogResult.Yes) return;

            try
            {
                // 1. Remove Desktop Shortcut
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string desktopLnk = Path.Combine(desktop, "wavforms.lnk");
                if (File.Exists(desktopLnk)) File.Delete(desktopLnk);

                // 2. Remove Start Menu Shortcut
                string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                string startMenuLnk = Path.Combine(startMenu, "wavforms.lnk");
                if (File.Exists(startMenuLnk)) File.Delete(startMenuLnk);

                // 3. Remove Registry Uninstall Key
                try
                {
                    Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\wavforms", false);
                }
                catch { }

                // 4. Self-deleting batch script for the install directory
                string installDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
                string tempBat = Path.Combine(Path.GetTempPath(), "wavforms_cleanup.bat");

                File.WriteAllText(tempBat, "@echo off\r\n" +
                    "ping 127.0.0.1 -n 2 > nul\r\n" +
                    "rmdir /s /q \"" + installDir + "\"\r\n" +
                    "del \"%~f0\"\r\n");

                Process.Start(new ProcessStartInfo
                {
                    FileName = tempBat,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = true
                });

                MessageBox.Show(
                    "wavforms has been successfully uninstalled from your computer.",
                    "wavforms Uninstall",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Uninstall notice: " + ex.Message, "wavforms Uninstall", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }
}
