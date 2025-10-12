# client-tests-render.ps1
$BASE = 'https://iguideu-backend-9.onrender.com'

Write-Host "Health..." -ForegroundColor Cyan
Invoke-RestMethod "$BASE/api/health" | ConvertTo-Json -Depth 6 | Out-Host

Write-Host "Crear PI..." -ForegroundColor Cyan
$body = @{ amount = 1599; currency = 'usd'; metadata = @{ order = 'UI-DEMO-RENDER' } } | ConvertTo-Json
$pi   = Invoke-RestMethod "$BASE/api/payments/intent" -Method POST -ContentType 'application/json' -Body $body
$PIID = $pi.paymentIntentId
Write-Host "PI: $PIID" -ForegroundColor Green

Write-Host "Confirmar PI (Stripe CLI)..." -ForegroundColor Cyan
stripe payment_intents confirm $PIID --payment-method pm_card_visa | Out-Null

Start-Sleep -Seconds 1
Write-Host "Orden (succeeded)..." -ForegroundColor Cyan
$o1 = Invoke-RestMethod "$BASE/api/orders/by-intent/$PIID"
($o1 | ConvertTo-Json -Depth 8) | Out-Host

Write-Host "Refund parcial 3.00..." -ForegroundColor Cyan
$refundPartial = @{ paymentIntentId = $PIID; amount = 300 } | ConvertTo-Json
Invoke-RestMethod "$BASE/api/payments/refund" -Method POST -ContentType 'application/json' -Body $refundPartial | Out-Null

Start-Sleep -Seconds 1
Write-Host "Refund total (resto)..." -ForegroundColor Cyan
$refundTotal = @{ paymentIntentId = $PIID } | ConvertTo-Json
Invoke-RestMethod "$BASE/api/payments/refund" -Method POST -ContentType 'application/json' -Body $refundTotal | Out-Null

Start-Sleep -Seconds 1
Write-Host "Orden final (refunded)..." -ForegroundColor Cyan
$o2 = Invoke-RestMethod "$BASE/api/orders/by-intent/$PIID"
($o2 | ConvertTo-Json -Depth 8) | Out-Host

Write-Host "Listo. PI: $PIID" -ForegroundColor Green
