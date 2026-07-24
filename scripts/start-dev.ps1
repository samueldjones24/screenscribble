$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$env:Path = "C:/Users/samue/.cargo/bin;" + $env:Path

$frontendArgs = @('-NoExit', '-Command', "Set-Location `"$repo`"; npm.cmd run dev")
Start-Process powershell -ArgumentList $frontendArgs -PassThru | Out-Null

npm.cmd run dev:desktop
