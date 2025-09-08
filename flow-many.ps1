# Esperar server
$ok=$false
for($i=0;$i -lt 30;$i++){ try{ $h=Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Method GET; if($h.status -eq "ok"){ $ok=$true; break } }catch{}; Start-Sleep 1 }
if(-not $ok){ throw "No se pudo contactar al server" }

# Signup
$u   = "tom+"+(Get-Random)+"@iguideu.com"
$pwd = "Lorenza4127-"
$signup = Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/auth/signup" -Headers @{ "Content-Type"="application/json" } -Body (@{ email=$u; password=$pwd; name="Tom" } | ConvertTo-Json -Compress)
$H = @{ Authorization = "Bearer " + $signup.token }
Write-Host "✅ Signup: $($signup.user.email)"

# 2 guías distintos
$g1="g"+(Get-Random)
$g2="g"+(Get-Random)

# A (g1 2h-4h) -> confirmar
$startA=(Get-Date).AddHours(2).ToString("o"); $endA=(Get-Date).AddHours(4).ToString("o")
$A = Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/bookings" -Headers $H -ContentType "application/json" -Body (@{ guide=$g1; startAt=$startA; endAt=$endA; price=100 } | ConvertTo-Json -Compress)
$Aid=$A.booking._id; Invoke-RestMethod -Method PATCH -Uri "http://127.0.0.1:3000/api/bookings/$Aid/confirm" -Headers $H | Out-Null
Write-Host "✅ A confirmada ($Aid) en $g1"

# B solapada (g1 3h-5h) -> 409
$startB=(Get-Date).AddHours(3).ToString("o"); $endB=(Get-Date).AddHours(5).ToString("o")
try{
  Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/bookings" -Headers $H -ContentType "application/json" -Body (@{ guide=$g1; startAt=$startB; endAt=$endB; price=120 } | ConvertTo-Json -Compress) | Out-Null
  Write-Host "❌ ERROR: B no fue rechazada"
}catch{ Write-Host "✅ B rechazada por solape en $g1" }

# C (g2 3h-5h) distinto guía -> debe crear ok
$C = Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/bookings" -Headers $H -ContentType "application/json" -Body (@{ guide=$g2; startAt=$startB; endAt=$endB; price=140 } | ConvertTo-Json -Compress)
$Cid=$C.booking._id; Invoke-RestMethod -Method PATCH -Uri "http://127.0.0.1:3000/api/bookings/$Cid/confirm" -Headers $H | Out-Null
Write-Host "✅ C confirmada ($Cid) en $g2"

# Listado
$list = Invoke-RestMethod -Method GET -Uri "http://127.0.0.1:3000/api/bookings" -Headers $H
Write-Host "📋 Mis reservas:"
$list.bookings | % { Write-Host (" - {0}  {1}  [{2} → {3}]  guide={4}" -f $_._id,$_.status,$_.startAt,$_.endAt,$_.guide) }
