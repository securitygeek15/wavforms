# Publish GitHub Release Script
$ErrorActionPreference = "Stop"

$cred = (echo "protocol=https`nhost=github.com" | git credential fill)
$token = ($cred | Where-Object { $_ -match "^password=(.*)$" } | ForEach-Object { $matches[1] })

if ([string]::IsNullOrWhiteSpace($token)) {
    throw "GitHub token not found from git credential."
}

$repo = "securitygeek15/wavforms"
$tag = "v1.0.0"

$headers = @{
    "Authorization" = "token $token"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "wavforms-publisher"
}

$releaseBody = @"
## wavforms v1.0.0

Word-by-word real-time synchronized lyrics & MilkDrop 3 WebGL visualizer on Windows.
Inspired by the minimalist luxury of Verci and the legendary visuals of Ryan Geiss's MilkDrop.

### Downloads
- **wavforms-Setup.exe** (9.40 MB) — Aesthetic 1-Click Windows Installer (installs to `%LOCALAPPDATA%\Programs\wavforms` with Desktop and Start Menu shortcuts)
- **wavforms-v1.0.0-windows-x64.zip** (8.91 MB) — Portable zero-install edition

### Highlights
- **MilkDrop 3 Audio Visualizer Engine**: Powered by WebGL2 Butterchurn with 367 classic and crazy MilkDrop presets.
- **Iconic Visuals & Artists**: Martin, Flexi, Ryan Geiss, Rovastar, Zylot, Unchained, Aderrasi, $$$ Royal, and more.
- **Top Navigation Audio Visuals Tab**: Seamlessly toggle between Visual, Ship, and MilkDrop Audio Visuals.
- **Smooth Preset Crossfade**: 2.7s seamless blending between presets with auto-cycle and random shuffle.
- **Floating Verci Lyrics**: Minimalist frosted glass lyrics pill floating cleanly over MilkDrop.
- **Word-by-Word Synchronized Lyrics**: Powered by NetEase YRC & LRCLIB fallback.
- **Discord Rich Presence Live**: Synchronized with active song and word.
"@

$payloadJson = (@{
    tag_name = $tag
    target_commitish = "main"
    name = "wavforms v1.0.0"
    body = $releaseBody
    draft = $false
    prerelease = $false
} | ConvertTo-Json)

$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)

# Check if release already exists, or create a new one
$release = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/tags/$tag" -Method Get -Headers $headers
    Write-Host "[OK] Found existing release $tag, updating assets..." -ForegroundColor Green
} catch {
    Write-Host "[*] Creating GitHub Release $tag..." -ForegroundColor Cyan
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases" -Method Post -Headers $headers -Body $bodyBytes -ContentType "application/json; charset=utf-8"
    Write-Host "[OK] Release created: $($release.html_url)" -ForegroundColor Green
}
$uploadUrlTemplate = $release.upload_url

# Upload assets
$assets = @(
    @{ Path = "dist\wavforms-Setup.exe"; ContentType = "application/octet-stream"; Name = "wavforms-Setup.exe" },
    @{ Path = "dist\wavforms-Setup-v1.0.0.exe"; ContentType = "application/octet-stream"; Name = "wavforms-Setup-v1.0.0.exe" },
    @{ Path = "dist\wavforms-v1.0.0-windows-x64.zip"; ContentType = "application/zip"; Name = "wavforms-v1.0.0-windows-x64.zip" },
    @{ Path = "assets\wavformsshowcase.mp4"; ContentType = "video/mp4"; Name = "wavformsshowcase.mp4" }
)

foreach ($asset in $assets) {
    if (Test-Path $asset.Path) {
        $name = $asset.Name
        Write-Host "[*] Uploading $name..." -ForegroundColor Gray
        $uploadUrl = $uploadUrlTemplate.Replace('{?name,label}', "?name=$name")
        $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $asset.Path).Path)
        
        $uploadHeaders = @{
            "Authorization" = "token $token"
            "Accept" = "application/vnd.github.v3+json"
            "User-Agent" = "wavforms-publisher"
            "Content-Type" = $asset.ContentType
        }

        # Delete existing asset if it exists
        $existing = $release.assets | Where-Object { $_.name -eq $name }
        if ($existing) {
            Invoke-RestMethod -Uri $existing.url -Method Delete -Headers @{ "Authorization" = "token $token"; "User-Agent" = "wavforms-publisher" } -ErrorAction SilentlyContinue
        }

        $res = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $uploadHeaders -Body $fileBytes
        Write-Host "    [OK] Uploaded $name ($(($fileBytes.Length / 1MB).ToString('0.00')) MB)" -ForegroundColor Green
    }
}

Write-Host "`n[OK] All release assets uploaded successfully!" -ForegroundColor Cyan
Write-Host "    Release URL: $($release.html_url)" -ForegroundColor White
