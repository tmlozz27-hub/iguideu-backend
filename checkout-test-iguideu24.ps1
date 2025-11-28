$BASE = "http://127.0.0.1:4023"

$body = @{
    amount   = 1000    # 1000 = USD 10.00
    currency = "usd"
} | ConvertTo-Json

$resp = Invoke-RestMethod -Method Post -Uri "$BASE/api/payments/create-checkout" -ContentType "application/json" -Body $body

"---- Respuesta del backend ----"
$resp | Format-List

if ($resp.url) {
    "Abriendo Checkout en el navegador..."
    Start-Process $resp.url
} else {
    "No vino url en la respuesta."
}
