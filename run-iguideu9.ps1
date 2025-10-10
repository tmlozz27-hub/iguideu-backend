param()

$proj = "C:\Users\Tom\Desktop\backend-iguideu-9"
$base = "http://127.0.0.1:4020"

# SERVER
Start-Process powershell.exe -WorkingDirectory $proj -ArgumentList @(
  '-NoExit','-Command',
  @"
`$host.ui.RawUI.WindowTitle='SERVER - iguideu9';
nvm on | Out-Null; nvm use 20.12.2 | Out-Null;
`$env:PORT='4020';
`$NVM_HOME = if (`$env:NVM_HOME) { `$env:NVM_HOME } else { Join-Path `$env:APPDATA 'nvm' };
`$NODE_EXE = Join-Path `$NVM_HOME 'v20.12.2\node.exe';
& `$NODE_EXE .\server.js
"@
)

# CLIENT
Start-Process powershell.exe -WorkingDirectory $proj -ArgumentList @(
  '-NoExit','-Command',
  @"
`$host.ui.RawUI.WindowTitle='CLIENT - iguideu9';
`$BASE='$base';
Write-Host '-> GET /api/health' -ForegroundColor Cyan;
try { Invoke-RestMethod "`$BASE/api/health" | ConvertTo-Json -Depth 6 | Out-Host } catch { Write-Host `$_.Exception.Message -ForegroundColor Yellow }
"@
)

# WEBHOOK (Stripe CLI)
Start-Process powershell.exe -WorkingDirectory $proj -ArgumentList @(
  '-NoExit','-Command',
  @"
`$host.ui.RawUI.WindowTitle='WEBHOOK - iguideu9';
stripe -v;
stripe listen --forward-to http://127.0.0.1:4020/api/payments/webhook
"@
)
