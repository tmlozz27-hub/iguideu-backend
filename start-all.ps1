taskkill /IM node.exe /F 2>$null
Start-Process powershell -ArgumentList @("-NoExit","-NoLogo","-File","$HOME\Desktop\iguideu-backend-fresh\server-run.ps1")
Start-Process powershell -ArgumentList @("-NoExit","-NoLogo","-File","$HOME\Desktop\iguideu-backend-fresh\client-run.ps1")
