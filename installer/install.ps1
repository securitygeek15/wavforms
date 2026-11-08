# wavforms Aesthetic Windows Installer Script
param(
    [string]$TargetDir = "$env:LOCALAPPDATA\Programs\wavforms"
)

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Installing wavforms — Real-time word-by-word lyrics...        " -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# 1. Create Target Directory
if (!(Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$sourceDir = $PSScriptRoot

# 2. Copy Files
Write-Host "[*] Copying application files..." -ForegroundColor Gray
$itemsToCopy = @("public", "assets", "server.js", "package.json", "run.bat", "run.ps1", "wavforms.vbs", "wavforms.exe", "uninstall.exe")
foreach ($item in $itemsToCopy) {
    $src = Join-Path $sourceDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $TargetDir -Recurse -Force
    }
}

# 3. Create Shortcuts with High-Res Icon
$wscript = New-Object -ComObject WScript.Shell
$appExe = Join-Path $TargetDir "wavforms.exe"
$icoPath = Join-Path $TargetDir "assets\icon.ico"

# Desktop Shortcut
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcut = $wscript.CreateShortcut((Join-Path $desktopPath "wavforms.lnk"))
$desktopShortcut.TargetPath = $appExe
$desktopShortcut.WorkingDirectory = $TargetDir
$desktopShortcut.IconLocation = "$icoPath,0"
$desktopShortcut.Description = "wavforms — Real-time word-by-word synchronized lyrics"
$desktopShortcut.Save()
Write-Host "[✓] Created Desktop shortcut" -ForegroundColor Green

# Start Menu Shortcut
$startMenuPath = [Environment]::GetFolderPath("Programs")
$startMenuShortcut = $wscript.CreateShortcut((Join-Path $startMenuPath "wavforms.lnk"))
$startMenuShortcut.TargetPath = $appExe
$startMenuShortcut.WorkingDirectory = $TargetDir
$startMenuShortcut.IconLocation = "$icoPath,0"
$startMenuShortcut.Description = "wavforms — Real-time word-by-word synchronized lyrics"
$startMenuShortcut.Save()
Write-Host "[✓] Created Start Menu shortcut" -ForegroundColor Green

# 4. Register in Windows Settings (Apps & Features)
try {
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\wavforms"
    if (!(Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
    Set-ItemProperty -Path $regPath -Name "DisplayName" -Value "wavforms"
    Set-ItemProperty -Path $regPath -Name "DisplayVersion" -Value "1.0.0"
    Set-ItemProperty -Path $regPath -Name "Publisher" -Value "wavforms"
    Set-ItemProperty -Path $regPath -Name "DisplayIcon" -Value $icoPath
    Set-ItemProperty -Path $regPath -Name "InstallLocation" -Value $TargetDir
    Set-ItemProperty -Path $regPath -Name "UninstallString" -Value "`"$(Join-Path $TargetDir 'uninstall.exe')`""
    Set-ItemProperty -Path $regPath -Name "EstimatedSize" -Value 28000
    Set-ItemProperty -Path $regPath -Name "NoModify" -Value 1
    Set-ItemProperty -Path $regPath -Name "NoRepair" -Value 1
    Write-Host "[✓] Registered in Windows Apps & Features" -ForegroundColor Green
} catch { }

Write-Host "`n[✓] wavforms installation complete! Launching..." -ForegroundColor White
Start-Process $appExe -WorkingDirectory $TargetDir

