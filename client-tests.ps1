$Host.UI.RawUI.WindowTitle = "CLIENT - iguideu"
$BASE = "http://127.0.0.1:4020"

Write-Host "`n--> GET $BASE/api/health" -ForegroundColor Cyan
try { Invoke-RestMethod "$BASE/api/health" | Format-List } catch { Write-Host "No responde /api/health. Revisá la consola SERVER por errores." -ForegroundColor Yellow }

Write-Host "`n--> POST $BASE/api/payments/create-intent" -ForegroundColor Cyan
$body = @{ amount = 1000; currency = "usd"; metadata = @{ source = "iguideu-13-test" } } | ConvertTo-Json
try {
  Invoke-RestMethod -Method POST -Uri "$BASE/api/payments/create-intent" -ContentType "application/json" -Body $body | Format-List
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Yellow
}

Write-Host "`n--> GET $BASE/api/admin/stats" -ForegroundColor Cyan
try {
  $headers = @{ "x-admin-key" = "changeme-admin-iguideu" }
  Invoke-RestMethod -Headers $headers "$BASE/api/admin/stats" | Format-List
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Yellow
}
