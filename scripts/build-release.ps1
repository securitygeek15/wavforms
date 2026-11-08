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

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Building wavforms v$version Native Desktop & Installer        " -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

# 1. Clean Staging & Output
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

# 2. Publish Native Desktop Host (wavforms.exe)
Write-Host "[1/5] Compiling native desktop host (wavforms.exe)..." -ForegroundColor Gray
dotnet publish "$PSScriptRoot\..\src\Wavforms.Launcher\Wavforms.Launcher.csproj" -c Release -r win-x64 --self-contained false -o "$stageDir" | Out-Null
Write-Host "      [OK] wavforms.exe native desktop application published" -ForegroundColor Green

# 3. Compile Uninstaller (uninstall.exe)
Write-Host "[2/5] Compiling clean uninstaller (uninstall.exe)..." -ForegroundColor Gray
& $csc /target:winexe /platform:anycpu /win32icon:assets\icon.ico /out:"$stageDir\uninstall.exe" `
    /r:System.dll,System.Windows.Forms.dll `
    src\Uninstaller\Program.cs | Out-Null
Write-Host "      [OK] uninstall.exe compiled" -ForegroundColor Green

# 4. Copy Application Payload
Write-Host "[3/5] Gathering application files into payload..." -ForegroundColor Gray
$itemsToCopy = @("public", "assets", "server.js", "package.json", "wavforms.vbs", "run.bat", "run.ps1")
foreach ($item in $itemsToCopy) {
    Copy-Item -Path "$PSScriptRoot\..\$item" -Destination $stageDir -Recurse -Force
}

# Remove large media demo files from installer payload
if (Test-Path "$stageDir\assets\wavformsshowcase.mp4") {
    Remove-Item -Force "$stageDir\assets\wavformsshowcase.mp4"
}
if (Test-Path "$stageDir\assets\showcase.gif") {
    Remove-Item -Force "$stageDir\assets\showcase.gif"
}
if (Test-Path "$stageDir\public\assets\wavformsshowcase.mp4") {
    Remove-Item -Force "$stageDir\public\assets\wavformsshowcase.mp4"
}
if (Test-Path "$stageDir\public\assets\showcase.gif") {
    Remove-Item -Force "$stageDir\public\assets\showcase.gif"
}

# Update root wavforms.exe and native host files
Copy-Item -Path "$stageDir\wavforms.exe" -Destination "$PSScriptRoot\..\wavforms.exe" -Force
Copy-Item -Path "$stageDir\wavforms.dll" -Destination "$PSScriptRoot\..\wavforms.dll" -Force
Copy-Item -Path "$stageDir\wavforms.runtimeconfig.json" -Destination "$PSScriptRoot\..\wavforms.runtimeconfig.json" -Force
Copy-Item -Path "$stageDir\wavforms.deps.json" -Destination "$PSScriptRoot\..\wavforms.deps.json" -Force
Copy-Item -Path "$stageDir\Wavforms.Core.dll" -Destination "$PSScriptRoot\..\Wavforms.Core.dll" -Force
Copy-Item -Path "$stageDir\Microsoft.Web.WebView2.*" -Destination "$PSScriptRoot\.." -Force
Copy-Item -Path "$stageDir\WebView2Loader.dll" -Destination "$PSScriptRoot\..\WebView2Loader.dll" -Force
if (Test-Path "$stageDir\runtimes") {
    Copy-Item -Path "$stageDir\runtimes" -Destination "$PSScriptRoot\.." -Recurse -Force
}

# 5. Build Portable ZIP
Write-Host "[4/5] Building portable ZIP archive..." -ForegroundColor Gray
if (Test-Path $portableZip) { Remove-Item -Force $portableZip }
& $sevenZip a -tzip -mx=9 $portableZip "$stageDir\*" | Out-Null
$zipSize = ((Get-Item $portableZip).Length / 1MB).ToString("0.00")
Write-Host "      [OK] Portable ZIP created: $portableZip ($zipSize MB)" -ForegroundColor Green

# 6. Build Aesthetic 1-Click GUI Windows Installer
Write-Host "[5/5] Compiling aesthetic Windows GUI installer..." -ForegroundColor Gray
$payloadZip = "$distDir\payload.zip"
if (Test-Path $payloadZip) { Remove-Item -Force $payloadZip }
Copy-Item -Path $portableZip -Destination $payloadZip -Force

& $csc /target:winexe /platform:anycpu /win32icon:assets\icon.ico /out:$installerExe `
    "/resource:$payloadZip,Payload" `
    "/resource:assets\logo.png,Logo" `
    /r:System.dll,System.Drawing.dll,System.Windows.Forms.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll,Microsoft.CSharp.dll `
    src\Installer\Program.cs | Out-Null

Copy-Item -Path $installerExe -Destination $installerCleanExe -Force
Remove-Item -Force $payloadZip
Remove-Item -Recurse -Force $stageDir

$setupSize = ((Get-Item $installerExe).Length / 1MB).ToString("0.00")
Write-Host "      [OK] $installerExe ($setupSize MB)" -ForegroundColor Green
Write-Host "      [OK] $installerCleanExe ($setupSize MB)" -ForegroundColor Green

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  Release & Installer Build Completed Successfully!             " -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan
