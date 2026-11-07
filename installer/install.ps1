# wavforms Aesthetic Windows Installer Script
param(
    [string]$TargetDir = "$env:LOCALAPPDATA\wavforms"
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
$itemsToCopy = @("public", "assets", "server.js", "package.json", "run.bat", "run.ps1", "wavforms.vbs")
foreach ($item in $itemsToCopy) {
    $src = Join-Path $sourceDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $TargetDir -Recurse -Force
    }
}

# 3. Create Shortcuts with High-Res Icon
$wscript = New-Object -ComObject WScript.Shell
$vbsPath = Join-Path $TargetDir "wavforms.vbs"
$icoPath = Join-Path $TargetDir "assets\icon.ico"

# Desktop Shortcut
$desktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcut = $wscript.CreateShortcut((Join-Path $desktopPath "wavforms.lnk"))
$desktopShortcut.TargetPath = "wscript.exe"
$desktopShortcut.Arguments = "`"$vbsPath`""
$desktopShortcut.WorkingDirectory = $TargetDir
$desktopShortcut.IconLocation = "$icoPath,0"
$desktopShortcut.Description = "wavforms — Real-time word-by-word synchronized lyrics"
$desktopShortcut.Save()
Write-Host "[✓] Created Desktop shortcut" -ForegroundColor Green

# Start Menu Shortcut
$startMenuPath = [Environment]::GetFolderPath("Programs")
$startMenuShortcut = $wscript.CreateShortcut((Join-Path $startMenuPath "wavforms.lnk"))
$startMenuShortcut.TargetPath = "wscript.exe"
$startMenuShortcut.Arguments = "`"$vbsPath`""
$startMenuShortcut.WorkingDirectory = $TargetDir
$startMenuShortcut.IconLocation = "$icoPath,0"
$startMenuShortcut.Description = "wavforms — Real-time word-by-word synchronized lyrics"
$startMenuShortcut.Save()
Write-Host "[✓] Created Start Menu shortcut" -ForegroundColor Green

Write-Host "`n[✓] wavforms installation complete! Launching..." -ForegroundColor White
Start-Process "wscript.exe" -ArgumentList "`"$vbsPath`"" -WorkingDirectory $TargetDir
