$host.UI.RawUI.WindowTitle = 'IGU SERVER'
cd "C:\Users\Tom\Desktop\iguideu-backend-fresh"

# cerrar cualquier node previo
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# levantar server y mostrar dónde escucha
node .\server.js
