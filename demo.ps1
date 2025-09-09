param(
  [string]$Base = "http://127.0.0.1:3000",
  [int]$DaysFromNow = 5,
  [int]$StartHour = 9,
  [int]$EndHour = 11
)

$ErrorActionPreference = "Stop"

Write-Host ">> Health..." -ForegroundColor Cyan
Invoke-RestMethod -Method GET -Uri "$Base/api/health" | Out-Null

# Usuario random
$u   = "tom+" + (Get-Random) + "@iguideu.com"
$pwd = "Lorenza4127-"

Write-Host ">> Signup/Login..." -ForegroundColor Cyan
$null  = Invoke-RestMethod -Method POST -Uri "$Base/api/auth/signup" -Headers @{ "Content-Type"="application/json" } -Body (@{ email=$u; password=$pwd; name="Tom" } | ConvertTo-Json -Compress)
$login = Invoke-RestMethod -Method POST -Uri "$Base/api/auth/login"  -Headers @{ "Content-Type"="application/json" } -Body (@{ email=$u; password=$pwd }      | ConvertTo-Json -Compress)
$H     = @{ Authorization = ("Bearer " + $login.token) }

Write-Host "   -> Usuario: $($login.user.email)" -ForegroundColor DarkGray

Write-Host ">> Guides..." -ForegroundColor Cyan
$guides = Invoke-RestMethod -Method GET -Uri "$Base/api/guides"
$guides | Out-Null

Write-Host ">> Booking sin solape..." -ForegroundColor Cyan
$start = (Get-Date).AddDays($DaysFromNow).Date.AddHours($StartHour).ToString("o")
$end   = (Get-Date).AddDays($DaysFromNow).Date.AddHours($EndHour).ToString("o")

try {
  $B = Invoke-RestMethod -Method POST -Uri "$Base/api/bookings" -Headers $H -ContentType "application/json" -Body (@{ guide="g1002"; startAt=$start; endAt=$end; price=200 } | ConvertTo-Json -Compress)
} catch {
  # Si hay overlap, intenta correr 2 horas más tarde
  Write-Host "   -> Overlap, probando 2 horas más tarde..." -ForegroundColor Yellow
  $start = (Get-Date).AddDays($DaysFromNow).Date.AddHours($StartHour+2).ToString("o")
  $end   = (Get-Date).AddDays($DaysFromNow).Date.AddHours($EndHour+2).ToString("o")
  $B = Invoke-RestMethod -Method POST -Uri "$Base/api/bookings" -Headers $H -ContentType "application/json" -Body (@{ guide="g1002"; startAt=$start; endAt=$end; price=200 } | ConvertTo-Json -Compress)
}

$Bid = $B.booking._id
Write-Host "   -> Booking: $Bid" -ForegroundColor DarkGray

Write-Host ">> Pago (authorize + capture)..." -ForegroundColor Cyan
try { Invoke-RestMethod -Method POST -Uri "$Base/api/payments/authorize/$Bid" -Headers $H | Out-Null }
catch { Invoke-RestMethod -Method POST -Uri "$Base/api/bookings/$Bid/payments/authorize" -Headers $H | Out-Null }

try { $BC = Invoke-RestMethod -Method POST -Uri "$Base/api/payments/capture/$Bid" -Headers $H }
catch { $BC = Invoke-RestMethod -Method POST -Uri "$Base/api/bookings/$Bid/payments/capture" -Headers $H }

Write-Host ("OK → Pago: {0} | Booking: {1}" -f $BC.booking.payment.status, $BC.booking.status) -ForegroundColor Green

Write-Host ">> Mis bookings:" -ForegroundColor Cyan
($me = Invoke-RestMethod -Method GET -Uri "$Base/api/bookings/me" -Headers $H) | ConvertTo-Json -Depth 5
