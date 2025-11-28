$ErrorActionPreference = "Stop"

$baseUrl = "http://127.0.0.1:4023"

Write-Host "➡ Consultando $baseUrl/api/bookings ..." -ForegroundColor Cyan

try {
    $resp = Invoke-RestMethod -Method Get -Uri "$baseUrl/api/bookings"
} catch {
    Write-Host "❌ Error llamando a /api/bookings:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    return
}

if (-not $resp.ok) {
    Write-Host "❌ Respuesta con ok=false:" -ForegroundColor Red
    $resp | Format-List | Out-String | Write-Host
    return
}

$bookings = $resp.bookings
if (-not $bookings) {
    Write-Host "ℹ No hay bookings." -ForegroundColor Yellow
    return
}

Write-Host ""
Write-Host "✅ Bookings recibidos: $($bookings.Count)" -ForegroundColor Green

# Ordenar del más nuevo al más viejo
$sorted = $bookings | Sort-Object createdAt -Descending

# Tomar solo los 5 últimos
$latest = $sorted | Select-Object -First 5

Write-Host ""
Write-Host "===== ÚLTIMOS 5 BOOKINGS =====" -ForegroundColor Cyan

foreach ($b in $latest) {
    Write-Host "------------------------------------------" -ForegroundColor DarkGray

    $created = $b.createdAt
    $status = $b.status

    # Compatibilidad amount / amountTotal
    if ($null -ne $b.amount) {
        $amount = [int]$b.amount
    } elseif ($null -ne $b.amountTotal) {
        $amount = [int]$b.amountTotal
    } else {
        $amount = 0
    }

    if ($null -ne $b.platformFee) {
        $platformFee = [int]$b.platformFee
    } else {
        $platformFee = [math]::Round($amount * 0.1)
    }

    if ($null -ne $b.guideAmount) {
        $guideAmount = [int]$b.guideAmount
    } else {
        $guideAmount = $amount - $platformFee
    }

    $amountUsd       = [math]::Round($amount / 100, 2)
    $platformUsd     = [math]::Round($platformFee / 100, 2)
    $guideAmountUsd  = [math]::Round($guideAmount / 100, 2)

    $sessionId = $b.stripeSessionId
    if ($sessionId -and $sessionId.Length -gt 22) {
        $sessionShort = $sessionId.Substring(0, 22) + "..."
    } else {
        $sessionShort = $sessionId
    }

    Write-Host ("ID           : {0}" -f $b._id)
    Write-Host ("Fecha        : {0}" -f $created)
    Write-Host ("Estado       : {0}" -f $status)
    Write-Host ("Total        : {0} (USD {1})" -f $amount, $amountUsd)
    Write-Host ("Plataforma   : {0} (USD {1})" -f $platformFee, $platformUsd)
    Write-Host ("Guía         : {0} (USD {1})" -f $guideAmount, $guideAmountUsd)
    Write-Host ("Session ID   : {0}" -f $sessionShort)
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "FIN DE LISTA" -ForegroundColor Cyan
