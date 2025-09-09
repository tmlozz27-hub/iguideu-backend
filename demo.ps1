param(
  [string]\ = 'http://127.0.0.1:3000',
  [int]\ = 5,
  [int]\ = 9,
  [int]\ = 11
)

\Continue = 'Stop'
Write-Host ">> Health..." -f Cyan
Invoke-RestMethod -Method GET -Uri "\/api/health" | Out-Null

\="tom+\1687445388@iguideu.com"; \C:\Users\Tom\Desktop\iguideu-backend-fresh="Lorenza4127-"
Write-Host ">> Signup/Login como \" -f Cyan
Invoke-RestMethod -Method POST -Uri "\/api/auth/signup" -Headers @{ "Content-Type"="application/json" } -Body (@{ email=\; password=\C:\Users\Tom\Desktop\iguideu-backend-fresh; name="Tom" } | ConvertTo-Json -Compress) | Out-Null
\ = Invoke-RestMethod -Method POST -Uri "\/api/auth/login" -Headers @{ "Content-Type"="application/json" } -Body (@{ email=\; password=\C:\Users\Tom\Desktop\iguideu-backend-fresh } | ConvertTo-Json -Compress)
\ = @{ Authorization = ("Bearer " + \.token) }

Write-Host ">> Guías..." -f Cyan
Invoke-RestMethod -Method GET -Uri "\/api/guides" | Out-Null

Write-Host ">> Booking sin solape..." -f Cyan
\ = (Get-Date).AddDays(\).Date.AddHours(\).ToString('o')
\   = (Get-Date).AddDays(\).Date.AddHours(\).ToString('o')
\ = Invoke-RestMethod -Method POST -Uri "\/api/bookings" -Headers \ -ContentType "application/json" -Body (@{ guide="g1002"; startAt=\; endAt=\; price=200 } | ConvertTo-Json -Compress)
\ = \.booking._id
Write-Host "   -> Booking: \" -f DarkGray

Write-Host ">> Pago (authorize + capture)..." -f Cyan
try { Invoke-RestMethod -Method POST -Uri "\/api/payments/authorize/\" -Headers \ | Out-Null }
catch { Invoke-RestMethod -Method POST -Uri "\/api/bookings/\/payments/authorize" -Headers \ | Out-Null }
try { \ = Invoke-RestMethod -Method POST -Uri "\/api/payments/capture/\" -Headers \ }
catch { \ = Invoke-RestMethod -Method POST -Uri "\/api/bookings/\/payments/capture" -Headers \ }

Write-Host ("OK → Pago: {0} | Booking: {1}" -f \.booking.payment.status, \.booking.status) -f Green

Write-Host ">> Mis bookings:" -f Cyan
(\ = Invoke-RestMethod -Method GET -Uri "\/api/bookings/me" -Headers \) | ConvertTo-Json -Depth 5
