$Host.UI.RawUI.WindowTitle = "SERVER - iguideu"

# Node con NVM + refresh del PATH (soluciona 'npm no se reconoce')
nvm on 2>$null
nvm use 22.20.0 2>$null
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")

# Diagnóstico rápido
node -v
where node
where npm

# Instalar dependencias (ci si hay lock; sino i normal)
if (Test-Path .\package-lock.json) {
  npm ci 2>$null
  if ($LASTEXITCODE -ne 0) { npm i }
} else {
  npm i
}

# Evitar doble instancia en 4020: mata cualquier proceso escuchando antes de arrancar
$lines = (netstat -ano | findstr ":4020")
if ($lines) {
  $pids = $lines | ForEach-Object { ($_ -split "\s+")[-1] } | Sort-Object -Unique
  foreach ($pid in $pids) { try { Stop-Process -Id $pid -Force } catch {} }
}

# Levantar server
npm run dev
