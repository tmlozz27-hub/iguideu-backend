# Esperar server
$ok=$false
for($i=0;$i -lt 30;$i++){ try{ $h=Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Method GET; if($h.status -eq "ok"){ $ok=$true; break } }catch{}; Start-Sleep 1 }
if(-not $ok){ throw "No se pudo contactar al server" }

# Signup
$u   = "admin+"+(Get-Random)+"@iguideu.com"
$pwd = "Lorenza4127-"
$signup = Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3000/api/auth/signup" -Headers @{ "Content-Type"="application/json" } -Body (@{ email=$u; password=$pwd; name="AdminUser" } | ConvertTo-Json -Compress)
$H = @{ Authorization = "Bearer " + $signup.token }
Write-Host "✅ Admin candidato creado: $($signup.user.email)"

# Promover a admin por DB
node "$HOME\Desktop\iguideu-backend-fresh\admin-make.mjs" $u

# Probar endpoint admin
$adminList = Invoke-RestMethod -Method GET -Uri "http://127.0.0.1:3000/api/admin/bookings" -Headers $H
Write-Host "📋 Admin bookings (últimas 50): $($adminList.bookings.Count) items"
($adminList.bookings | Select-Object -First 5) | ForEach-Object {
  Write-Host (" - {0}  {1}  guide={2}" -f $_._id,$_.status,$_.guide)
}
