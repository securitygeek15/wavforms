# Check if server is already running
$running = $false
try {
    $res = Invoke-RestMethod -Uri "http://localhost:3456/api/ping" -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($res -and $res.app -eq "wavforms") {
        $running = $true
    }
} catch { }

if (-not $running) {
    Start-Process -FilePath "node" -ArgumentList "server.js" -WindowStyle Hidden
    Start-Sleep -Milliseconds 600
}

# Launch dedicated native desktop app
$nativeApp = Join-Path $PSScriptRoot "wavforms.exe"
if (Test-Path $nativeApp) {
    Start-Process -FilePath $nativeApp
} else {
    Start-Process "http://localhost:3456"
}
