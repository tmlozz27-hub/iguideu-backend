# --- run-iguideu9.ps1 ---
$ErrorActionPreference = "Stop"

# Puerto
$env:PORT = '4020'

# Libera el puerto si quedó ocupado
$p = Get-NetTCPConnection -State Listen -LocalPort 4020 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p) {
  try { Stop-Process -Id $p.OwningProcess -Force } catch {}
  Start-Sleep -Milliseconds 300
}

# Node 20.12.2 por NVM
$NVM_HOME = if ($env:NVM_HOME) { $env:NVM_HOME } else { Join-Path $env:APPDATA 'nvm' }
$NODE_EXE = Join-Path $NVM_HOME 'v20.12.2\node.exe'

# Corre el server
& $NODE_EXE .\server.js
