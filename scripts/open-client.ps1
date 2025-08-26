$host.UI.RawUI.WindowTitle = 'IGU CLIENT'
$ErrorActionPreference = 'Stop'
$URL = 'http://127.0.0.1:3000'

# prueba rápida de health
Invoke-WebRequest "$URL/api/health" -UseBasicParsing | Select-Object -Expand Content

# tokens y helper listos para usar
$GUIDE_TOKEN    = 'Bearer GUIDE:64b000000000000000000001'
$TRAVELER_TOKEN = 'Bearer TRAVELER:64b000000000000000000002'

function Call($method, $path, $token, $body=$null){
  try{
    $a=@{Uri="$URL$path";Method=$method;Headers=@{Authorization=$token};ErrorAction='Stop'}
    if($body){$a.ContentType='application/json';$a.Body=$body}
    Invoke-RestMethod @a
  }catch{
    $r=$_.Exception.Response
    $sc=try{[int]$r.StatusCode}catch{$null}
    $bd=try{(New-Object IO.StreamReader($r.GetResponseStream())).ReadToEnd()}catch{""}
    "ERR $sc $method $path :: $bd"; throw
  }
}

# ejemplo rápido para crear una reserva (descomentá si querés probar ya):
# $start=(Get-Date).AddHours(2).ToString('o')
# $end  =(Get-Date).AddHours(5).ToString('o')
# $bkBody=@{guideId='64b000000000000000000001';startAt=$start;endAt=$end;priceUSD=100}|ConvertTo-Json
# $bk=Call POST '/api/bookings' $TRAVELER_TOKEN $bkBody
# $bk.booking
