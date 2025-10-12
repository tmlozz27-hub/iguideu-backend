# 🪟 PS1 - SERVER (local)
$host.ui.RawUI.WindowTitle = 'PS1 - SERVER (local)'

# Ir al backend
cd C:\dev\iguideu-backend

# 1) Liberar puerto 4020 por las dudas
$p = Get-NetTCPConnection -State Listen -LocalPort 4020 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p) {
  try { Stop-Process -Id $p.OwningProcess -Force } catch {}
  Start-Sleep -Milliseconds 300
}

# 2) Entorno + Node 20
$env:PORT = '4020'
$NVM_HOME = if ($env:NVM_HOME) { $env:NVM_HOME } else { Join-Path $env:APPDATA 'nvm' }
$NODE_EXE = Join-Path $NVM_HOME 'v20.12.2\node.exe'

# 3) (opcional) deps base
# npm install stripe dotenv

# 4) Levantar server
& $NODE_EXE .\server.js

