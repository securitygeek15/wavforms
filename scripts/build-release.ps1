# wavforms Release & Installer Builder
$ErrorActionPreference = "Stop"

$version = "1.0.0"
$distDir = "dist"
$stageDir = "$distDir\staging"
$portableZip = "$distDir\wavforms-v$version-windows-x64.zip"
$installerExe = "$distDir\wavforms-Setup-v$version.exe"

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Building wavforms v$version GitHub Release & Installer...      " -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# 1. Clean Staging
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

# 2. Copy Payload
Write-Host "[*] Gathering application payload..." -ForegroundColor Gray
$copyItems = @("public", "assets", "server.js", "package.json", "run.bat", "run.ps1", "wavforms.vbs")
foreach ($item in $copyItems) {
    Copy-Item -Path $item -Destination $stageDir -Recurse -Force
}
Copy-Item -Path "installer\install.ps1" -Destination $stageDir -Force
Copy-Item -Path "installer\setup.bat" -Destination $stageDir -Force

# 3. Build Portable ZIP
Write-Host "[*] Creating portable ZIP: $portableZip..." -ForegroundColor Gray
if (Test-Path $portableZip) { Remove-Item -Force $portableZip }
& "C:\Program Files\7-Zip\7z.exe" a -tzip -mx=9 $portableZip "$stageDir\*" | Out-Null
Write-Host "[✓] Portable ZIP created: $((Get-Item $portableZip).Length / 1MB | ForEach-Object { '{0:N2} MB' -f $_ })" -ForegroundColor Green

# 4. Build Standalone SFX Windows Installer
Write-Host "[*] Compiling Standalone Windows Setup Installer: $installerExe..." -ForegroundColor Gray
$sfxModule = "C:\Program Files\7-Zip\7z.sfx"
$sfxArchive = "$distDir\app_temp.7z"
$sfxConfig = "$distDir\sfx_config.txt"

# Archive payload as 7z
if (Test-Path $sfxArchive) { Remove-Item -Force $sfxArchive }
& "C:\Program Files\7-Zip\7z.exe" a -m0=lzma2 -mx=9 $sfxArchive "$stageDir\*" | Out-Null

# SFX Configuration: Extracts to temp and silently launches setup.bat
@"
;!@Install@!UTF-8!
Title="wavforms Setup"
BeginPrompt="Do you want to install wavforms (Real-time word-by-word lyrics)?"
RunProgram="setup.bat"
;!@InstallEnd@!
"@ | Set-Content -Path $sfxConfig -Encoding UTF8

# Combine 7z.sfx + config + archive -> Setup.exe
$sfxBytes = [System.IO.File]::ReadAllBytes($sfxModule)
$configBytes = [System.IO.File]::ReadAllBytes($sfxConfig)
$archiveBytes = [System.IO.File]::ReadAllBytes($sfxArchive)

$exeStream = [System.IO.File]::Create($installerExe)
$exeStream.Write($sfxBytes, 0, $sfxBytes.Length)
$exeStream.Write($configBytes, 0, $configBytes.Length)
$exeStream.Write($archiveBytes, 0, $archiveBytes.Length)
$exeStream.Close()

Remove-Item -Force $sfxArchive, $sfxConfig
Remove-Item -Recurse -Force $stageDir

Write-Host "[✓] Windows Setup Installer created: $installerExe ($((Get-Item $installerExe).Length / 1MB | ForEach-Object { '{0:N2} MB' -f $_ }))" -ForegroundColor Green
Write-Host "`n[✓] All Release Assets Built Successfully!" -ForegroundColor Cyan
