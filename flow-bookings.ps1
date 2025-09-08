# Esperar a que el server esté listo
$health = $null
for ($i=0; $i -lt 30; $i++) {
  try {
    $health = Invoke-RestMethod -Method GET -Uri "http://127.0.0.1:3000/api/health"
    if ($health.status -eq "ok") { break }
  } catch {}
  Start-Sleep -Seconds 1
}
if ($null -eq $health -or $health.status -ne "ok") { throw "No se pudo contactar al server en 30s" }

# 1) Signup
$u   = "tom+"+(Get-Random)+"@iguideu.com"
$pwd = "Lorenza4127-"
$signup = Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/auth/signup" `
  -Headers @{ "Content-Type"="application/json" } `
  -ContentType "application/json" `
  -Body (@{ email=$u; password=$pwd; name="Tom" } | ConvertTo-Json -Compress)
Write-Host "✅ Signup OK: $($signup.user.email)"

# 2) Header con token
$H = @{ Authorization = "Bearer " + $signup.token }

# 👉 Guide aleatorio para evitar solapes con pruebas anteriores
$guide = "g"+(Get-Random)

# 3) Crear reserva A (2h-4h)
$startA = (Get-Date).AddHours(2).ToString("o")
$endA   = (Get-Date).AddHours(4).ToString("o")
try {
  $A = Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/bookings" `
    -Headers $H -ContentType "application/json" `
    -Body (@{ guide=$guide; startAt=$startA; endAt=$endA; price=100 } | ConvertTo-Json -Compress)
  $Aid = $A.booking._id
  if (-not $Aid) { throw "No se creó A (respuesta inválida)" }
  Write-Host "✅ Creada A: $Aid"
} catch {
  Write-Host "❌ No se pudo crear A: $($_.Exception.Response.GetResponseStream() | % { (New-Object IO.StreamReader($_)).ReadToEnd() })"
  throw
}

# 4) Confirmar A
Invoke-RestMethod -Method PATCH -Uri "http://127.0.0.1:3000/api/bookings/$Aid/confirm" -Headers $H | Out-Null
Write-Host "✅ Confirmada A"

# 5) Intentar crear B solapada (3h-5h) -> debe dar 409
$startB = (Get-Date).AddHours(3).ToString("o")
$endB   = (Get-Date).AddHours(5).ToString("o")
try {
  Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/bookings" `
    -Headers $H -ContentType "application/json" `
    -Body (@{ guide=$guide; startAt=$startB; endAt=$endB; price=120 } | ConvertTo-Json -Compress) | Out-Null
  Write-Host "❌ ERROR: B no fue rechazada por solape"
} catch {
  Write-Host "✅ B rechazada por solape (OK)"
}

# 6) Cancelar A
Invoke-RestMethod -Method PATCH -Uri "http://127.0.0.1:3000/api/bookings/$Aid/cancel" -Headers $H | Out-Null
Write-Host "✅ Cancelada A"

# 7) Crear B ahora (3h-5h)
$B = Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/bookings" `
  -Headers $H -ContentType "application/json" `
  -Body (@{ guide=$guide; startAt=$startB; endAt=$endB; price=120 } | ConvertTo-Json -Compress)
$Bid = $B.booking._id
Write-Host "✅ Creada B: $Bid"

# 8) Confirmar B
Invoke-RestMethod -Method PATCH -Uri "http://127.0.0.1:3000/api/bookings/$Bid/confirm" -Headers $H | Out-Null
Write-Host "✅ Confirmada B"

# 9) Listado final
$list = Invoke-RestMethod -Method GET -Uri "http://127.0.0.1:3000/api/bookings" -Headers $H
Write-Host "📋 Listado final:"
$list.bookings | ForEach-Object {
  Write-Host (" - {0}: {1}  [{2} → {3}]" -f $_._id, $_.status, $_.startAt, $_.endAt)
}
