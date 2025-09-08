$host.UI.RawUI.WindowTitle = "CLIENT - Smoke"
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

# Esperar server
for($i=1;$i -le 30;$i++){
  try{
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Method GET -TimeoutSec 2
    if($h.dbState -eq 1){ Write-Host "Health OK" -ForegroundColor Green; break }
  }catch{}
  Start-Sleep 1
}

# Signup + me
$u="tom+"+(Get-Random)+"@iguideu.com"; $pwd="Lorenza4127-"
$signup = CallJson -Method "POST" -Path "/api/auth/signup" -Body @{ email=$u; password=$pwd; name="Tom" }
$H = @{ Authorization = "Bearer " + $signup.token }
CallJson -Method "GET" -Path "/api/auth/me" -Headers $H | Out-Host
