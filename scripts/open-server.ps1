$host.UI.RawUI.WindowTitle = 'IGU SERVER'
$env:IGU_MEM = '1'
$env:PORT    = '3000'

Stop-Process -Name node -Force -ErrorAction SilentlyContinue

cd "C:\Users\Tom\Desktop\iguideu-backend-fresh"
node .\server.js
