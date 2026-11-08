# Launch native wavforms desktop app (100% self-contained, zero localhost / node dependencies)
$nativeApp = Join-Path $PSScriptRoot "wavforms.exe"
if (Test-Path $nativeApp) {
    Start-Process -FilePath $nativeApp
} else {
    Write-Host "wavforms.exe not found in $PSScriptRoot" -ForegroundColor Red
}
