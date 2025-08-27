# scripts/open-server.ps1
$host.UI.RawUI.WindowTitle = 'IGU SERVER'
cd 'C:\Users\Tom\Desktop\iguideu-backend-fresh'

# Modo memoria + puerto fijo
$env:IGU_MEM = '1'
$env:PORT    = '3000'

# Mata cualquier Node previo (silencioso)
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# Levanta el server
node .\server.js
