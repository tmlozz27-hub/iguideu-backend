$host.UI.RawUI.WindowTitle = "CLIENT - iguideu"
cd "$HOME\Desktop\iguideu-backend-fresh"

function Json($o){ $o | ConvertTo-Json -Depth 10 -Compress }
function CallJson {
  param([string]$Method="GET",[string]$Path="/",[hashtable]$Body,$Headers)
  $uri = "http://127.0.0.1:3000$Path"
  $hdr = @{ 'Content-Type'='application/json' }
  if($Headers){ $Headers.Keys | % { $hdr[$_] = $Headers[$_] } }
  $b = if($Body){ Json $Body } else { $null }
  Invoke-RestMethod -Method $Method -Uri $uri -Headers $hdr -Body $b
}

Write-Host "Listo. Proba salud: " -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Method GET
