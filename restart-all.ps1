powershell -File "$HOME\Desktop\iguideu-backend-fresh\stop-all.ps1"
Start-Sleep -Seconds 1
powershell -NoExit -File "$HOME\Desktop\iguideu-backend-fresh\start-all.ps1"
