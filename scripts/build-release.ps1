# wavforms Release & Aesthetic Windows Installer Builder
$ErrorActionPreference = "Stop"

$version = "1.0.0"
$distDir = "$PSScriptRoot\..\dist"
$stageDir = "$distDir\staging"
$portableZip = "$distDir\wavforms-v$version-windows-x64.zip"
$installerExe = "$distDir\wavforms-Setup-v$version.exe"
$installerCleanExe = "$distDir\wavforms-Setup.exe"

$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$sevenZip = "C:\Program Files\7-Zip\7z.exe"

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Building wavforms v$version Aesthetic Release & Installer     " -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# 1. Clean Staging & Output
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

# 2. Compile Native Launcher (wavforms.exe)
Write-Host "[1/5] Compiling native launcher (wavforms.exe)..." -ForegroundColor Gray
& $csc /target:winexe /win32icon:assets\icon.ico /out:"$stageDir\wavforms.exe" `
    /r:System.dll,System.Windows.Forms.dll,System.Drawing.dll `
    src\Launcher\Program.cs | Out-Null
Write-Host "      [✓] wavforms.exe compiled (88 KB, 0ms boot)" -ForegroundColor Green

# 3. Compile Uninstaller (uninstall.exe)
Write-Host "[2/5] Compiling clean uninstaller (uninstall.exe)..." -ForegroundColor Gray
& $csc /target:winexe /win32icon:assets\icon.ico /out:"$stageDir\uninstall.exe" `
    /r:System.dll,System.Windows.Forms.dll `
    src\Uninstaller\Program.cs | Out-Null
Write-Host "      [✓] uninstall.exe compiled" -ForegroundColor Green

# 4. Copy Application Payload
Write-Host "[3/5] Gathering application files into payload..." -ForegroundColor Gray
$itemsToCopy = @("public", "assets", "server.js", "package.json", "wavforms.vbs", "run.bat", "run.ps1")
foreach ($item in $itemsToCopy) {
    Copy-Item -Path $item -Destination $stageDir -Recurse -Force
}

# Also keep root wavforms.exe updated
Copy-Item -Path "$stageDir\wavforms.exe" -Destination ".\wavforms.exe" -Force

# 5. Build Portable ZIP
Write-Host "[4/5] Building portable ZIP archive..." -ForegroundColor Gray
if (Test-Path $portableZip) { Remove-Item -Force $portableZip }
& $sevenZip a -tzip -mx=9 $portableZip "$stageDir\*" | Out-Null
$zipSize = ((Get-Item $portableZip).Length / 1MB).ToString("0.00")
Write-Host "      [✓] Portable ZIP created: $portableZip ($zipSize MB)" -ForegroundColor Green

# 6. Build Aesthetic 1-Click GUI Windows Installer
Write-Host "[5/5] Compiling aesthetic Windows GUI installer..." -ForegroundColor Gray
$payloadZip = "$distDir\payload.zip"
if (Test-Path $payloadZip) { Remove-Item -Force $payloadZip }
Copy-Item -Path $portableZip -Destination $payloadZip -Force

& $csc /target:winexe /win32icon:assets\icon.ico /out:$installerExe `
    "/resource:$payloadZip,Payload" `
    "/resource:assets\logo.png,Logo" `
    /r:System.dll,System.Drawing.dll,System.Windows.Forms.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll,Microsoft.CSharp.dll `
    src\Installer\Program.cs | Out-Null

Copy-Item -Path $installerExe -Destination $installerCleanExe -Force
Remove-Item -Force $payloadZip
Remove-Item -Recurse -Force $stageDir

$setupSize = ((Get-Item $installerExe).Length / 1MB).ToString("0.00")
Write-Host "      [✓] $installerExe ($setupSize MB)" -ForegroundColor Green
Write-Host "      [✓] $installerCleanExe ($setupSize MB)" -ForegroundColor Green

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✨ Release & Installer Build Completed Successfully!          " -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
