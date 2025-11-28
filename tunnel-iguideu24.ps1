$host.UI.RawUI.WindowTitle = "TUNNEL - iguideu24"

cd "C:\Users\Tom\Desktop\backend-iguideu-24"

Write-Host ""
Write-Host "🌐 Creando quick tunnel a http://127.0.0.1:4023 ..." -ForegroundColor Cyan
Write-Host ""

cloudflared tunnel --url http://127.0.0.1:4023
