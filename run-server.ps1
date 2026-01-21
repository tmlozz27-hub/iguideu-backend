$ErrorActionPreference = "Continue"

$ROOT = "C:\Users\Tom\Desktop\backend-iguideu-24"
$LOG  = Join-Path $ROOT "server-run.txt"

Set-Location $ROOT

# limpiar log
if (Test-Path $LOG) { Remove-Item $LOG -Force }

# variables
$env:HOST="0.0.0.0"
$env:PORT="4020"

"=== START $(Get-Date -Format s) ===" | Out-File -FilePath $LOG -Encoding utf8 -Append
"PWD=$(Get-Location)" | Out-File -FilePath $LOG -Encoding utf8 -Append
"NODE=$(node -v)" | Out-File -FilePath $LOG -Encoding utf8 -Append

# arrancar y capturar TODO (stdout + stderr)
try {
  node ".\src\server.js" *>> $LOG
} catch {
  "=== CRASH $(Get-Date -Format s) ===" | Out-File -FilePath $LOG -Encoding utf8 -Append
  $_ | Out-String | Out-File -FilePath $LOG -Encoding utf8 -Append
}

"=== END $(Get-Date -Format s) ===" | Out-File -FilePath $LOG -Encoding utf8 -Append
