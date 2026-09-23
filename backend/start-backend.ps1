# Rafiqi backend autostart (ASCII-only file: no literal non-ASCII chars anywhere,
# so it survives any code page. Backend dir is derived from this script's own
# location instead of a hard-coded path.)
# Launched at logon via HKCU Run key "RafiqiBackend".
$env:NODE_ENV = 'production'
$env:RATE_LIMIT_MAX = '1000000'
Set-Location -LiteralPath $PSScriptRoot
$logDir = Join-Path $env:TEMP 'opencode'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
& node 'src\index.js' >> (Join-Path $logDir 'backend-out.log') 2>> (Join-Path $logDir 'backend-err.log')
