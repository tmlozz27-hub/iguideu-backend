$host.UI.RawUI.WindowTitle = "CLIENT - Backend I GUIDE U"
Set-Location "$HOME\Desktop\iguideu-backend-fresh"

function Json($o){ $o | ConvertTo-Json -Depth 10 -Compress }
function CallJson {
  param([string]$Method="GET",[string]$Path="/",[hashtable]$Body,$Headers)
  $uri = "http://127.0.0.1:3000$Path"
  $hdr = @{ 'Content-Type'='application/json' }
  if($Headers){ $Headers.Keys | % { $hdr[$_] = $Headers[$_] } }
  $b = if($Body){ Json $Body } else { $null }
  Invoke-RestMethod -Method $Method -Uri $uri -Headers $hdr -Body $b
}

function Wait-ForServer {
  Write-Host "Esperando al server en http://127.0.0.1:3000..." -ForegroundColor Yellow
  for($i=1;$i -le 30;$i++){
    try {
      $h = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Method GET -TimeoutSec 2
      if($h.dbState -eq 1){
        Write-Host "Server listo (dbState=1)." -ForegroundColor Green
        return
      }
    } catch {}
    Start-Sleep -Seconds 1
  }
  throw "No se pudo contactar al server en 30s"
}

# Esperar y luego mostrar health
Wait-ForServer
Write-Host "Health:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Method GET | Format-Table
