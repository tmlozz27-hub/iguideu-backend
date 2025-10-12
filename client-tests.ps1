# 🪟 PS3 - CLIENT (tests E2E local)
$host.ui.RawUI.WindowTitle = 'PS3 - CLIENT (tests)'

# 0) Base local
$BASE = 'http://127.0.0.1:4020'

# 0.1) Sanity health
try {
  $health = Invoke-RestMethod "$BASE/api/health"
  Write-Host "Health OK -> env:$($health.env) dbState:$($health.dbState)" -ForegroundColor Green
} catch {
  Write-Host "❌ Health falló. ¿Server arriba en PS1?" -ForegroundColor Red
  throw
}

# 1) Crear PaymentIntent
$body = @{ amount = 1599; currency = 'usd'; metadata = @{ order = 'UI-DEMO-LOCAL' } } | ConvertTo-Json
$pi = Invoke-RestMethod "$BASE/api/payments/intent" -Method POST -ContentType 'application/json' -Body $body

if (-not $pi -or -not $pi.paymentIntentId) {
  Write-Host "❌ No se obtuvo paymentIntentId" -ForegroundColor Red
  throw
}

$PIID = $pi.paymentIntentId
Write-Host "✅ PI creado: $PIID" -ForegroundColor Green

# 2) Confirmar (VISA test) — necesitas STRIPE CLI logueado
$confirmCmd = "stripe payment_intents confirm $PIID --payment-method pm_card_visa"
Write-Host "→ Confirmando PI con Stripe CLI..." -ForegroundColor Yellow
# Ejecutar de forma visible para ver output
cmd /c $confirmCmd

Start-Sleep -Seconds 2

# 3) Ver orden (debe quedar 'succeeded')
try {
  $order1 = Invoke-RestMethod "$BASE/api/orders/by-intent/$PIID"
  Write-Host "✅ Orden status: $($order1.order.status)" -ForegroundColor Green
} catch {
  Write-Host "❌ Error obteniendo orden (succeeded). ¿Ruta expuesta /api/orders/by-intent/:id?" -ForegroundColor Red
  throw
}

# 4) Refund parcial (USD 3.00)
$refundPartial = @{ paymentIntentId = $PIID; amount = 300 } | ConvertTo-Json
$ref1 = Invoke-RestMethod "$BASE/api/payments/refund" -Method POST -ContentType 'application/json' -Body $refundPartial
Write-Host "✅ Refund parcial: $($ref1.refund.id) amount: $($ref1.refund.amount)" -ForegroundColor Green

# 5) Refund total (resto)
$refundTotal = @{ paymentIntentId = $PIID } | ConvertTo-Json
$ref2 = Invoke-RestMethod "$BASE/api/payments/refund" -Method POST -ContentType 'application/json' -Body $refundTotal
Write-Host "✅ Refund total: $($ref2.refund.id) amount: $($ref2.refund.amount)" -ForegroundColor Green

Start-Sleep -Seconds 2

# 6) Ver orden final (refunded + refunds[])
try {
  $order2 = Invoke-RestMethod "$BASE/api/orders/by-intent/$PIID"
  Write-Host "✅ Orden final: $($order2.order.status) | refundedAmount: $($order2.order.refundedAmount)" -ForegroundColor Green
  $order2 | ConvertTo-Json -Depth 10 | Out-Host
} catch {
  Write-Host "❌ Error obteniendo orden final." -ForegroundColor Red
  throw
}
