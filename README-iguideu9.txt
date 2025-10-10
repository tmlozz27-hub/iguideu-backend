== I-GUIDE-U 9 – Cómo levantar y probar ==

A) Ventanas
- Usar run-iguideu9.ps1 (abre SERVER / CLIENT / WEBHOOK)
- Si cambias el webhook secret, reinicia SERVER.

B) Webhook (WEBHOOK - iguideu9)
1) stripe listen --forward-to http://127.0.0.1:4020/api/payments/webhook
   -> Copiar "Your webhook signing secret is whsec_XXXX"
2) Abrir .env y pegar:
   STRIPE_WEBHOOK_SECRET=whsec_XXXX
3) Reiniciar SERVER.

C) Tests (CLIENT - iguideu9)
$BASE = "http://127.0.0.1:4020"

# Health
Invoke-RestMethod "$BASE/api/health" | ConvertTo-Json -Depth 6 | Out-Host

# Crear Intent
$body = @{ amount = 1599; currency = "usd"; metadata = @{ order = "UI-NEW" } } | ConvertTo-Json
$pi   = Invoke-RestMethod "$BASE/api/payments/intent" -Method POST -ContentType "application/json" -Body $body
$PIID = $pi.paymentIntentId

# Confirmar (ver eventos en WEBHOOK)
stripe payment_intents confirm "$PIID" --payment-method pm_card_visa

# Ver la orden
Invoke-RestMethod "$BASE/api/orders/by-intent/$PIID" | ConvertTo-Json -Depth 8 | Out-Host

# Refund parcial (USD 3.00)
$refundPartial = @{ paymentIntentId = $PIID; amount = 300 } | ConvertTo-Json
Invoke-RestMethod "$BASE/api/payments/refund" -Method POST -ContentType "application/json" -Body $refundPartial | ConvertTo-Json -Depth 6 | Out-Host

# Refund total (resto)
$refundTotal = @{ paymentIntentId = $PIID } | ConvertTo-Json
Invoke-RestMethod "$BASE/api/payments/refund" -Method POST -ContentType "application/json" -Body $refundTotal | ConvertTo-Json -Depth 6 | Out-Host

D) Si una orden queda en requires_payment_method
- Asegurar que stripe listen está activo y el STRIPE_WEBHOOK_SECRET del .env coincide.
- Repetir: crear nuevo PI y confirmar; o re-enviar evento:
  stripe events list --type payment_intent.succeeded --limit 10
  stripe events resend --event evt_xxx --forward-to http://127.0.0.1:4020/api/payments/webhook
