$ErrorActionPreference = "Stop"

# === Config ===
$URL   = $env:URL; if (-not $URL -or $URL -eq "") { $URL = "http://127.0.0.1:3000" }
$email = "tom@example.com"
$pass  = "superseguro123"

function Invoke-Json {
  param([string]$Method,[string]$Path,[hashtable]$Body,[hashtable]$Headers)
  $uri = "$URL$Path"
  if ($Body) {
    return Invoke-RestMethod -Uri $uri -Method $Method -Proxy $null `
      -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 6) -Headers $Headers
  } else {
    return Invoke-RestMethod -Uri $uri -Method $Method -Proxy $null -Headers $Headers
  }
}

Write-Host "HEALTH..."
$h = Invoke-Json -Method Get -Path "/api/health"
Write-Host ("ok / " + $h.env)

# === Login con fallback a registro ===
$headers = $null
try {
  $login = Invoke-Json -Method Post -Path "/api/auth/login" -Body @{ email=$email; password=$pass }
} catch {
  if ($_.ErrorDetails.Message -like '*"invalid_credentials"*') {
    Write-Host "No existe el usuario. Registrando..."
    $reg = Invoke-Json -Method Post -Path "/api/auth/register" -Body @{ name="Tom"; email=$email; password=$pass }
    Write-Host "Registro OK. Reintentando login..."
    $login = Invoke-Json -Method Post -Path "/api/auth/login" -Body @{ email=$email; password=$pass }
  } else {
    throw
  }
}
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }
Write-Host "LOGIN OK"

# === Reset de datos (si tu server lo expone) ===
Invoke-Json -Method Post -Path "/api/bookings/debug/reset" -Headers $headers | Out-Null
Write-Host "RESET OK"

# === Preparar slots ===
$now    = Get-Date
$startA = $now.AddMinutes(10).ToString("o")
$endA   = $now.AddHours(2).ToString("o")
$startB = $now.AddMinutes(30).ToString("o") # solapa con A
$endB   = $now.AddHours(2.5).ToString("o")

# === Crear + confirmar A ===
$A = Invoke-Json -Method Post -Path "/api/bookings" -Headers $headers -Body @{ guide="g1"; startAt=$startA; endAt=$endA }
$Aid = $A.booking._id
Invoke-Json -Method Patch -Path "/api/bookings/$Aid/confirm" -Headers $headers | Out-Null
Write-Host "CONFIRM A OK → $Aid"

# === Crear B y chequear overlap (debe dar 409) ===
$B = Invoke-Json -Method Post -Path "/api/bookings" -Headers $headers -Body @{ guide="g1"; startAt=$startB; endAt=$endB }
$Bid = $B.booking._id
try {
  Invoke-Json -Method Patch -Path "/api/bookings/$Bid/confirm" -Headers $headers | Out-Null
  Write-Host "⚠️ Se confirmó B y NO debía (falló overlap)"; exit 1
} catch {
  if ($_.ErrorDetails.Message -like '*"error":"overlap"*') {
    Write-Host "✅ OVERLAP bloqueado (409 recibido)"
  } else {
    Write-Host "⚠️ Error inesperado al confirmar B:" $_.Exception.Message; exit 1
  }
}

# === Listar final ===
$all = Invoke-Json -Method Get -Path "/api/bookings" -Headers $headers
"LIST:"; $all | ConvertTo-Json -Depth 8

