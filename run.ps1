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
    Start-Sleep -Milliseconds 800
}

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$url = "http://localhost:3456"

if (Test-Path $edgePath) {
    Start-Process -FilePath $edgePath -ArgumentList "--app=$url", "--window-size=1180,780"
} elseif (Test-Path $chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList "--app=$url", "--window-size=1180,780"
} else {
    Start-Process $url
}
