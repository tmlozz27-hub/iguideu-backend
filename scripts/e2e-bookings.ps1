$ErrorActionPreference = "Stop"
$URL = "http://127.0.0.1:3000"

function Call($method, $path, $token, $body=$null) {
  $args = @{ Uri = "$URL$path"; Method = $method; Headers = @{ Authorization = $token }; ErrorAction='Stop' }
  if ($body) { $args.ContentType='application/json'; $args.Body=$body }
  return Invoke-RestMethod @args
}

$h = Invoke-RestMethod -Uri "$URL/api/health" -Method Get
"HEALTH: $($h.status) / $($h.env)"

$GUIDE_TOKEN    = "Bearer GUIDE:64b000000000000000000001"
$TRAVELER_TOKEN = "Bearer TRAVELER:64b000000000000000000002"

# Caso 1
$start = (Get-Date).AddHours(2).ToString("o")
$end   = (Get-Date).AddHours(5).ToString("o")
$bkBody = @{ guideId="64b000000000000000000001"; startAt=$start; endAt=$end; priceUSD=100 } | ConvertTo-Json

$bkRes = Call POST "/api/bookings" $TRAVELER_TOKEN $bkBody
$BOOKING_ID = $bkRes.booking._id
"CREATED: $BOOKING_ID"

Call PATCH "/api/bookings/$BOOKING_ID/confirm" $GUIDE_TOKEN | Out-Null
"CONFIRM OK"

try {
  Call PATCH "/api/bookings/$BOOKING_ID/cancel" $TRAVELER_TOKEN | Out-Null
  "WARN: traveler canceló confirmado"
} catch { "OK: traveler bloqueado en confirmed (409)" }

Call PATCH "/api/bookings/$BOOKING_ID/cancel" $GUIDE_TOKEN | Out-Null
"GUIDE CANCEL OK"

# Caso 2
$start2 = (Get-Date).AddHours(6).ToString("o")
$end2   = (Get-Date).AddHours(8).ToString("o")
$bkBody2 = @{ guideId="64b000000000000000000001"; startAt=$start2; endAt=$end2; priceUSD=120 } | ConvertTo-Json

$bk2 = Call POST "/api/bookings" $TRAVELER_TOKEN $bkBody2
$B2 = $bk2.booking._id
"CREATED PENDING: $B2"

Call PATCH "/api/bookings/$B2/cancel" $TRAVELER_TOKEN | Out-Null
"TRAVELER CANCEL PENDING OK"

