$h = Invoke-RestMethod -Uri "$env:URL/api/health" -Method Get
Write-Host "HEALTH: $($h.status) / $($h.env)"

$start = (Get-Date).AddHours(2).ToString("o")
$end   = (Get-Date).AddHours(5).ToString("o")
$bkBody = @{ guideId="64b000000000000000000001"; startAt=$start; endAt=$end; priceUSD=100 } | ConvertTo-Json

$bk = Invoke-RestMethod -Uri "$env:URL/api/bookings" -Method Post -ContentType "application/json" -Body $bkBody -Headers @{Authorization="Bearer TRAVELER:64b000000000000000000002"}
Write-Host "CREATED: $($bk.booking._id)"

Invoke-RestMethod -Uri "$env:URL/api/bookings/$($bk.booking._id)/confirm" -Method Patch -Headers @{Authorization="Bearer GUIDE:64b000000000000000000001"}
Write-Host "CONFIRM OK"

try {
  Invoke-RestMethod -Uri "$env:URL/api/bookings/$($bk.booking._id)/cancel" -Method Patch -Headers @{Authorization="Bearer TRAVELER:64b000000000000000000002"}
} catch {
  Write-Host "OK: traveler bloqueado en confirmed (409)"
}

Invoke-RestMethod -Uri "$env:URL/api/bookings/$($bk.booking._id)/cancel" -Method Patch -Headers @{Authorization="Bearer GUIDE:64b000000000000000000001"}
Write-Host "GUIDE CANCEL OK"

# pending booking para testear cancel
$bk2 = Invoke-RestMethod -Uri "$env:URL/api/bookings" -Method Post -ContentType "application/json" -Body $bkBody -Headers @{Authorization="Bearer TRAVELER:64b000000000000000000002"}
Write-Host "CREATED PENDING: $($bk2.booking._id)"

Invoke-RestMethod -Uri "$env:URL/api/bookings/$($bk2.booking._id)/cancel" -Method Patch -Headers @{Authorization="Bearer TRAVELER:64b000000000000000000002"}
Write-Host "TRAVELER CANCEL PENDING OK"
