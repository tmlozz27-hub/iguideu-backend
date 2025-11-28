$BASE = "http://127.0.0.1:4023"

Write-Host "Pegá el stripeSessionId de la booking a marcar como PAID:" -ForegroundColor Cyan
$sessionId = Read-Host "stripeSessionId"

if (-not $sessionId) {
    Write-Host "No se ingresó sessionId. Saliendo..." -ForegroundColor Yellow
    exit
}

$body = @{
    sessionId = $sessionId
} | ConvertTo-Json

try {
    Write-Host "Enviando POST a $BASE/api/bookings/mark-paid ..." -ForegroundColor Cyan

    $resp = Invoke-RestMethod -Method Post -Uri "$BASE/api/bookings/mark-paid" `
        -ContentType "application/json" -Body $body

    Write-Host "---- Respuesta ----" -ForegroundColor Green
    $resp | Format-List
}
catch {
    Write-Host "❌ Error llamando a /api/bookings/mark-paid" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
