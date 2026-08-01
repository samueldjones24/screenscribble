$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

$candidateDirs = @(
  (Join-Path $repoRoot 'src-tauri\target\release\bundle\nsis'),
  (Join-Path $env:USERPROFILE '.cargo\targets\screenscribble\release\bundle\nsis')
)

$installer = $null
foreach ($dir in $candidateDirs) {
  if (-not (Test-Path $dir)) {
    continue
  }

  $match = Get-ChildItem -Path $dir -File -Filter 'ScreenScribble*.exe' |
    Where-Object { $_.Name -like '*-setup.exe' -and $_.Name -ne 'ScreenScribble-Setup.exe' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if ($match) {
    $installer = $match
    break
  }
}

if (-not $installer) {
  throw 'No versioned NSIS installer was found to rename.'
}

$stablePath = Join-Path $installer.DirectoryName 'ScreenScribble-Setup.exe'
if (Test-Path $stablePath) {
  Remove-Item -Path $stablePath -Force
}

Move-Item -Path $installer.FullName -Destination $stablePath -Force

Write-Host "Renamed installer to stable filename: $stablePath"
