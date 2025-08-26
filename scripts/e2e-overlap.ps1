# scripts/e2e-overlap.ps1
$ErrorActionPreference = "Stop"
$URL = "http://127.0.0.1:3000"

function Call($method, $path, $token, $body=$null) {
  $args = @{ Uri = "$URL$path"; Method = $method; Headers = @{ Authorization = $token }; ErrorAction='Stop' }
  if ($body) { $args.ContentType='application/json'; $args.Body=$body }
  return Invoke-RestMethod @args
}

# 0) Health
$h = Invoke-RestMethod -Uri "$URL/api/health" -Method Get
"HEALTH: $($h.status) / $($h.env)"

# 0.1) Reset memoria (si tu server expone /api/_reset)
try {
  Invoke-RestMethod -Uri "$URL/api/_reset" -Method Post | Out-Null
  "RESET OK"
} catch {
  "RESET SKIPPED (no endpoint /api/_reset o no necesario)"
}

# Tokens válidos (IDs 24-hex)
$GUIDE_TOKEN    = "Bearer GUIDE:64b000000000000000000001"
$TRAVELER_TOKEN = "Bearer TRAVELER:64b000000000000000000002"

# Booking A (confirmable)
$startA = (Get-Date).AddHours(2).ToString("o")
$endA   = (Get-Date).AddHours(4).ToString("o")
$bodyA  = @{ guideId="64b000000000000000000001"; startAt=$startA; endAt=$endA; priceUSD=100 } | ConvertTo-Json
$A = Call POST "/api/bookings" $TRAVELER_TOKEN $bodyA
$AID = $A.booking._id
"CREATED A: $AID"

# Confirm A
Call PATCH "/api/bookings/$AID/confirm" $GUIDE_TOKEN | Out-Null
"CONFIRM A OK"

# Booking B (se solapa con A)
$startB = (Get-Date).AddHours(3).ToString("o")
$endB   = (Get-Date).AddHours(5).ToString("o")
$bodyB  = @{ guideId="64b000000000000000000001"; startAt=$startB; endAt=$endB; priceUSD=120 } | ConvertTo-Json
$B = Call POST "/api/bookings" $TRAVELER_TOKEN $bodyB
$BID = $B.booking._id
"CREATED B: $BID"

# Confirm B -> debe dar 409 overlap
try {
  Call PATCH "/api/bookings/$BID/confirm" $GUIDE_TOKEN | Out-Null
  throw "ERROR: B se confirmó pero debía bloquearse por solape"
} catch {
  "OK: B bloqueado por overlap (409)"
}

# Booking C (no se solapa)
$startC = (Get-Date).AddHours(5).ToString("o")
$endC   = (Get-Date).AddHours(7).ToString("o")
$bodyC  = @{ guideId="64b000000000000000000001"; startAt=$startC; endAt=$endC; priceUSD=140 } | ConvertTo-Json
$C = Call POST "/api/bookings" $TRAVELER_TOKEN $bodyC
$CID = $C.booking._id
"CREATED C: $CID"

# Confirm C -> OK
Call PATCH "/api/bookings/$CID/confirm" $GUIDE_TOKEN | Out-Null
"CONFIRM C OK"

"LIST:"
(Invoke-RestMethod -Uri "$URL/api/bookings" -Method Get).bookings | ForEach-Object {
  "$($_._id) | guide=$($_.guide) | traveler=$($_.traveler) | $($_.startAt) - $($_.endAt) | status=$($_.status)"
}


