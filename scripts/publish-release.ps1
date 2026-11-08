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

Word-by-word real-time synchronized lyrics on Windows.
Inspired by the minimalist luxury of Verci.

### Downloads
- **wavforms-Setup.exe** (1.53 MB) — Aesthetic 1-Click Windows Installer (installs to `%LOCALAPPDATA%\Programs\wavforms` with Desktop and Start Menu shortcuts)
- **wavforms-v1.0.0-windows-x64.zip** (1.05 MB) — Portable zero-install edition

### Highlights
- True word-by-word synchronized lyrics powered by NetEase YRC & LRCLIB fallback
- Single-line active spotlight with fluid liquid drop transitions
- Two core aesthetic display styles: **Ship** (3D perspective drift) and **Visual** (kinetic typography + dynamic accents)
- On-the-fly vocal sync fine-tuning using `[` and `]` (±100ms)
- Drag-and-drop local music files and custom `.lrc`/`.yrc` files
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
    @{ Path = "dist\wavforms-v1.0.0-windows-x64.zip"; ContentType = "application/zip"; Name = "wavforms-v1.0.0-windows-x64.zip" }
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
