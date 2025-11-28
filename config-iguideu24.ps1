$host.UI.RawUI.WindowTitle = "CONFIG - iguideu24"

# Base del backend local
$env:BASE = "http://127.0.0.1:4023"

Write-Host ""
Write-Host "Chequeando backend en: $env:BASE/api/health" -ForegroundColor Cyan
Write-Host ""

try {
    $health = Invoke-RestMethod "$env:BASE/api/health"
    Write-Host "✅ Respuesta de /api/health:" -ForegroundColor Green
    $health | Format-List
} catch {
    Write-Host ""
    Write-Host "❌ Error llamando /api/health" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "Listo. Presioná una tecla para salir..." -ForegroundColor Yellow
[void][System.Console]::ReadKey($true)
