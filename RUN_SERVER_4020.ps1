$Host.UI.RawUI.WindowTitle = "SERVER - iguideu23 (RUNNER)"
Set-Location "C:\Users\Tom\Desktop\backend-iguideu-24"

# Kill whatever is using port 4020
$line = (netstat -ano | Select-String ":4020\s" | Select-Object -First 1)
if ($line) {
  $pid = ($line.ToString() -split "\s+")[-1]
  if ($pid -match "^\d+$") { taskkill /PID $pid /F 2>$null }
}

$log = ".\server-crash.log"
("==== RUNNER START " + (Get-Date -Format s) + " ====") | Out-File -FilePath $log -Append -Encoding utf8

while ($true) {
  ("---- START NODE " + (Get-Date -Format s) + " ----") | Out-File -FilePath $log -Append -Encoding utf8
  $env:PORT = "4020"

  # IMPORTANT: run the ESM server (project has "type":"module")
  & node ".\src\server.js" 2>&1 | Tee-Object -FilePath $log -Append

  ("---- NODE EXIT " + (Get-Date -Format s) + " (restart in 2s) ----") | Out-File -FilePath $log -Append -Encoding utf8
  Start-Sleep -Seconds 2
}
